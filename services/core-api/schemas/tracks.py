"""Track domain schemas — circuit CRUD."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


# ── Requests ──


class TrackCreate(BaseModel):
    """Create a new track / circuit."""

    name: str = Field(..., min_length=1, max_length=200)
    config: str | None = Field(None, max_length=100)
    surface_notes: str | None = None
    gps_bounds: dict[str, Any] | None = None


class TrackUpdate(BaseModel):
    """Partial update to track fields. All fields optional."""

    name: str | None = Field(None, min_length=1, max_length=200)
    config: str | None = Field(None, max_length=100)
    surface_notes: str | None = None
    gps_bounds: dict[str, Any] | None = None


# ── Responses ──


class TrackResponse(BaseModel):
    """Single track."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    config: str | None = None
    surface_notes: str | None = None
    gps_bounds: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime


class TrackListResponse(BaseModel):
    """List of tracks."""

    items: list[TrackResponse]
