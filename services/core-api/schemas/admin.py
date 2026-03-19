"""Admin domain schemas — channel alias management for AiM CSV column mapping."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# ── Requests ──


class ChannelAliasCreate(BaseModel):
    """Add a new channel alias mapping."""

    raw_name: str = Field(..., min_length=1, max_length=200)
    canonical_name: str = Field(..., min_length=1, max_length=200)
    logger_model: str | None = Field(None, max_length=100)


class ChannelAliasUpdate(BaseModel):
    """Partial update to a channel alias. All fields optional."""

    raw_name: str | None = Field(None, min_length=1, max_length=200)
    canonical_name: str | None = Field(None, min_length=1, max_length=200)
    logger_model: str | None = Field(None, max_length=100)


# ── Responses ──


class ChannelAliasResponse(BaseModel):
    """Single channel alias."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    raw_name: str
    canonical_name: str
    logger_model: str | None = None
    created_at: datetime


class ChannelAliasListResponse(BaseModel):
    """List of channel aliases."""

    items: list[ChannelAliasResponse]
