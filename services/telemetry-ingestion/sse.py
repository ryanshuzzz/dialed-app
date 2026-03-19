"""SSE endpoint for ingestion job completion streaming.

Clients connect to ``GET /ingest/jobs/{job_id}/stream`` and receive a
single terminal event (``complete`` or ``failed``) when the job finishes.
The connection is closed after the terminal event.

Uses Redis pubsub as the primary notification mechanism (the worker
publishes on ``dialed:sse:job:{job_id}``), with a polling fallback
against the ingestion_jobs table every 1 second in case the pubsub
message was missed (e.g. client connected after the event was published).
"""

from __future__ import annotations

import asyncio
import json
import os

import redis.asyncio as aioredis
from sqlalchemy import select
from sse_starlette.sse import EventSourceResponse, ServerSentEvent

from db import _DbSession
from dialed_shared.logging import setup_logger
from models.ingestion_job import IngestionJob, IngestionStatus

logger = setup_logger("telemetry-ingestion")

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379")
SSE_CHANNEL_PREFIX = "dialed:sse:job:"
POLL_INTERVAL_S = 1.0
SSE_TIMEOUT_S = 300.0  # 5 minute max connection


async def _check_job_terminal(job_id: str) -> dict | None:
    """Check if the job has already reached a terminal state.

    Returns the event payload dict if terminal, None otherwise.
    """
    async with _DbSession() as session:
        stmt = select(IngestionJob).where(IngestionJob.id == job_id)
        row = (await session.execute(stmt)).scalar_one_or_none()

    if row is None:
        return None

    if row.status == IngestionStatus.complete:
        return {
            "job_id": str(row.id),
            "status": "complete",
            "result": row.result,
        }
    elif row.status == IngestionStatus.failed:
        return {
            "job_id": str(row.id),
            "status": "failed",
            "error": row.error_message,
        }

    return None


async def stream_job(job_id: str):
    """Async generator that yields SSE events for a job.

    Strategy:
    1. Check if the job is already terminal — if so, yield immediately.
    2. Subscribe to the Redis pubsub channel for this job.
    3. In parallel, poll the database every ``POLL_INTERVAL_S`` as a
       fallback (handles the race where the pubsub message fired before
       we subscribed).
    4. Yield the terminal event and stop.
    """
    # Check if already done.
    terminal = await _check_job_terminal(job_id)
    if terminal is not None:
        event_type = terminal["status"]  # "complete" or "failed"
        yield ServerSentEvent(data=json.dumps(terminal), event=event_type)
        return

    # Send an initial status event so the client knows we're connected.
    yield ServerSentEvent(data=json.dumps({"status": "processing"}), event="status")

    # Set up Redis pubsub + DB polling race.
    channel_name = f"{SSE_CHANNEL_PREFIX}{job_id}"
    result_event: asyncio.Event = asyncio.Event()
    result_data: dict = {}

    async def _listen_pubsub() -> None:
        """Listen for the worker's pubsub notification."""
        client = aioredis.from_url(REDIS_URL, decode_responses=True)
        try:
            pubsub = client.pubsub()
            await pubsub.subscribe(channel_name)
            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        result_data.update(json.loads(message["data"]))
                    except (json.JSONDecodeError, TypeError):
                        pass
                    result_event.set()
                    break
        finally:
            await pubsub.unsubscribe(channel_name)
            await client.aclose()

    async def _poll_db() -> None:
        """Poll the database as a fallback."""
        elapsed = 0.0
        while elapsed < SSE_TIMEOUT_S:
            await asyncio.sleep(POLL_INTERVAL_S)
            elapsed += POLL_INTERVAL_S
            terminal = await _check_job_terminal(job_id)
            if terminal is not None:
                result_data.update(terminal)
                result_event.set()
                return

    # Launch both listeners concurrently.
    pubsub_task = asyncio.create_task(_listen_pubsub())
    poll_task = asyncio.create_task(_poll_db())

    try:
        await asyncio.wait_for(result_event.wait(), timeout=SSE_TIMEOUT_S)
    except asyncio.TimeoutError:
        logger.warning("SSE stream timed out for job %s", job_id)
        yield ServerSentEvent(
            data=json.dumps({
                "job_id": job_id,
                "status": "failed",
                "error": "SSE stream timed out",
            }),
            event="failed",
        )
        return
    finally:
        pubsub_task.cancel()
        poll_task.cancel()
        # Suppress CancelledError from the tasks.
        for task in (pubsub_task, poll_task):
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass

    if result_data:
        event_type = result_data.get("status", "complete")
        if event_type not in ("complete", "failed"):
            event_type = "complete"
        yield ServerSentEvent(data=json.dumps(result_data), event=event_type)


def create_sse_response(job_id: str) -> EventSourceResponse:
    """Create an SSE response for a job stream endpoint."""
    return EventSourceResponse(stream_job(job_id))
