"""Pydantic schemas for the AI suggestion endpoints.

Matches contracts/openapi/ai.yaml exactly.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


# ── Enums ──


class AppliedStatus(str, Enum):
    """How the rider acted on a suggestion change."""

    not_applied = "not_applied"
    applied = "applied"
    applied_modified = "applied_modified"
    skipped = "skipped"


class JobStatus(str, Enum):
    """Generation job lifecycle state."""

    pending = "pending"
    processing = "processing"
    streaming = "streaming"
    complete = "complete"
    failed = "failed"


# ── Request schemas ──


class SuggestRequest(BaseModel):
    """POST /suggest — request body."""

    session_id: uuid.UUID


class UpdateChangeStatusRequest(BaseModel):
    """PATCH /suggest/{suggestion_id}/changes/{change_id} — request body."""

    applied_status: AppliedStatus
    actual_value: str | None = None


class RecordOutcomeRequest(BaseModel):
    """PATCH /suggest/{suggestion_id}/changes/{change_id}/outcome — request body."""

    outcome_lap_delta_ms: int


# ── Response schemas ──


class SuggestResponse(BaseModel):
    """POST /suggest — 202 response."""

    job_id: uuid.UUID


class SuggestionChangeResponse(BaseModel):
    """Individual suggestion change — used in detail and as UpdatedChange."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    suggestion_id: uuid.UUID
    parameter: str
    suggested_value: str
    symptom: str | None = None
    confidence: float | None = None
    applied_status: AppliedStatus = AppliedStatus.not_applied
    actual_value: str | None = None
    outcome_lap_delta_ms: int | None = None
    applied_at: datetime | None = None
    created_at: datetime


class SuggestionDetailResponse(BaseModel):
    """GET /suggest/{suggestion_id} — full suggestion with changes."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    user_id: uuid.UUID
    suggestion_text: str
    changes: list[SuggestionChangeResponse] = []
    created_at: datetime


class SuggestionSummaryResponse(BaseModel):
    """GET /suggest/session/{session_id} — list item."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    user_id: uuid.UUID
    suggestion_text: str
    change_count: int = 0
    applied_count: int = 0
    created_at: datetime


class GenerationJobResponse(BaseModel):
    """Generation job status."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    status: JobStatus
    error_message: str | None = None
    created_at: datetime
    completed_at: datetime | None = None


# ── SSE event models (for documentation / typing, not directly serialised) ──


class SSEStatusEvent(BaseModel):
    """event: status."""

    status: str


class SSETokenEvent(BaseModel):
    """event: token — data is a raw text string, not JSON object."""

    text: str


class SSECompleteEvent(BaseModel):
    """event: complete."""

    suggestion_id: uuid.UUID
    changes: list[SuggestionChangeResponse]


class SSEFailedEvent(BaseModel):
    """event: failed."""

    error_message: str
