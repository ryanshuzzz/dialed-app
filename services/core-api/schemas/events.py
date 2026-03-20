"""Event domain schemas — track days and road outings with conditions JSONB."""

import datetime as _dt
import uuid
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TrackCondition(str, Enum):
    """Overall track surface condition."""

    dry = "dry"
    damp = "damp"
    wet = "wet"
    mixed = "mixed"


class EventVenue(str, Enum):
    track = "track"
    road = "road"


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


class RideLocationSourceModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["manual", "gpx", "map_match", "telemetry", "imported"]
    ref: str | None = None
    captured_at: _dt.datetime | None = None
    notes: str | None = None


class RideLocationModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str | None = None
    notes: str | None = None
    sources: list[RideLocationSourceModel] | None = None
    approximate_lat: float | None = Field(None, ge=-90, le=90)
    approximate_lon: float | None = Field(None, ge=-180, le=180)


# ── Requests ──


class EventCreate(BaseModel):
    """Create a track day or road outing event."""

    model_config = ConfigDict(extra="forbid")

    bike_id: uuid.UUID
    date: _dt.date
    venue: EventVenue | None = None
    track_id: uuid.UUID | None = None
    ride_location: RideLocationModel | None = None
    conditions: ConditionsModel | None = None


class EventUpdate(BaseModel):
    """Partial update to event fields. All fields optional."""

    model_config = ConfigDict(extra="forbid")

    bike_id: uuid.UUID | None = None
    venue: EventVenue | None = None
    track_id: uuid.UUID | None = None
    ride_location: RideLocationModel | None = None
    date: _dt.date | None = None
    conditions: ConditionsModel | None = None


# ── Responses ──


class EventResponse(BaseModel):
    """Single event (track or road)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    bike_id: uuid.UUID
    venue: EventVenue
    track_id: uuid.UUID | None = None
    ride_location: RideLocationModel | None = None
    date: _dt.date
    conditions: ConditionsModel
    created_at: _dt.datetime
    updated_at: _dt.datetime


class EventListResponse(BaseModel):
    """List of events."""

    items: list[EventResponse]
