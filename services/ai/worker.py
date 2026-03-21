"""Async worker consuming AI suggestion jobs from the dialed:ai Redis queue.

For each job the worker:
1. Updates status → processing
2. Gathers context from Core API / Telemetry
3. Runs the deterministic rules engine
4. Builds a prompt and calls Claude with streaming
5. Publishes text chunks to Redis pubsub so the SSE endpoint can relay them
6. Parses the full response into structured changes
7. Persists the suggestion + changes in the database
8. Updates status → complete (or failed on error)
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from datetime import datetime, timezone

import anthropic
import redis.asyncio as aioredis
from sqlalchemy import select, update

from db import async_session_factory
from llm.prompt_builder import build_prompt
from llm.response_parser import parse_suggestion_response
from models import GenerationJob, Suggestion, SuggestionChange
from rules_engine import run_rules_engine
from services.context_gatherer import ContextGatherer

from dialed_shared import consume_jobs, setup_logger

logger = setup_logger("ai")

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379")
CORE_API_URL = os.environ.get("CORE_API_URL", "http://core-api:8001")
TELEMETRY_URL = os.environ.get("TELEMETRY_URL", "http://telemetry-ingestion:8002")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
INTERNAL_SECRET = os.environ.get("INTERNAL_SECRET", "")

CLAUDE_MODEL = "claude-sonnet-4-6"
CLAUDE_MAX_TOKENS = 2000


def _pubsub_channel(job_id: str) -> str:
    """Redis pubsub channel name for a given job."""
    return f"dialed:sse:{job_id}"


async def _publish_event(
    redis_client: aioredis.Redis,
    job_id: str,
    event: str,
    data: dict | str,
) -> None:
    """Publish an SSE event to the Redis pubsub channel for a job."""
    message = json.dumps({"event": event, "data": data})
    await redis_client.publish(_pubsub_channel(job_id), message)


async def _update_job_status(
    job_id: str,
    status: str,
    error_message: str | None = None,
    completed_at: datetime | None = None,
) -> None:
    """Update a generation job's status in the database."""
    async with async_session_factory() as session:
        values: dict = {"status": status}
        if error_message is not None:
            values["error_message"] = error_message
        if completed_at is not None:
            values["completed_at"] = completed_at

        await session.execute(
            update(GenerationJob)
            .where(GenerationJob.id == uuid.UUID(job_id))
            .values(**values)
        )
        await session.commit()


async def handle_job(payload: dict) -> None:
    """Process a single AI suggestion generation job."""
    job_id = payload.get("job_id", "")
    session_id = payload.get("session_id", "")
    user_id = payload.get("user_id", "")
    internal_token = payload.get("internal_token", "")

    redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)

    try:
        # 1. Status → processing
        await _update_job_status(job_id, "processing")
        await _publish_event(redis_client, job_id, "status", {"status": "processing"})

        # 2. Gather context
        gatherer = ContextGatherer(
            core_api_url=CORE_API_URL,
            telemetry_url=TELEMETRY_URL,
            internal_token=internal_token,
        )
        context = await gatherer.gather(session_id)

        # 3. Run rules engine
        flags = run_rules_engine(
            rider_feedback=context.session.get("rider_feedback"),
            suspension_spec=context.suspension_spec,
            change_log=context.change_log,
            bike_spec=context.bike,
            track_data=context.track or None,
            conditions=context.conditions or None,
            telemetry_analysis=context.telemetry_analysis,
        )

        # 4. Build prompt
        system_prompt, user_prompt = build_prompt(context, flags)

        # 5. Determine API key (user BYOK or platform key)
        api_key = ANTHROPIC_API_KEY
        user_profile = context.user_profile
        # If the user has their own API key, prefer it
        byok_key = user_profile.get("anthropic_api_key")
        if byok_key:
            api_key = byok_key

        if not api_key:
            raise ValueError("No Anthropic API key available")

        client = anthropic.AsyncAnthropic(api_key=api_key)

        # 6. Call Claude with streaming
        full_response_parts: list[str] = []
        first_chunk = True

        async with client.messages.stream(
            model=CLAUDE_MODEL,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
            max_tokens=CLAUDE_MAX_TOKENS,
        ) as stream:
            async for text in stream.text_stream:
                if first_chunk:
                    await _update_job_status(job_id, "streaming")
                    await _publish_event(
                        redis_client, job_id, "status", {"status": "streaming"}
                    )
                    first_chunk = False

                full_response_parts.append(text)
                await _publish_event(
                    redis_client, job_id, "token", text
                )

        full_response = "".join(full_response_parts)

        # 7. Parse structured changes
        parsed_changes = parse_suggestion_response(full_response)

        # 8. Persist suggestion + changes
        suggestion_id = uuid.uuid4()
        change_rows = []

        for pc in parsed_changes:
            change_rows.append(
                SuggestionChange(
                    suggestion_id=suggestion_id,
                    parameter=pc.parameter,
                    suggested_value=pc.suggested_value,
                    symptom=pc.symptom,
                    confidence=pc.confidence,
                    applied_status="not_applied",
                )
            )

        async with async_session_factory() as db:
            suggestion = Suggestion(
                id=suggestion_id,
                session_id=uuid.UUID(session_id),
                user_id=uuid.UUID(user_id),
                suggestion_text=full_response,
            )
            db.add(suggestion)
            for change in change_rows:
                db.add(change)
            await db.commit()

        # 9. Status → complete
        now = datetime.now(timezone.utc)
        await _update_job_status(job_id, "complete", completed_at=now)

        # 10. Publish complete event with suggestion data
        changes_data = [
            {
                "id": str(c.id) if c.id else None,
                "suggestion_id": str(suggestion_id),
                "parameter": c.parameter,
                "suggested_value": c.suggested_value,
                "symptom": c.symptom,
                "confidence": c.confidence,
                "applied_status": c.applied_status,
            }
            for c in change_rows
        ]
        await _publish_event(
            redis_client,
            job_id,
            "complete",
            {"suggestion_id": str(suggestion_id), "changes": changes_data},
        )

        logger.info(
            "Job %s completed: suggestion=%s, changes=%d",
            job_id,
            suggestion_id,
            len(change_rows),
        )

    except Exception as exc:
        logger.exception("Job %s failed: %s", job_id, exc)

        # Update status → failed
        now = datetime.now(timezone.utc)
        try:
            await _update_job_status(
                job_id, "failed", error_message=str(exc), completed_at=now
            )
        except Exception:
            logger.exception("Failed to update job %s status to failed", job_id)

        # Publish failure event
        try:
            await _publish_event(
                redis_client,
                job_id,
                "failed",
                {"error_message": str(exc)},
            )
        except Exception:
            logger.exception("Failed to publish failure event for job %s", job_id)

    finally:
        await redis_client.aclose()


async def main() -> None:
    """Entry point for the worker process."""
    if not ANTHROPIC_API_KEY:
        logger.warning(
            "ANTHROPIC_API_KEY is not set — jobs will fail unless every user "
            "supplies a BYOK key. Set ANTHROPIC_API_KEY in the environment or "
            "in infra/.env before starting the stack."
        )
    logger.info("AI worker starting, consuming from dialed:ai")
    await consume_jobs(
        redis_url=REDIS_URL,
        queue_name="dialed:ai",
        handler=handle_job,
    )


if __name__ == "__main__":
    asyncio.run(main())
