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
    """Settings for one end of suspension (front fork or rear shock).

    Domain-specific names (compression_clicks, rebound_clicks, preload_turns,
    spring_rate_nmm, fork_height_mm) are canonical. The generic names used in
    the original schema (compression, rebound, preload, spring_rate) are accepted
    as input aliases for backwards compatibility.
    """

    model_config = ConfigDict(populate_by_name=True)

    brand: str | None = None

    # Damping — domain name is canonical, generic name accepted as alias
    compression_clicks: float | None = Field(None)
    rebound_clicks: float | None = Field(None)

    # Preload
    preload_turns: float | None = Field(None)

    # Spring
    spring_rate_nmm: float | None = Field(None)

    # Fork-specific geometry
    fork_height_mm: float | None = None
    oil_level: float | None = None
    ride_height: float | None = None

    @model_validator(mode="before")
    @classmethod
    def _accept_generic_aliases(cls, data: object) -> object:
        """Map legacy generic field names to domain-specific names on input."""
        if not isinstance(data, dict):
            return data
        d = dict(data)
        for generic, specific in (
            ("compression", "compression_clicks"),
            ("rebound", "rebound_clicks"),
            ("preload", "preload_turns"),
            ("spring_rate", "spring_rate_nmm"),
        ):
            if generic in d and specific not in d:
                d[specific] = d.pop(generic)
        return d


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
    last_maintenance_date: date | None = None
    modification_count: int = 0
    active_mods_count: int = 0
    session_count: int = 0
    best_lap_ms: int | None = None
    tire_pressure_last_checked: datetime | None = None


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
