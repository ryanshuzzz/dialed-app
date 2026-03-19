"""Shared fixtures for telemetry-ingestion tests."""

from __future__ import annotations

import json
import os
import tempfile
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import Response

# ── Constants ────────────────────────────────────────────────────────────────

SESSION_ID = str(uuid.uuid4())
JOB_ID = str(uuid.uuid4())
USER_ID = str(uuid.uuid4())
INTERNAL_TOKEN = "test-internal-token"
BASE_TIME = datetime(2026, 3, 18, 10, 0, 0, tzinfo=timezone.utc)


# ── Channel alias fixtures ───────────────────────────────────────────────────


@pytest.fixture
def channel_aliases() -> list[dict[str, Any]]:
    """Sample Core API /admin/channel-aliases response."""
    return [
        {"id": str(uuid.uuid4()), "raw_name": "GPS Speed", "canonical_name": "gps_speed", "logger_model": None, "created_at": "2026-01-01T00:00:00Z"},
        {"id": str(uuid.uuid4()), "raw_name": "GPS_Speed", "canonical_name": "gps_speed", "logger_model": "AiM EVO5", "created_at": "2026-01-01T00:00:00Z"},
        {"id": str(uuid.uuid4()), "raw_name": "Throttle", "canonical_name": "throttle_pos", "logger_model": None, "created_at": "2026-01-01T00:00:00Z"},
        {"id": str(uuid.uuid4()), "raw_name": "TPS", "canonical_name": "throttle_pos", "logger_model": "AiM EVO5", "created_at": "2026-01-01T00:00:00Z"},
        {"id": str(uuid.uuid4()), "raw_name": "Engine RPM", "canonical_name": "rpm", "logger_model": None, "created_at": "2026-01-01T00:00:00Z"},
        {"id": str(uuid.uuid4()), "raw_name": "Gear", "canonical_name": "gear", "logger_model": None, "created_at": "2026-01-01T00:00:00Z"},
        {"id": str(uuid.uuid4()), "raw_name": "Lean Angle", "canonical_name": "lean_angle", "logger_model": None, "created_at": "2026-01-01T00:00:00Z"},
        {"id": str(uuid.uuid4()), "raw_name": "Front Brake", "canonical_name": "front_brake_psi", "logger_model": None, "created_at": "2026-01-01T00:00:00Z"},
        {"id": str(uuid.uuid4()), "raw_name": "Rear Brake", "canonical_name": "rear_brake_psi", "logger_model": None, "created_at": "2026-01-01T00:00:00Z"},
        {"id": str(uuid.uuid4()), "raw_name": "Fork Pos", "canonical_name": "fork_position", "logger_model": None, "created_at": "2026-01-01T00:00:00Z"},
        {"id": str(uuid.uuid4()), "raw_name": "Shock Pos", "canonical_name": "shock_position", "logger_model": None, "created_at": "2026-01-01T00:00:00Z"},
        {"id": str(uuid.uuid4()), "raw_name": "Coolant Temp", "canonical_name": "coolant_temp", "logger_model": None, "created_at": "2026-01-01T00:00:00Z"},
        {"id": str(uuid.uuid4()), "raw_name": "Oil Temp", "canonical_name": "oil_temp", "logger_model": None, "created_at": "2026-01-01T00:00:00Z"},
        {"id": str(uuid.uuid4()), "raw_name": "Latitude", "canonical_name": "lat", "logger_model": None, "created_at": "2026-01-01T00:00:00Z"},
        {"id": str(uuid.uuid4()), "raw_name": "Longitude", "canonical_name": "lon", "logger_model": None, "created_at": "2026-01-01T00:00:00Z"},
        {"id": str(uuid.uuid4()), "raw_name": "Lambda", "canonical_name": "lambda_afr", "logger_model": None, "created_at": "2026-01-01T00:00:00Z"},
    ]


@pytest.fixture
def alias_dict(channel_aliases) -> dict[str, str]:
    """Pre-built alias mapping as returned by fetch_channel_aliases."""
    mapping: dict[str, str] = {}
    for a in channel_aliases:
        if a.get("logger_model"):
            mapping[f"{a['logger_model']}:{a['raw_name']}"] = a["canonical_name"]
        mapping[a["raw_name"]] = a["canonical_name"]
    return mapping


# ── CSV file fixtures ────────────────────────────────────────────────────────


@pytest.fixture
def valid_csv_path(tmp_path) -> str:
    """A valid AiM-style CSV with beacon column and 20 rows (1 second at 20Hz)."""
    path = tmp_path / "valid.csv"
    headers = "Time,GPS Speed,Throttle,Engine RPM,Gear,Lean Angle,Front Brake,Rear Brake,Fork Pos,Shock Pos,Coolant Temp,Oil Temp,Latitude,Longitude,Beacon,Lambda\n"
    rows = []
    for i in range(20):
        t = (BASE_TIME + timedelta(milliseconds=i * 50)).isoformat()
        speed = 100 + i
        throttle = 50 + i
        rpm = 8000 + i * 100
        gear = 3
        lean = -5.0 + i * 0.5
        fb = 0.0 if i < 5 else 50.0 if i < 10 else 0.0
        rb = 0.0
        fork = 30.0 - i * 0.5
        shock = 20.0
        ct = 85.0
        ot = 90.0
        lat = 40.0
        lon = -74.0
        beacon = 1.0 if i in (0, 10) else 0.0
        lam = 14.7
        rows.append(f"{t},{speed},{throttle},{rpm},{gear},{lean},{fb},{rb},{fork},{shock},{ct},{ot},{lat},{lon},{beacon},{lam}")
    path.write_text(headers + "\n".join(rows))
    return str(path)


@pytest.fixture
def aim_evo5_csv_path(tmp_path) -> str:
    """CSV with AiM EVO5-specific column names."""
    path = tmp_path / "evo5.csv"
    headers = "Timestamp,GPS_Speed,TPS,Engine RPM,Gear\n"
    rows = []
    for i in range(10):
        t = (BASE_TIME + timedelta(milliseconds=i * 50)).isoformat()
        rows.append(f"{t},{100 + i},{50 + i},{8000 + i * 100},{3}")
    path.write_text(headers + "\n".join(rows))
    return str(path)


@pytest.fixture
def empty_csv_path(tmp_path) -> str:
    """An empty CSV file."""
    path = tmp_path / "empty.csv"
    path.write_text("")
    return str(path)


@pytest.fixture
def headers_only_csv_path(tmp_path) -> str:
    """CSV with headers but no data rows."""
    path = tmp_path / "headers_only.csv"
    path.write_text("Time,GPS Speed,Throttle\n")
    return str(path)


@pytest.fixture
def no_channels_csv_path(tmp_path) -> str:
    """CSV with only a time column and no data channels."""
    path = tmp_path / "no_channels.csv"
    path.write_text("Time\n2026-01-01T00:00:00Z\n")
    return str(path)


@pytest.fixture
def malformed_csv_path(tmp_path) -> str:
    """CSV with malformed values in data rows."""
    path = tmp_path / "malformed.csv"
    content = "Time,GPS Speed,Throttle\n"
    content += "2026-01-01T00:00:00Z,abc,50\n"
    content += "2026-01-01T00:00:00.050Z,,75\n"
    content += "2026-01-01T00:00:00.100Z,120,notanumber\n"
    path.write_text(content)
    return str(path)


# ── Image / audio file fixtures ──────────────────────────────────────────────


@pytest.fixture
def test_image_path(tmp_path) -> str:
    """A tiny valid JPEG file (minimal header)."""
    path = tmp_path / "setup_sheet.jpg"
    # Minimal JPEG: SOI marker + some bytes.
    path.write_bytes(b"\xff\xd8\xff\xe0" + b"\x00" * 100 + b"\xff\xd9")
    return str(path)


@pytest.fixture
def test_audio_path(tmp_path) -> str:
    """A tiny MP3 file stub."""
    path = tmp_path / "voice_note.mp3"
    # MP3 frame sync header + minimal data.
    path.write_bytes(b"\xff\xfb\x90\x00" + b"\x00" * 200)
    return str(path)


@pytest.fixture
def empty_image_path(tmp_path) -> str:
    """An empty image file."""
    path = tmp_path / "empty.jpg"
    path.write_bytes(b"")
    return str(path)


@pytest.fixture
def unsupported_image_path(tmp_path) -> str:
    """An image file with unsupported extension."""
    path = tmp_path / "photo.bmp"
    path.write_bytes(b"BM" + b"\x00" * 100)
    return str(path)


# ── Mock API responses ───────────────────────────────────────────────────────


@pytest.fixture
def mock_anthropic_response() -> dict:
    """A Claude Vision API response with extracted settings."""
    return {
        "id": "msg_test",
        "type": "message",
        "role": "assistant",
        "content": [
            {
                "type": "text",
                "text": json.dumps({
                    "schema_version": 1,
                    "front": {
                        "compression": 12,
                        "rebound": 8,
                        "preload": 5,
                        "spring_rate": None,
                        "oil_level": 120,
                        "ride_height": None,
                    },
                    "rear": {
                        "compression": 10,
                        "rebound": 6,
                        "preload": 3,
                        "spring_rate": None,
                        "oil_level": None,
                        "ride_height": None,
                    },
                    "confidence": 0.85,
                }),
            }
        ],
        "model": "claude-sonnet-4-6",
        "stop_reason": "end_turn",
        "usage": {"input_tokens": 100, "output_tokens": 50},
    }


@pytest.fixture
def mock_whisper_transcript() -> str:
    """A Whisper API transcript with setting mentions and lap times."""
    return (
        "Okay so after that last session I added 2 clicks of front rebound "
        "and removed 1 click of rear compression. The bike felt much better "
        "through turn 3. Best lap was 1:32.456. Front compression is at 12. "
        "Rear rebound to 8."
    )


# ── Mock database sessions ───────────────────────────────────────────────────


class MockResult:
    """Minimal mock for SQLAlchemy result proxy."""

    def __init__(self, rows=None, scalar=None):
        self._rows = rows or []
        self._scalar = scalar

    def all(self):
        return self._rows

    def scalar_one_or_none(self):
        return self._scalar

    def scalar(self):
        return self._scalar

    def scalars(self):
        return self

    def one(self):
        if self._rows:
            return self._rows[0]
        raise Exception("No rows")


class MockAsyncSession:
    """A mock async database session for unit tests."""

    def __init__(self):
        self.execute = AsyncMock(return_value=MockResult())
        self.commit = AsyncMock()
        self.add = MagicMock()
        self._results = []
        self._result_idx = 0

    def set_results(self, results: list[MockResult]):
        """Set sequential results for consecutive execute() calls."""
        self._results = results
        self._result_idx = 0

        async def _execute(*args, **kwargs):
            if self._result_idx < len(self._results):
                result = self._results[self._result_idx]
                self._result_idx += 1
                return result
            return MockResult()

        self.execute = AsyncMock(side_effect=_execute)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass


@pytest.fixture
def mock_db_session():
    return MockAsyncSession()


@pytest.fixture
def mock_ts_session():
    return MockAsyncSession()


# ── Mock LapSegment objects ──────────────────────────────────────────────────


class MockLapSegment:
    """A mock LapSegment for analyser tests."""

    def __init__(self, lap_number, start_time_ms, end_time_ms, **kwargs):
        self.id = str(uuid.uuid4())
        self.session_id = SESSION_ID
        self.lap_number = lap_number
        self.start_time_ms = start_time_ms
        self.end_time_ms = end_time_ms
        self.lap_time_ms = end_time_ms - start_time_ms
        self.beacon_start_s = kwargs.get("beacon_start_s")
        self.beacon_end_s = kwargs.get("beacon_end_s")
        self.created_at = BASE_TIME


@pytest.fixture
def sample_laps() -> list[MockLapSegment]:
    """Two laps, each 30 seconds."""
    return [
        MockLapSegment(1, 0, 30000),
        MockLapSegment(2, 30000, 60000),
    ]
