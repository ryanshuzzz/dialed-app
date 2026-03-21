"""Tests for routers/telemetry.py — upload, channels, lap data, analysis."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from tests.conftest import BASE_TIME, MockAsyncSession, MockLapSegment, MockResult, SESSION_ID

# ── App setup with dependency overrides ──────────────────────────────────────

_mock_user = {"user_id": str(uuid.uuid4())}


def _make_app():
    """Create a test app with the telemetry router mounted."""
    from routers.telemetry import router
    from dialed_shared.auth import get_current_user
    from dialed_shared.errors import install_exception_handlers

    app = FastAPI()
    install_exception_handlers(app)
    app.include_router(router)

    app.dependency_overrides[get_current_user] = lambda: _mock_user

    return app


# ═══════════════════════ POST /telemetry/upload ══════════════════════════════


@pytest.mark.asyncio
async def test_upload_telemetry():
    """Upload endpoint calls bulk_insert and returns inserted_count."""
    with (
        patch("routers.telemetry.bulk_insert_telemetry", new_callable=AsyncMock, return_value=5) as mock_insert,
        patch("routers.telemetry.get_timescale_session") as mock_ts_dep,
    ):
        mock_session = MockAsyncSession()
        mock_ts_dep.return_value = mock_session

        app = _make_app()
        from db import get_timescale_session
        app.dependency_overrides[get_timescale_session] = lambda: mock_session

        client = TestClient(app)
        body = {
            "session_id": SESSION_ID,
            "points": [
                {
                    "time": "2026-03-18T10:00:00Z",
                    "session_id": SESSION_ID,
                    "gps_speed": 100.0,
                }
                for _ in range(5)
            ],
        }
        resp = client.post("/telemetry/upload", json=body)

    assert resp.status_code == 201
    data = resp.json()
    assert data["inserted_count"] == 5


# ═══════════════════════ GET /telemetry/{sid}/channels ═══════════════════════


@pytest.mark.asyncio
async def test_get_channels():
    """Channel endpoint returns per-channel stats including extra_channels keys."""
    # We need to mock multiple sequential execute() calls.
    mock_session = MockAsyncSession()

    # 1st call: count query returns 100.
    # Then 13 calls for each core channel: (min, max, count).
    # Then 1 call for extra_channels keys (returns 2 extra keys).
    # Then 1 call for time range.
    results = [MockResult(scalar=100)]  # Total count.

    for i in range(13):
        results.append(MockResult(rows=[(10.0 + i, 200.0 + i, 50 + i)]))

    # Extra keys result: two rows with .key and .sample_count attributes.
    extra_key_1 = MagicMock()
    extra_key_1.key = "lambda_afr"
    extra_key_1.sample_count = 20
    extra_key_2 = MagicMock()
    extra_key_2.key = "intake_temp"
    extra_key_2.sample_count = 18
    results.append(MockResult(rows=[extra_key_1, extra_key_2]))

    results.append(MockResult(rows=[(BASE_TIME, BASE_TIME + timedelta(seconds=5))]))

    mock_session.set_results(results)

    app = _make_app()
    from db import get_timescale_session
    app.dependency_overrides[get_timescale_session] = lambda: mock_session

    client = TestClient(app)
    resp = client.get(f"/telemetry/{SESSION_ID}/channels")

    assert resp.status_code == 200
    data = resp.json()
    assert data["total_samples"] == 100
    # 13 core channels + 2 extra_channels keys.
    assert len(data["channels"]) == 15
    channel_names = [c["name"] for c in data["channels"]]
    assert "lambda_afr" in channel_names
    assert "intake_temp" in channel_names
    assert data["channels"][0]["sample_count"] > 0


@pytest.mark.asyncio
async def test_get_channels_no_extra_channels():
    """Channel endpoint works when extra_channels JSONB has no keys."""
    mock_session = MockAsyncSession()

    results = [MockResult(scalar=50)]  # Total count.
    for i in range(13):
        results.append(MockResult(rows=[(10.0 + i, 200.0 + i, 50 + i)]))

    # Extra keys query returns empty list (no extra channels in this session).
    results.append(MockResult(rows=[]))

    results.append(MockResult(rows=[(BASE_TIME, BASE_TIME + timedelta(seconds=5))]))

    mock_session.set_results(results)

    app = _make_app()
    from db import get_timescale_session
    app.dependency_overrides[get_timescale_session] = lambda: mock_session

    client = TestClient(app)
    resp = client.get(f"/telemetry/{SESSION_ID}/channels")

    assert resp.status_code == 200
    data = resp.json()
    # Only the 13 core channels — no extras.
    assert len(data["channels"]) == 13


@pytest.mark.asyncio
async def test_get_channels_no_data():
    """Channel endpoint returns 404 when no data exists."""
    mock_session = MockAsyncSession()
    mock_session.set_results([MockResult(scalar=0)])

    app = _make_app()
    from db import get_timescale_session
    app.dependency_overrides[get_timescale_session] = lambda: mock_session

    client = TestClient(app)
    resp = client.get(f"/telemetry/{SESSION_ID}/channels")

    assert resp.status_code == 404


# ═══════════════════════ GET /telemetry/{sid}/lap/{n} ════════════════════════


@pytest.mark.asyncio
async def test_get_lap_data_full_resolution():
    """Lap data endpoint returns full-res points."""
    lap = MockLapSegment(1, 0, 30000)

    mock_db = MockAsyncSession()
    mock_db.set_results([MockResult(scalar=lap)])

    # TS session: base time query + data query.
    point_rows = []
    for i in range(20):
        t = BASE_TIME + timedelta(milliseconds=i * 50)
        point_rows.append(MagicMock(
            time=t,
            session_id=SESSION_ID,
            coolant_temp=85.0,
            fork_position=30.0,
            front_brake_psi=0.0,
            gear=3,
            gps_speed=100.0 + i,
            lat=40.0,
            lean_angle=-5.0,
            lon=-74.0,
            oil_temp=90.0,
            rear_brake_psi=0.0,
            rpm=8000.0,
            shock_position=20.0,
            throttle_pos=50.0,
            extra_channels={},
        ))

    mock_ts = MockAsyncSession()
    mock_ts.set_results([
        MockResult(scalar=BASE_TIME),
        MockResult(rows=point_rows),
    ])

    app = _make_app()
    from db import get_db_session, get_timescale_session
    app.dependency_overrides[get_db_session] = lambda: mock_db
    app.dependency_overrides[get_timescale_session] = lambda: mock_ts

    client = TestClient(app)
    resp = client.get(f"/telemetry/{SESSION_ID}/lap/1")

    assert resp.status_code == 200
    data = resp.json()
    assert data["lap_number"] == 1
    assert data["lap_time_ms"] == 30000
    assert data["sample_rate_hz"] == 20.0
    assert len(data["points"]) == 20


@pytest.mark.asyncio
async def test_get_lap_data_not_found():
    """Lap data returns 404 when lap doesn't exist."""
    mock_db = MockAsyncSession()
    mock_db.set_results([MockResult(scalar=None)])

    app = _make_app()
    from db import get_db_session, get_timescale_session
    app.dependency_overrides[get_db_session] = lambda: mock_db
    app.dependency_overrides[get_timescale_session] = lambda: MockAsyncSession()

    client = TestClient(app)
    resp = client.get(f"/telemetry/{SESSION_ID}/lap/99")

    assert resp.status_code == 404


# ═══════════════════════ GET /telemetry/{sid}/analysis ═══════════════════════


@pytest.mark.asyncio
async def test_get_analysis():
    """Analysis endpoint returns combined results."""
    mock_analysis_result = {
        "session_id": SESSION_ID,
        "lap_segments": [],
        "best_lap": None,
        "braking_zones": [],
        "fork_rebound": {"avg_rebound_rate": None, "max_compression_mm": None},
        "tcs_events": [],
    }

    mock_ts = MockAsyncSession()
    mock_ts.set_results([MockResult(scalar=10)])  # Count check.

    with patch("routers.telemetry.run_analysis", new_callable=AsyncMock, return_value=mock_analysis_result):
        app = _make_app()
        from db import get_db_session, get_timescale_session
        app.dependency_overrides[get_db_session] = lambda: MockAsyncSession()
        app.dependency_overrides[get_timescale_session] = lambda: mock_ts

        client = TestClient(app)
        resp = client.get(f"/telemetry/{SESSION_ID}/analysis")

    assert resp.status_code == 200
    data = resp.json()
    assert data["session_id"] == SESSION_ID
    assert "braking_zones" in data
    assert "fork_rebound" in data
    assert "tcs_events" in data


@pytest.mark.asyncio
async def test_get_analysis_no_data():
    """Analysis returns 404 when no telemetry exists."""
    mock_ts = MockAsyncSession()
    mock_ts.set_results([MockResult(scalar=0)])

    app = _make_app()
    from db import get_db_session, get_timescale_session
    app.dependency_overrides[get_db_session] = lambda: MockAsyncSession()
    app.dependency_overrides[get_timescale_session] = lambda: mock_ts

    client = TestClient(app)
    resp = client.get(f"/telemetry/{SESSION_ID}/analysis")

    assert resp.status_code == 404
