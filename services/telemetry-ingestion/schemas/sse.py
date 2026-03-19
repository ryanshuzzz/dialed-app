"""Pydantic models for SSE event data payloads."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class SseStatusEvent(BaseModel):
    """data payload for event: status."""

    status: str = "processing"


class SseCompleteEvent(BaseModel):
    """data payload for event: complete."""

    job_id: UUID
    status: str = "complete"
    result: dict[str, Any]


class SseFailedEvent(BaseModel):
    """data payload for event: failed."""

    job_id: UUID
    status: str = "failed"
    error: str
