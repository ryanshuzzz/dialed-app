"""Event domain schemas — track day events with weather/surface conditions."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TrackCondition(str, Enum):
    """Overall track surface condition."""

    dry = "dry"
    damp = "damp"
    wet = "wet"
    mixed = "mixed"


class ConditionsModel(BaseModel):
    """Weather and track surface conditions stored as validated JSONB."""

    temp_c: float | None = None
    humidity_pct: float | None = None
    track_temp_c: float | None = None
    wind_kph: float | None = None
    condition: TrackCondition | None = None
    notes: str | None = None

    @field_validator("humidity_pct")
    @classmethod
    def validate_humidity(cls, v: float | None) -> float | None:
        if v is not None and not (0 <= v <= 100):
            raise ValueError("humidity_pct must be between 0 and 100")
        return v

    @field_validator("wind_kph")
    @classmethod
    def validate_wind(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("wind_kph must be >= 0")
        return v


# ── Requests ──


class EventCreate(BaseModel):
    """Create a new track day event."""

    bike_id: uuid.UUID
    track_id: uuid.UUID
    date: date
    conditions: ConditionsModel | None = None


class EventUpdate(BaseModel):
    """Partial update to event fields. All fields optional."""

    bike_id: uuid.UUID | None = None
    track_id: uuid.UUID | None = None
    date: date | None = None
    conditions: ConditionsModel | None = None


# ── Responses ──


class EventResponse(BaseModel):
    """Single track day event."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    bike_id: uuid.UUID
    track_id: uuid.UUID
    date: date
    conditions: ConditionsModel
    created_at: datetime
    updated_at: datetime


class EventListResponse(BaseModel):
    """List of events."""

    items: list[EventResponse]
