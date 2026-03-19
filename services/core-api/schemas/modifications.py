"""Modification domain schemas — parts installed, removed, or changed on a bike."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class ModificationAction(str, Enum):
    """What was done to the part."""

    installed = "installed"
    removed = "removed"
    swapped = "swapped"
    upgraded = "upgraded"
    repaired = "repaired"


class ModificationCategory(str, Enum):
    """System or area of the bike affected."""

    exhaust = "exhaust"
    ecu = "ecu"
    suspension = "suspension"
    brakes = "brakes"
    wheels_tires = "wheels_tires"
    bodywork = "bodywork"
    controls = "controls"
    lighting = "lighting"
    engine = "engine"
    drivetrain = "drivetrain"
    electronics = "electronics"
    ergonomics = "ergonomics"
    other = "other"


# ── Requests ──


class ModificationCreate(BaseModel):
    """Log a new modification on a bike."""

    action: ModificationAction
    category: ModificationCategory
    part_name: str = Field(..., min_length=1, max_length=300)
    brand: str | None = Field(None, max_length=200)
    part_number: str | None = Field(None, max_length=100)
    cost: float | None = None
    currency: str | None = Field("USD", max_length=3)
    installed_at: date
    removed_at: date | None = None
    mileage_km: int | None = None
    notes: str | None = None


class ModificationUpdate(BaseModel):
    """Partial update to a modification record. All fields optional."""

    action: ModificationAction | None = None
    category: ModificationCategory | None = None
    part_name: str | None = Field(None, min_length=1, max_length=300)
    brand: str | None = Field(None, max_length=200)
    part_number: str | None = Field(None, max_length=100)
    cost: float | None = None
    currency: str | None = Field(None, max_length=3)
    installed_at: date | None = None
    removed_at: date | None = None
    mileage_km: int | None = None
    notes: str | None = None


# ── Responses ──


class ModificationResponse(BaseModel):
    """Single modification record."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    bike_id: uuid.UUID
    user_id: uuid.UUID
    action: ModificationAction
    category: ModificationCategory
    part_name: str
    brand: str | None = None
    part_number: str | None = None
    cost: float | None = None
    currency: str | None = "USD"
    installed_at: date
    removed_at: date | None = None
    mileage_km: int | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


class ModificationListResponse(BaseModel):
    """List of modification records."""

    items: list[ModificationResponse]


# ── Filter params ──


class ModificationFilters(BaseModel):
    """Query parameters for filtering modifications."""

    category: ModificationCategory | None = None
    status: str | None = Field(
        None, description="'active' = removed_at IS NULL, 'removed' = removed_at IS NOT NULL"
    )
