"""Bike domain schemas — CRUD, suspension spec, and summary stats."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class BikeStatus(str, Enum):
    """Current ownership / availability status."""

    owned = "owned"
    sold = "sold"
    stored = "stored"
    in_repair = "in_repair"


# ── Suspension spec ──


class SuspensionEndSettings(BaseModel):
    """Settings for one end of suspension (front fork or rear shock)."""

    compression: float | None = None
    rebound: float | None = None
    preload: float | None = None
    spring_rate: float | None = None
    oil_level: float | None = None
    ride_height: float | None = None


class SuspensionSpec(BaseModel):
    """Versioned suspension specification stored as JSONB. schema_version must be 1."""

    schema_version: int = Field(..., description="Must be 1")
    front: SuspensionEndSettings | None = None
    rear: SuspensionEndSettings | None = None

    @field_validator("schema_version")
    @classmethod
    def validate_schema_version(cls, v: int) -> int:
        if v != 1:
            raise ValueError("schema_version must be 1")
        return v


# ── Bike requests ──


class BikeCreate(BaseModel):
    """Add a new bike to the garage."""

    make: str = Field(..., min_length=1, max_length=100)
    model: str = Field(..., min_length=1, max_length=100)
    year: int | None = None
    vin: str | None = Field(None, max_length=17)
    color: str | None = Field(None, max_length=50)
    mileage_km: int | None = None
    engine_hours: float | None = None
    exhaust: str | None = None
    ecu: str | None = None
    gearing_front: int | None = None
    gearing_rear: int | None = None
    suspension_spec: SuspensionSpec | None = None
    notes: str | None = None
    status: BikeStatus = BikeStatus.owned


class BikeUpdate(BaseModel):
    """Partial update to bike fields. All fields optional."""

    make: str | None = Field(None, min_length=1, max_length=100)
    model: str | None = Field(None, min_length=1, max_length=100)
    year: int | None = None
    vin: str | None = Field(None, max_length=17)
    color: str | None = Field(None, max_length=50)
    mileage_km: int | None = None
    engine_hours: float | None = None
    exhaust: str | None = None
    ecu: str | None = None
    gearing_front: int | None = None
    gearing_rear: int | None = None
    suspension_spec: SuspensionSpec | None = None
    notes: str | None = None
    status: BikeStatus | None = None


# ── Bike responses ──


class BikeStats(BaseModel):
    """Computed summary statistics for a bike."""

    maintenance_count: int = 0
    modification_count: int = 0
    session_count: int = 0
    best_lap_ms: int | None = None


class BikeResponse(BaseModel):
    """Single bike with all fields."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    make: str
    model: str
    year: int | None = None
    vin: str | None = None
    color: str | None = None
    mileage_km: int | None = None
    engine_hours: float | None = None
    exhaust: str | None = None
    ecu: str | None = None
    gearing_front: int | None = None
    gearing_rear: int | None = None
    suspension_spec: SuspensionSpec
    notes: str | None = None
    status: BikeStatus
    deleted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class BikeDetailResponse(BikeResponse):
    """Bike with summary stats (GET /garage/bikes/:id)."""

    stats: BikeStats = Field(default_factory=BikeStats)


class BikeListResponse(BaseModel):
    """List of bikes returned by GET /garage/bikes."""

    items: list[BikeResponse]
