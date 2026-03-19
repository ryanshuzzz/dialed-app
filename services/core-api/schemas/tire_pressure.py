"""Tire pressure domain schemas — readings with context and optional session link."""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class TirePressureContext(str, Enum):
    """When in the riding lifecycle the reading was taken."""

    cold = "cold"
    pre_ride = "pre_ride"
    post_ride = "post_ride"
    pit_stop = "pit_stop"
    pre_session = "pre_session"
    post_session = "post_session"


# ── Requests ──


class TirePressureCreate(BaseModel):
    """Log a tire pressure reading."""

    front_psi: float | None = None
    rear_psi: float | None = None
    front_temp_c: float | None = None
    rear_temp_c: float | None = None
    context: TirePressureContext = TirePressureContext.pre_ride
    session_id: uuid.UUID | None = None
    notes: str | None = None
    recorded_at: datetime


# ── Responses ──


class TirePressureResponse(BaseModel):
    """Single tire pressure reading."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    bike_id: uuid.UUID
    user_id: uuid.UUID
    front_psi: float | None = None
    rear_psi: float | None = None
    front_temp_c: float | None = None
    rear_temp_c: float | None = None
    context: TirePressureContext
    session_id: uuid.UUID | None = None
    notes: str | None = None
    recorded_at: datetime
    created_at: datetime


class TirePressureListResponse(BaseModel):
    """List of tire pressure readings."""

    items: list[TirePressureResponse]


# ── Filter params ──


class TirePressureFilters(BaseModel):
    """Query parameters for filtering tire pressure readings."""

    context: TirePressureContext | None = None
    from_date: datetime | None = None
    to_date: datetime | None = None
