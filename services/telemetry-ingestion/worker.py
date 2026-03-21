"""Redis queue worker — consumes ingestion jobs and runs pipelines.

Launch as a separate process:

    python -m worker

Or via uvicorn alongside the API (using a lifespan startup task).
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import insert, select, update

from db import _DbSession, _TsSession
from dialed_shared.logging import setup_logger
from dialed_shared.redis_tasks import consume_jobs
from models.ingestion_job import IngestionJob, IngestionStatus
from models.lap_segment import LapSegment
from pipelines.csv_parser import (
    ParseResult,
    bulk_insert_telemetry,
    fetch_channel_aliases,
    parse_csv,
)
from pipelines.ocr_pipeline import extract_setup_sheet
from pipelines.voice_pipeline import extract_entities, transcribe_voice_note

logger = setup_logger("telemetry-ingestion")

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379")
QUEUE_NAME = "dialed:ingestion"
CORE_API_URL = os.environ.get("CORE_API_URL", "http://core-api:8001")
INTERNAL_SECRET = os.environ.get("INTERNAL_SECRET", "shared-secret-for-internal-tokens")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

# Channel used by Redis pubsub to notify SSE listeners of job completion.
SSE_CHANNEL_PREFIX = "dialed:sse:job:"


# ── Helpers ──────────────────────────────────────────────────────────────────


async def _update_job_status(
    job_id: str,
    status: IngestionStatus,
    *,
    result: dict | None = None,
    error_message: str | None = None,
    confidence: float | None = None,
) -> None:
    """Update an ingestion_jobs row in the database."""
    values: dict[str, Any] = {"status": status}
    if result is not None:
        values["result"] = result
    if error_message is not None:
        values["error_message"] = error_message
    if confidence is not None:
        values["confidence"] = confidence
    if status in (IngestionStatus.complete, IngestionStatus.failed):
        values["completed_at"] = datetime.now(timezone.utc)

    async with _DbSession() as session:
        await session.execute(
            update(IngestionJob)
            .where(IngestionJob.id == job_id)
            .values(**values)
        )
        await session.commit()


async def _publish_sse_event(job_id: str, event_data: dict) -> None:
    """Publish a job completion event via Redis pubsub for SSE listeners."""
    import json

    import redis.asyncio as aioredis

    client = aioredis.from_url(REDIS_URL, decode_responses=True)
    try:
        channel = f"{SSE_CHANNEL_PREFIX}{job_id}"
        await client.publish(channel, json.dumps(event_data))
        logger.info("Published SSE event on %s", channel)
    finally:
        await client.aclose()


# Redis stream name for cross-service telemetry ingestion events.
TELEMETRY_STREAM = "telemetry.ingestion.completed"


async def _publish_ingestion_stream_event(
    session_id: str,
    job_id: str,
    row_count: int,
    channels: list[str],
) -> None:
    """Publish a ``telemetry.ingestion.completed`` event to a Redis stream.

    Other services (e.g. AI) consume this stream to react to new telemetry
    data without polling.  All values are stored as strings as required by
    Redis Streams.
    """
    import json

    import redis.asyncio as aioredis

    client = aioredis.from_url(REDIS_URL, decode_responses=True)
    try:
        await client.xadd(
            TELEMETRY_STREAM,
            {
                "session_id": session_id,
                "job_id": job_id,
                "row_count": str(row_count),
                "channels": json.dumps(channels),
            },
        )
        logger.info(
            "Published %s event: session=%s job=%s rows=%d",
            TELEMETRY_STREAM,
            session_id,
            job_id,
            row_count,
        )
    except Exception:
        # Stream publish failure is non-fatal — log and continue.
        logger.exception(
            "Failed to publish ingestion stream event for job %s", job_id
        )
    finally:
        await client.aclose()


async def _get_api_key(
    source: str,
    user_id: str | None,
    internal_token: str,
) -> str:
    """Get the API key for OCR/voice jobs.

    Tries to fetch the user's BYOK key from Core API first. Falls back
    to the platform key.
    """
    if user_id:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    f"{CORE_API_URL}/users/{user_id}/api-keys",
                    headers={"X-Internal-Token": internal_token},
                )
                if resp.status_code == 200:
                    keys = resp.json()
                    if source == "ocr" and keys.get("anthropic_api_key"):
                        return keys["anthropic_api_key"]
                    if source == "voice" and keys.get("openai_api_key"):
                        return keys["openai_api_key"]
        except Exception:
            logger.debug("Could not fetch BYOK key for user %s, using platform key", user_id)

    if source == "ocr":
        return ANTHROPIC_API_KEY
    return OPENAI_API_KEY


async def _patch_session_best_lap(
    session_id: str,
    best_lap_ms: int,
    internal_token: str,
) -> None:
    """Write csv_best_lap_ms back to the session via Core API."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.patch(
                f"{CORE_API_URL}/sessions/{session_id}",
                json={"csv_best_lap_ms": best_lap_ms},
                headers={"X-Internal-Token": internal_token},
            )
            resp.raise_for_status()
            logger.info("Patched session %s with best_lap_ms=%d", session_id, best_lap_ms)
    except Exception:
        logger.exception("Failed to patch session %s with best lap", session_id)


async def _insert_lap_segments(
    session_id: str,
    laps: list,
) -> None:
    """Insert lap_segments rows for a CSV job."""
    if not laps:
        return

    values = [
        {
            "session_id": session_id,
            "lap_number": lap.lap_number,
            "start_time_ms": lap.start_time_ms,
            "end_time_ms": lap.end_time_ms,
            "lap_time_ms": lap.lap_time_ms,
            "beacon_start_s": lap.beacon_start_s,
            "beacon_end_s": lap.beacon_end_s,
        }
        for lap in laps
    ]

    async with _DbSession() as session:
        await session.execute(insert(LapSegment).values(values))
        await session.commit()


# ── Pipeline handlers ────────────────────────────────────────────────────────


async def _handle_csv(payload: dict, internal_token: str) -> dict:
    """Run the CSV ingestion pipeline and return the result dict."""
    session_id = payload["session_id"]
    file_path = payload["file_path"]

    aliases = await fetch_channel_aliases(CORE_API_URL, internal_token)
    result: ParseResult = parse_csv(file_path, aliases, session_id=session_id)

    # Bulk insert telemetry points.
    async with _TsSession() as ts_session:
        inserted = await bulk_insert_telemetry(ts_session, session_id, result.rows)

    # Insert lap segments.
    await _insert_lap_segments(session_id, result.laps)

    # Patch the session with best lap time.
    if result.best_lap_ms > 0:
        await _patch_session_best_lap(session_id, result.best_lap_ms, internal_token)

    return {
        "channels_found": result.channels_found,
        "lap_count": len(result.laps),
        "best_lap_ms": result.best_lap_ms,
        "total_duration_s": result.total_duration_s,
        "rows_inserted": inserted,
    }


async def _handle_ocr(payload: dict, internal_token: str) -> tuple[dict, float]:
    """Run the OCR pipeline and return (result_dict, confidence)."""
    file_path = payload["file_path"]
    user_id = payload.get("user_id")

    api_key = await _get_api_key("ocr", user_id, internal_token)
    if not api_key:
        raise ValueError("No Anthropic API key available for OCR processing")

    ocr_result = await extract_setup_sheet(file_path, api_key)

    return {
        "settings": ocr_result.settings,
        "raw_response": ocr_result.raw_response,
    }, ocr_result.confidence


async def _handle_voice(payload: dict, internal_token: str) -> tuple[dict, float]:
    """Run the voice pipeline and return (result_dict, confidence)."""
    file_path = payload["file_path"]
    user_id = payload.get("user_id")

    api_key = await _get_api_key("voice", user_id, internal_token)
    if not api_key:
        raise ValueError("No OpenAI API key available for voice processing")

    transcript = await transcribe_voice_note(file_path, api_key)
    voice_result = extract_entities(transcript)

    return {
        "transcript": voice_result.transcript,
        "feedback": voice_result.feedback,
        "setting_mentions": voice_result.setting_mentions,
        "lap_times": voice_result.lap_times,
    }, voice_result.confidence


# ── Main job handler ─────────────────────────────────────────────────────────


async def handle_job(payload: dict) -> None:
    """Process a single ingestion job from the Redis queue.

    This is the handler passed to ``consume_jobs``.
    """
    job_id = payload.get("job_id")
    session_id = payload.get("session_id")
    source = payload.get("source")

    if not all([job_id, session_id, source]):
        logger.error("Malformed job payload: %s", payload)
        return

    # Build an internal token for inter-service calls.
    # In production the gateway's token is passed through; for the worker
    # we create one from the shared secret.
    from dialed_shared.auth import create_internal_token

    internal_token = create_internal_token(
        user_id=payload.get("user_id", "system"),
        secret=INTERNAL_SECRET,
    )

    logger.info("Starting job %s (source=%s, session=%s)", job_id, source, session_id)

    # Mark as processing.
    await _update_job_status(job_id, IngestionStatus.processing)

    try:
        if source == "csv":
            result = await _handle_csv(payload, internal_token)
            confidence = None
        elif source == "ocr":
            result, confidence = await _handle_ocr(payload, internal_token)
        elif source == "voice":
            result, confidence = await _handle_voice(payload, internal_token)
        else:
            raise ValueError(f"Unknown ingestion source: {source}")

        # Mark as complete.
        await _update_job_status(
            job_id,
            IngestionStatus.complete,
            result=result,
            confidence=confidence,
        )

        # Publish SSE event.
        await _publish_sse_event(job_id, {
            "job_id": job_id,
            "status": "complete",
            "result": result,
        })

        # For CSV jobs, publish a Redis stream event so other services
        # (e.g. AI) can react to new telemetry data.
        if source == "csv":
            await _publish_ingestion_stream_event(
                session_id=session_id,
                job_id=job_id,
                row_count=result.get("rows_inserted", 0),
                channels=result.get("channels_found", []),
            )

        logger.info("Job %s completed successfully", job_id)

    except Exception as exc:
        error_msg = str(exc)
        logger.exception("Job %s failed: %s", job_id, error_msg)

        await _update_job_status(
            job_id,
            IngestionStatus.failed,
            error_message=error_msg,
        )

        await _publish_sse_event(job_id, {
            "job_id": job_id,
            "status": "failed",
            "error": error_msg,
        })


# ── Entry point ──────────────────────────────────────────────────────────────


async def main() -> None:
    """Start the worker loop — blocks forever."""
    logger.info("Ingestion worker starting (queue=%s)", QUEUE_NAME)
    await consume_jobs(
        redis_url=REDIS_URL,
        queue_name=QUEUE_NAME,
        handler=handle_job,
    )


if __name__ == "__main__":
    asyncio.run(main())
