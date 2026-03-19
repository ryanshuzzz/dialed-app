"""Suggestion endpoints — request, stream, list, detail, change tracking.

Matches contracts/openapi/ai.yaml exactly:
  POST   /suggest                                        → 202
  GET    /suggest/{job_id}/stream                        → SSE
  GET    /suggest/session/{session_id}                   → 200
  GET    /suggest/{suggestion_id}                        → 200
  PATCH  /suggest/{suggestion_id}/changes/{change_id}    → 200
  PATCH  /suggest/{suggestion_id}/changes/{change_id}/outcome → 200
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from db import get_session
from dialed_shared import get_current_user
from schemas.suggest import (
    RecordOutcomeRequest,
    SuggestRequest,
    SuggestResponse,
    SuggestionChangeResponse,
    SuggestionDetailResponse,
    SuggestionSummaryResponse,
    UpdateChangeStatusRequest,
)
from services.suggestion_service import (
    create_generation_job,
    get_suggestion_detail,
    list_suggestions_by_session,
    record_change_outcome,
    update_change_status,
)
from sse import stream_suggestion_events

router = APIRouter(prefix="/suggest", tags=["Suggestions"])


# ═══════════════════════ SUGGESTION GENERATION ═══════════════════════


@router.post("", status_code=202, response_model=SuggestResponse)
async def request_suggestion(
    body: SuggestRequest,
    request: Request,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> SuggestResponse:
    """Create a generation job, push to dialed:ai queue, return job_id."""
    internal_token = request.headers.get("X-Internal-Token", "")
    job_id = await create_generation_job(
        db=db,
        session_id=body.session_id,
        user_id=user["user_id"],
        internal_token=internal_token,
    )
    return SuggestResponse(job_id=job_id)


@router.get("/{job_id}/stream")
async def stream_suggestion(
    job_id: str,
    request: Request,
) -> EventSourceResponse:
    """SSE stream of suggestion text as Claude generates it."""
    return await stream_suggestion_events(job_id, request)


# ═══════════════════════ SUGGESTION QUERIES ═══════════════════════


@router.get(
    "/session/{session_id}",
    response_model=list[SuggestionSummaryResponse],
)
async def list_session_suggestions(
    session_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> list[SuggestionSummaryResponse]:
    """List all suggestions for a session, newest first."""
    summaries = await list_suggestions_by_session(db, session_id)
    return [SuggestionSummaryResponse(**s) for s in summaries]


@router.get(
    "/{suggestion_id}",
    response_model=SuggestionDetailResponse,
)
async def get_suggestion(
    suggestion_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> SuggestionDetailResponse:
    """Get suggestion detail with all per-change tracking."""
    suggestion = await get_suggestion_detail(db, suggestion_id)
    return SuggestionDetailResponse.model_validate(suggestion)


# ═══════════════════════ CHANGE TRACKING ═══════════════════════


@router.patch(
    "/{suggestion_id}/changes/{change_id}",
    response_model=SuggestionChangeResponse,
)
async def update_change(
    suggestion_id: uuid.UUID,
    change_id: uuid.UUID,
    body: UpdateChangeStatusRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> SuggestionChangeResponse:
    """Update the applied_status of a suggestion change."""
    change = await update_change_status(
        db=db,
        suggestion_id=suggestion_id,
        change_id=change_id,
        applied_status=body.applied_status,
        actual_value=body.actual_value,
    )
    return SuggestionChangeResponse.model_validate(change)


@router.patch(
    "/{suggestion_id}/changes/{change_id}/outcome",
    response_model=SuggestionChangeResponse,
)
async def record_outcome(
    suggestion_id: uuid.UUID,
    change_id: uuid.UUID,
    body: RecordOutcomeRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> SuggestionChangeResponse:
    """Record the lap time outcome after applying a change."""
    change = await record_change_outcome(
        db=db,
        suggestion_id=suggestion_id,
        change_id=change_id,
        outcome_lap_delta_ms=body.outcome_lap_delta_ms,
    )
    return SuggestionChangeResponse.model_validate(change)
