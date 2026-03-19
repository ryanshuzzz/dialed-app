"""Auth domain schemas — registration, login, tokens, profile, and API keys."""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class SkillLevel(str, Enum):
    """Rider self-assessed skill level."""

    novice = "novice"
    intermediate = "intermediate"
    expert = "expert"


class RiderType(str, Enum):
    """Primary riding context — controls default UI layout."""

    street = "street"
    casual_track = "casual_track"
    competitive = "competitive"


class Units(str, Enum):
    """Preferred unit system."""

    metric = "metric"
    imperial = "imperial"


# ── Auth requests ──


class RegisterRequest(BaseModel):
    """Register a new user account."""

    email: EmailStr
    password: str = Field(..., min_length=8)
    display_name: str | None = None


class LoginRequest(BaseModel):
    """Authenticate with email and password."""

    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    """Obtain a new access token using a refresh token."""

    refresh_token: str


# ── Auth responses ──


class TokenResponse(BaseModel):
    """Returned after successful registration or login."""

    user_id: uuid.UUID
    token: str
    refresh_token: str


class RefreshResponse(BaseModel):
    """Returned after a successful token refresh."""

    token: str


class UserProfile(BaseModel):
    """Authenticated user's profile (GET /auth/me)."""

    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    email: EmailStr
    display_name: str | None = None
    skill_level: SkillLevel
    rider_type: RiderType
    units: Units


class UpdateProfileRequest(BaseModel):
    """Partial update to the user's profile fields."""

    display_name: str | None = None
    skill_level: SkillLevel | None = None
    rider_type: RiderType | None = None
    units: Units | None = None


# ── API Key schemas ──


class ApiKeyCreateRequest(BaseModel):
    """Create a new named API key."""

    name: str = Field(..., min_length=1, max_length=255)
    expires_at: datetime | None = None


class ApiKeyCreateResponse(BaseModel):
    """Returned after API key creation — raw key is only shown once."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    key: str = Field(..., description="Raw API key — only returned at creation time")
    expires_at: datetime | None = None
    created_at: datetime


class ApiKeySummary(BaseModel):
    """API key listing entry — key_hash is never exposed, name is shown in full."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    last_used_at: datetime | None = None
    expires_at: datetime | None = None
    created_at: datetime


class ApiKeyListResponse(BaseModel):
    """List of API keys for the authenticated user."""

    items: list[ApiKeySummary]
