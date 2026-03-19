"""Ownership domain schemas — purchase, sale, and transfer timeline."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class OwnershipEventType(str, Enum):
    """The nature of the ownership transaction."""

    purchased = "purchased"
    sold = "sold"
    traded = "traded"
    gifted = "gifted"
    transferred = "transferred"


# ── Requests ──


class OwnershipEventCreate(BaseModel):
    """Log an ownership event for a bike."""

    event_type: OwnershipEventType
    date: date
    price: float | None = None
    currency: str | None = Field("USD", max_length=3)
    mileage_km: int | None = None
    counterparty: str | None = Field(None, max_length=300)
    notes: str | None = None


# ── Responses ──


class OwnershipEventResponse(BaseModel):
    """Single ownership event."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    bike_id: uuid.UUID
    user_id: uuid.UUID
    event_type: OwnershipEventType
    date: date
    price: float | None = None
    currency: str | None = "USD"
    mileage_km: int | None = None
    counterparty: str | None = None
    notes: str | None = None
    created_at: datetime


class OwnershipTimelineResponse(BaseModel):
    """Ownership timeline for a bike, ordered by date descending."""

    items: list[OwnershipEventResponse]
