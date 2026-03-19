"""Progress domain schemas — lap trends, efficacy analytics, session history."""

from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel, Field


# ── Lap trend ──


class LapTrendItem(BaseModel):
    """A single data point in the lap time trend."""

    session_id: uuid.UUID
    date: date
    track_name: str
    best_lap_ms: int | None = None


class BestLapByTrack(BaseModel):
    """Best lap time for a specific track."""

    track_id: uuid.UUID
    track_name: str
    best_lap_ms: int
    session_id: uuid.UUID
    date: date


class LapTrendResponse(BaseModel):
    """Lap time trends, best laps per track, and total time found."""

    lap_time_trend: list[LapTrendItem] = []
    best_laps_by_track: list[BestLapByTrack] = []
    total_time_found_ms: int = 0


# ── Efficacy ──


class AvgDeltaByStatus(BaseModel):
    """Average lap delta broken down by suggestion applied status."""

    applied: float | None = None
    applied_modified: float | None = None
    skipped: float | None = None


class EfficacyResponse(BaseModel):
    """Suggestion adoption rate and average delta by applied_status."""

    total_suggestions: int = 0
    adoption_rate: float = 0.0
    avg_delta_by_status: AvgDeltaByStatus = Field(default_factory=AvgDeltaByStatus)


# ── Session history ──


class SessionHistoryItem(BaseModel):
    """A session in the history timeline with delta from previous at same track."""

    session_id: uuid.UUID
    event_id: uuid.UUID
    date: date
    track_name: str
    session_type: str
    best_lap_ms: int | None = None
    delta_from_previous_ms: int | None = None


class SessionHistoryResponse(BaseModel):
    """Session history with time deltas between sessions at the same track."""

    sessions: list[SessionHistoryItem] = []
