"""Pydantic schemas for ingestion endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class IngestionJobCreated(BaseModel):
    """Response for POST /ingest/csv, /ingest/ocr, /ingest/voice (202)."""

    job_id: UUID


class IngestionJobResponse(BaseModel):
    """Response for GET /ingest/jobs/{job_id} (200)."""

    id: UUID
    session_id: UUID
    source: str = Field(pattern=r"^(csv|ocr|voice)$")
    status: str = Field(pattern=r"^(pending|processing|complete|failed)$")
    result: dict[str, Any] | None = None
    error_message: str | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    created_at: datetime
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}


class ConfirmRequest(BaseModel):
    """Request body for POST /ingest/jobs/{job_id}/confirm."""

    confirmed: bool
    corrections: dict[str, Any] | None = None


class ConfirmResponse(BaseModel):
    """Response for POST /ingest/jobs/{job_id}/confirm (200)."""

    status: str = Field(pattern=r"^(confirmed|corrected)$")
    session_id: UUID
