"""Maintenance domain schemas — log entries and upcoming reminders."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class MaintenanceCategory(str, Enum):
    """Type of maintenance performed."""

    oil_change = "oil_change"
    coolant = "coolant"
    brake_fluid = "brake_fluid"
    chain = "chain"
    air_filter = "air_filter"
    spark_plugs = "spark_plugs"
    valve_check = "valve_check"
    brake_pads = "brake_pads"
    battery = "battery"
    general_service = "general_service"
    other = "other"


# ── Requests ──


class MaintenanceCreate(BaseModel):
    """Log a new maintenance entry for a bike."""

    category: MaintenanceCategory
    description: str | None = None
    mileage_km: int | None = None
    engine_hours: float | None = None
    cost: float | None = None
    currency: str | None = Field("USD", max_length=3)
    performed_by: str | None = None
    performed_at: date
    next_due_km: int | None = None
    next_due_date: date | None = None
    notes: str | None = None
    receipt_url: str | None = None


class MaintenanceUpdate(BaseModel):
    """Partial update to a maintenance log entry. All fields optional."""

    category: MaintenanceCategory | None = None
    description: str | None = None
    mileage_km: int | None = None
    engine_hours: float | None = None
    cost: float | None = None
    currency: str | None = Field(None, max_length=3)
    performed_by: str | None = None
    performed_at: date | None = None
    next_due_km: int | None = None
    next_due_date: date | None = None
    notes: str | None = None
    receipt_url: str | None = None


# ── Responses ──


class MaintenanceResponse(BaseModel):
    """Single maintenance log entry."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    bike_id: uuid.UUID
    user_id: uuid.UUID
    category: MaintenanceCategory
    description: str | None = None
    mileage_km: int | None = None
    engine_hours: float | None = None
    cost: float | None = None
    currency: str | None = "USD"
    performed_by: str | None = None
    performed_at: date
    next_due_km: int | None = None
    next_due_date: date | None = None
    notes: str | None = None
    receipt_url: str | None = None
    created_at: datetime
    updated_at: datetime


class MaintenanceListResponse(BaseModel):
    """List of maintenance log entries."""

    items: list[MaintenanceResponse]


class UpcomingMaintenanceItem(BaseModel):
    """A single upcoming maintenance item."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    bike_id: uuid.UUID
    category: MaintenanceCategory
    performed_at: date
    next_due_km: int | None = None
    next_due_date: date | None = None
    current_mileage_km: int | None = None


class UpcomingMaintenanceResponse(BaseModel):
    """Maintenance items that are due soon by km or date."""

    items: list[UpcomingMaintenanceItem]
