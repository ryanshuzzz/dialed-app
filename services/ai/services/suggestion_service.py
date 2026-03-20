"""Suggestion service — CRUD operations and status-transition validation.

Provides database operations for the router (create job, list/get
suggestions, update change status, record outcomes) and validation
logic for applied_status transitions.
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from dialed_shared import NotFoundException, ValidationException, push_job

from models import GenerationJob, Suggestion, SuggestionChange
from schemas.suggest import AppliedStatus

logger = logging.getLogger("ai")

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379")
CORE_API_URL = os.environ.get("CORE_API_URL", "http://core-api:8001")

# Valid applied_status transitions.  The key is the current status and
# the value is the set of statuses it may transition to.
_VALID_TRANSITIONS: dict[str, set[str]] = {
    "not_applied": {"applied", "applied_modified", "skipped"},
    "skipped": {"applied", "applied_modified", "not_applied"},
    # Once applied, the rider cannot revert to not_applied — they can
    # only refine (applied_modified) or decide to skip after all.
    "applied": {"applied_modified", "skipped"},
    "applied_modified": {"applied", "skipped"},
}


# ── Session validation ──


async def validate_session_exists(
    session_id: uuid.UUID,
    internal_token: str,
) -> None:
    """Verify the session exists in Core API before enqueuing a job.

    Args:
        session_id: The session UUID to validate.
        internal_token: The internal auth token to forward to Core API.

    Raises:
        NotFoundException: If the session does not exist (Core API returns 404).
        NotFoundException: If Core API is unreachable or returns an unexpected error.
    """
    url = f"{CORE_API_URL.rstrip('/')}/sessions/{session_id}"
    headers = {"X-Internal-Token": internal_token}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 404:
                raise NotFoundException("Session not found")
            resp.raise_for_status()
    except NotFoundException:
        raise
    except (httpx.HTTPStatusError, httpx.RequestError) as exc:
        logger.warning("Failed to validate session %s with Core API: %s", session_id, exc)
        raise NotFoundException("Session not found")


# ── Job creation ──


async def create_generation_job(
    db: AsyncSession,
    session_id: uuid.UUID,
    user_id: str,
    internal_token: str,
) -> uuid.UUID:
    """Create a generation job row, push to Redis queue, return job_id."""
    job = GenerationJob(session_id=session_id)
    db.add(job)
    await db.flush()  # populate job.id from server_default
    await db.refresh(job, attribute_names=["id"])

    job_id = job.id

    await push_job(
        redis_url=REDIS_URL,
        queue_name="dialed:ai",
        payload={
            "job_id": str(job_id),
            "session_id": str(session_id),
            "user_id": user_id,
            "internal_token": internal_token,
        },
    )

    await db.commit()
    logger.info("Created generation job %s for session %s", job_id, session_id)
    return job_id


# ── Suggestion queries ──


async def list_suggestions_by_session(
    db: AsyncSession,
    session_id: uuid.UUID,
) -> list[dict]:
    """Return suggestion summaries for a session, newest first."""
    result = await db.execute(
        select(Suggestion)
        .where(Suggestion.session_id == session_id)
        .order_by(Suggestion.created_at.desc())
    )
    suggestions = result.scalars().all()

    summaries = []
    for s in suggestions:
        # Count changes and applied changes in a subquery.
        count_result = await db.execute(
            select(
                func.count(SuggestionChange.id).label("change_count"),
                func.count(SuggestionChange.id)
                .filter(
                    SuggestionChange.applied_status.in_(["applied", "applied_modified"])
                )
                .label("applied_count"),
            ).where(SuggestionChange.suggestion_id == s.id)
        )
        counts = count_result.one()

        summaries.append(
            {
                "id": s.id,
                "session_id": s.session_id,
                "user_id": s.user_id,
                "suggestion_text": s.suggestion_text,
                "change_count": counts.change_count,
                "applied_count": counts.applied_count,
                "created_at": s.created_at,
            }
        )

    return summaries


async def get_suggestion_detail(
    db: AsyncSession,
    suggestion_id: uuid.UUID,
) -> Suggestion:
    """Fetch a suggestion with all its changes, or raise NOT_FOUND."""
    result = await db.execute(
        select(Suggestion)
        .options(selectinload(Suggestion.changes))
        .where(Suggestion.id == suggestion_id)
    )
    suggestion = result.scalar_one_or_none()
    if suggestion is None:
        raise NotFoundException("Suggestion not found")
    return suggestion


# ── Change tracking ──


async def update_change_status(
    db: AsyncSession,
    suggestion_id: uuid.UUID,
    change_id: uuid.UUID,
    applied_status: AppliedStatus,
    actual_value: str | None,
) -> SuggestionChange:
    """Update a change's applied_status with transition validation."""
    change = await _get_change(db, suggestion_id, change_id)

    # Validate transition.
    current = change.applied_status
    target = applied_status.value
    allowed = _VALID_TRANSITIONS.get(current, set())
    if target != current and target not in allowed:
        raise ValidationException(
            f"Cannot transition applied_status from '{current}' to '{target}'"
        )

    # Require actual_value when applied_modified.
    if target == "applied_modified" and not actual_value:
        raise ValidationException(
            "actual_value is required when applied_status is 'applied_modified'"
        )

    # Apply the update.
    change.applied_status = target
    if actual_value is not None:
        change.actual_value = actual_value
    # Set applied_at on any status that isn't not_applied.
    if target != "not_applied":
        change.applied_at = datetime.now(timezone.utc)
    else:
        change.applied_at = None

    await db.commit()
    await db.refresh(change)
    return change


async def record_change_outcome(
    db: AsyncSession,
    suggestion_id: uuid.UUID,
    change_id: uuid.UUID,
    outcome_lap_delta_ms: int,
) -> SuggestionChange:
    """Record the lap time outcome for a change."""
    change = await _get_change(db, suggestion_id, change_id)
    change.outcome_lap_delta_ms = outcome_lap_delta_ms
    await db.commit()
    await db.refresh(change)
    return change


async def _get_change(
    db: AsyncSession,
    suggestion_id: uuid.UUID,
    change_id: uuid.UUID,
) -> SuggestionChange:
    """Fetch a change, ensuring it belongs to the given suggestion."""
    result = await db.execute(
        select(SuggestionChange).where(
            SuggestionChange.id == change_id,
            SuggestionChange.suggestion_id == suggestion_id,
        )
    )
    change = result.scalar_one_or_none()
    if change is None:
        raise NotFoundException("Suggestion change not found")
    return change
