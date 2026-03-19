"""Session domain schemas — sessions, setup snapshots, and change log."""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field

from .bikes import SuspensionSpec


class SessionType(str, Enum):
    """Type of on-track session."""

    practice = "practice"
    qualifying = "qualifying"
    race = "race"
    trackday = "trackday"


class TireSnapshot(BaseModel):
    """Tire specification snapshot at session time."""

    brand: str | None = None
    compound: str | None = None
    laps: int | None = None


# ── Session requests ──


class SessionCreate(BaseModel):
    """Create a new track session."""

    event_id: uuid.UUID
    session_type: SessionType
    manual_best_lap_ms: int | None = None
    tire_front: TireSnapshot | None = None
    tire_rear: TireSnapshot | None = None
    rider_feedback: str | None = None
    voice_note_url: str | None = None


class SessionUpdate(BaseModel):
    """Partial update to session fields. All fields optional."""

    session_type: SessionType | None = None
    manual_best_lap_ms: int | None = None
    tire_front: TireSnapshot | None = None
    tire_rear: TireSnapshot | None = None
    rider_feedback: str | None = None
    voice_note_url: str | None = None


# ── Setup snapshot ──


class SetupSnapshotCreate(BaseModel):
    """Append an immutable setup snapshot to a session."""

    settings: SuspensionSpec


class SetupSnapshotResponse(BaseModel):
    """Single setup snapshot."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    settings: SuspensionSpec
    created_at: datetime


# ── Change log ──


class ChangeLogCreate(BaseModel):
    """Log a setting change for a session."""

    parameter: str = Field(..., min_length=1, max_length=100)
    from_value: str | None = Field(None, max_length=200)
    to_value: str = Field(..., min_length=1, max_length=200)
    rationale: str | None = None
    applied_at: datetime | None = None


class ChangeLogResponse(BaseModel):
    """Single change log entry."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    parameter: str
    from_value: str | None = None
    to_value: str
    rationale: str | None = None
    applied_at: datetime


# ── Session responses ──


class SessionResponse(BaseModel):
    """Single session without embedded children."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event_id: uuid.UUID
    user_id: uuid.UUID
    session_type: SessionType
    manual_best_lap_ms: int | None = None
    csv_best_lap_ms: int | None = None
    tire_front: TireSnapshot | None = None
    tire_rear: TireSnapshot | None = None
    rider_feedback: str | None = None
    voice_note_url: str | None = None
    created_at: datetime
    updated_at: datetime


class SessionDetailResponse(SessionResponse):
    """Full session with embedded snapshots and change log (GET /sessions/:id)."""

    snapshots: list[SetupSnapshotResponse] = []
    changes: list[ChangeLogResponse] = []


class SessionListResponse(BaseModel):
    """List of sessions."""

    items: list[SessionResponse]
