"""SSE streaming for AI suggestion generation.

Subscribes to a Redis pubsub channel keyed by job_id and relays events
to the client as Server-Sent Events. The worker publishes events to the
same channel as it processes the job.

SSE event types (per the OpenAPI contract):
  - event: status   → data: {"status": "processing"} or {"status": "streaming"}
  - event: token    → data: "incremental text chunk"
  - event: complete → data: {"suggestion_id": "...", "changes": [...]}
  - event: failed   → data: {"error_message": "..."}
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from typing import AsyncGenerator

import redis.asyncio as aioredis
from fastapi import Request
from sqlalchemy import select
from sse_starlette.sse import EventSourceResponse

from db import async_session_factory
from models import GenerationJob, Suggestion, SuggestionChange

logger = logging.getLogger("ai")

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379")


def _pubsub_channel(job_id: str) -> str:
    """Redis pubsub channel name for a given job."""
    return f"dialed:sse:{job_id}"


async def stream_suggestion_events(
    job_id: str, request: Request
) -> EventSourceResponse:
    """Create an EventSourceResponse for a generation job.

    Called by the router — not registered as its own route.
    """
    return EventSourceResponse(
        _event_generator(job_id, request),
        media_type="text/event-stream",
    )


async def _event_generator(
    job_id: str, request: Request
) -> AsyncGenerator[dict, None]:
    """Generate SSE events by subscribing to the Redis pubsub channel.

    Yields dicts with 'event' and 'data' keys that sse-starlette formats
    into proper SSE frames.
    """
    # Check if the job already reached a terminal state.
    terminal_event = await _check_terminal_state(job_id)
    if terminal_event is not None:
        yield terminal_event
        return

    # Subscribe to the Redis pubsub channel for this job.
    redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
    pubsub = redis_client.pubsub()
    channel = _pubsub_channel(job_id)

    try:
        await pubsub.subscribe(channel)

        while True:
            # Check for client disconnect.
            if await request.is_disconnected():
                logger.info(
                    "Client disconnected from SSE stream for job %s", job_id
                )
                break

            # Wait for a message with a short timeout so we can check
            # for disconnect periodically.
            message = await pubsub.get_message(
                ignore_subscribe_messages=True, timeout=1.0
            )

            if message is None:
                continue

            if message["type"] != "message":
                continue

            try:
                payload = json.loads(message["data"])
            except (json.JSONDecodeError, TypeError):
                logger.warning("Invalid pubsub message for job %s", job_id)
                continue

            event_type = payload.get("event", "")
            event_data = payload.get("data", "")

            # Format data as JSON string for the SSE frame.
            data_str = json.dumps(event_data)
            yield {"event": event_type, "data": data_str}

            # Close stream after terminal events.
            if event_type in ("complete", "failed"):
                break

    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
        await redis_client.aclose()


async def _check_terminal_state(job_id: str) -> dict | None:
    """Check if a job has already completed or failed.

    If so, return the appropriate SSE event dict to send immediately.
    Returns None if the job is still in progress.
    """
    try:
        async with async_session_factory() as db:
            result = await db.execute(
                select(GenerationJob).where(
                    GenerationJob.id == uuid.UUID(job_id)
                )
            )
            job = result.scalar_one_or_none()

            if job is None:
                return {
                    "event": "failed",
                    "data": json.dumps({"error_message": "Job not found"}),
                }

            if job.status == "complete":
                suggestion_data = await _fetch_completed_suggestion(
                    db, job.session_id
                )
                return {
                    "event": "complete",
                    "data": json.dumps(suggestion_data),
                }

            if job.status == "failed":
                return {
                    "event": "failed",
                    "data": json.dumps(
                        {"error_message": job.error_message or "Job failed"}
                    ),
                }

    except Exception:
        logger.exception("Error checking terminal state for job %s", job_id)

    return None


async def _fetch_completed_suggestion(
    db, session_id: uuid.UUID
) -> dict:
    """Fetch the completed suggestion and its changes for the terminal event."""
    suggestion_result = await db.execute(
        select(Suggestion)
        .where(Suggestion.session_id == session_id)
        .order_by(Suggestion.created_at.desc())
        .limit(1)
    )
    suggestion = suggestion_result.scalar_one_or_none()
    if not suggestion:
        return {"suggestion_id": None, "changes": []}

    changes_result = await db.execute(
        select(SuggestionChange).where(
            SuggestionChange.suggestion_id == suggestion.id
        )
    )
    changes = changes_result.scalars().all()

    return {
        "suggestion_id": str(suggestion.id),
        "changes": [
            {
                "id": str(c.id),
                "suggestion_id": str(c.suggestion_id),
                "parameter": c.parameter,
                "suggested_value": c.suggested_value,
                "symptom": c.symptom,
                "confidence": c.confidence,
                "applied_status": c.applied_status,
                "actual_value": c.actual_value,
                "outcome_lap_delta_ms": c.outcome_lap_delta_ms,
                "applied_at": c.applied_at.isoformat() if c.applied_at else None,
                "created_at": c.created_at.isoformat()
                if hasattr(c.created_at, "isoformat")
                else str(c.created_at),
            }
            for c in changes
        ],
    }
