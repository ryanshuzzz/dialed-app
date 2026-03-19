"""Pydantic schemas for telemetry endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


# ── Telemetry points ─────────────────────────────────────────────────────────


class TelemetryPointSchema(BaseModel):
    """A single 20Hz telemetry sample."""

    time: datetime
    session_id: UUID
    gps_speed: float | None = None
    throttle_pos: float | None = Field(default=None, ge=0, le=100)
    rpm: float | None = None
    gear: int | None = Field(default=None, ge=0)
    lean_angle: float | None = None
    front_brake_psi: float | None = None
    rear_brake_psi: float | None = None
    fork_position: float | None = None
    shock_position: float | None = None
    coolant_temp: float | None = None
    oil_temp: float | None = None
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)
    extra_channels: dict[str, float | None] | None = None

    model_config = {"from_attributes": True}


class TelemetryUploadRequest(BaseModel):
    """Request body for POST /telemetry/upload."""

    session_id: UUID
    points: list[TelemetryPointSchema]


class TelemetryUploadResponse(BaseModel):
    """Response for POST /telemetry/upload (201)."""

    inserted_count: int


# ── Channel summary ──────────────────────────────────────────────────────────


class ChannelInfo(BaseModel):
    """Summary stats for a single channel."""

    name: str
    min: float | None
    max: float | None
    sample_count: int


class TimeRange(BaseModel):
    """Start/end timestamps for a session's telemetry data."""

    start: datetime
    end: datetime


class ChannelSummaryResponse(BaseModel):
    """Response for GET /telemetry/{session_id}/channels (200)."""

    channels: list[ChannelInfo]
    total_samples: int
    time_range: TimeRange | None = None


# ── Lap data ─────────────────────────────────────────────────────────────────


class LapSegmentResponse(BaseModel):
    """A single lap segment in analysis results."""

    id: UUID
    session_id: UUID
    lap_number: int = Field(ge=1)
    start_time_ms: int
    end_time_ms: int
    lap_time_ms: int
    beacon_start_s: float | None = None
    beacon_end_s: float | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class LapDataResponse(BaseModel):
    """Response for GET /telemetry/{session_id}/lap/{lap_number} (200)."""

    session_id: UUID
    lap_number: int = Field(ge=1)
    lap_time_ms: int | None = None
    sample_rate_hz: float | None = None
    points: list[TelemetryPointSchema]


# ── Analysis ─────────────────────────────────────────────────────────────────


class BestLap(BaseModel):
    lap_number: int
    lap_time_ms: int


class BrakingZone(BaseModel):
    zone_id: int
    entry_speed_kph: float
    exit_speed_kph: float
    max_brake_psi: float
    duration_ms: int


class ForkRebound(BaseModel):
    avg_rebound_rate: float | None = None
    max_compression_mm: float | None = None


class TcsEvent(BaseModel):
    time: datetime
    lap_number: int
    duration_ms: int
    throttle_pos_at_trigger: float


class AnalysisResponse(BaseModel):
    """Response for GET /telemetry/{session_id}/analysis (200)."""

    session_id: UUID
    lap_segments: list[LapSegmentResponse] = []
    best_lap: BestLap | None = None
    braking_zones: list[BrakingZone] = []
    fork_rebound: ForkRebound | None = None
    tcs_events: list[TcsEvent] = []
