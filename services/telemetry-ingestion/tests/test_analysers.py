"""Tests for analysers — braking zones, fork rebound, TCS detection."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest

from analysers.braking_zones import analyse_braking
from analysers.fork_rebound import analyse_fork
from analysers.tcs_detector import detect_tcs
from tests.conftest import BASE_TIME, MockAsyncSession, MockLapSegment, MockResult, SESSION_ID


def _make_session_with_data(base_time_result, lap_data_rows):
    """Build a MockAsyncSession that returns base_time then lap data."""
    session = MockAsyncSession()
    session.set_results([
        MockResult(scalar=base_time_result),
        MockResult(rows=lap_data_rows),
    ])
    return session


# ═══════════════════════ Braking zones ═══════════════════════════════════════


class TestBrakingZones:
    @pytest.mark.asyncio
    async def test_detects_braking_zone(self):
        """Contiguous brake pressure above threshold → braking zone."""
        laps = [MockLapSegment(1, 0, 5000)]

        # 100 points over 5 seconds at 20Hz.
        # Points 20-30 (1-1.5s) have brake pressure above threshold.
        rows = []
        for i in range(100):
            t = BASE_TIME + timedelta(milliseconds=i * 50)
            if 20 <= i <= 30:
                brake_psi = 50.0 + i
                speed = 150.0 - (i - 20) * 5  # Decelerating.
            else:
                brake_psi = 0.0
                speed = 150.0
            rows.append((t, brake_psi, speed))

        session = _make_session_with_data(BASE_TIME, rows)
        zones = await analyse_braking(session, SESSION_ID, laps)

        assert len(zones) == 1
        zone = zones[0]
        assert zone["zone_id"] == 1
        assert zone["lap_number"] == 1
        assert zone["max_brake_psi"] > 50.0
        assert zone["entry_speed_kph"] == 150.0
        assert zone["exit_speed_kph"] < 150.0
        assert zone["duration_ms"] > 0

    @pytest.mark.asyncio
    async def test_filters_short_braking(self):
        """Braking events shorter than MIN_BRAKE_SAMPLES are filtered out."""
        laps = [MockLapSegment(1, 0, 2000)]

        # Only 2 points above threshold (below minimum of 3).
        rows = []
        for i in range(40):
            t = BASE_TIME + timedelta(milliseconds=i * 50)
            brake_psi = 50.0 if i in (10, 11) else 0.0
            rows.append((t, brake_psi, 100.0))

        session = _make_session_with_data(BASE_TIME, rows)
        zones = await analyse_braking(session, SESSION_ID, laps)

        assert len(zones) == 0

    @pytest.mark.asyncio
    async def test_no_laps_returns_empty(self):
        session = MockAsyncSession()
        zones = await analyse_braking(session, SESSION_ID, [])
        assert zones == []

    @pytest.mark.asyncio
    async def test_no_telemetry_returns_empty(self):
        laps = [MockLapSegment(1, 0, 5000)]
        session = MockAsyncSession()
        session.set_results([MockResult(scalar=None)])

        zones = await analyse_braking(session, SESSION_ID, laps)
        assert zones == []

    @pytest.mark.asyncio
    async def test_multiple_zones_per_lap(self):
        """Two separate braking events in one lap → two zones."""
        laps = [MockLapSegment(1, 0, 5000)]

        rows = []
        for i in range(100):
            t = BASE_TIME + timedelta(milliseconds=i * 50)
            # Zone 1: points 10-15, Zone 2: points 50-58.
            if 10 <= i <= 15 or 50 <= i <= 58:
                brake_psi = 60.0
            else:
                brake_psi = 0.0
            rows.append((t, brake_psi, 120.0))

        session = _make_session_with_data(BASE_TIME, rows)
        zones = await analyse_braking(session, SESSION_ID, laps)

        assert len(zones) == 2
        assert zones[0]["zone_id"] == 1
        assert zones[1]["zone_id"] == 2


# ═══════════════════════ Fork rebound ════════════════════════════════════════


class TestForkRebound:
    @pytest.mark.asyncio
    async def test_rebound_rate_calculated(self):
        """Fork position decreasing → rebound rate should be positive."""
        laps = [MockLapSegment(1, 0, 2000)]

        # Simulate compression then rebound.
        rows = []
        for i in range(40):
            t = BASE_TIME + timedelta(milliseconds=i * 50)
            if i < 10:
                pos = 5.0 + i * 3.0  # Compressing (0→35mm).
            elif i < 20:
                pos = 35.0 - (i - 10) * 3.0  # Rebounding (35→5mm).
            else:
                pos = 5.0  # Static.
            rows.append((t, pos))

        session = _make_session_with_data(BASE_TIME, rows)
        result = await analyse_fork(session, SESSION_ID, laps)

        assert result["max_compression_mm"] == 35.0
        assert result["avg_rebound_rate"] is not None
        assert result["avg_rebound_rate"] > 0
        assert len(result["per_lap"]) == 1
        assert result["per_lap"][0]["lap_number"] == 1

    @pytest.mark.asyncio
    async def test_no_laps_returns_nulls(self):
        session = MockAsyncSession()
        result = await analyse_fork(session, SESSION_ID, [])

        assert result["avg_rebound_rate"] is None
        assert result["max_compression_mm"] is None
        assert result["per_lap"] == []

    @pytest.mark.asyncio
    async def test_null_positions_skipped(self):
        """Null fork_position values should not crash."""
        laps = [MockLapSegment(1, 0, 1000)]

        rows = [(BASE_TIME + timedelta(milliseconds=i * 50), None) for i in range(20)]
        session = _make_session_with_data(BASE_TIME, rows)
        result = await analyse_fork(session, SESSION_ID, laps)

        # Not enough non-null positions for analysis.
        assert result["avg_rebound_rate"] is None


# ═══════════════════════ TCS detection ═══════════════════════════════════════


class TestTcsDetector:
    @pytest.mark.asyncio
    async def test_detects_tcs_event(self):
        """RPM drops with steady throttle → TCS event detected."""
        laps = [MockLapSegment(1, 0, 5000)]

        rows = []
        for i in range(100):
            t = BASE_TIME + timedelta(milliseconds=i * 50)
            throttle = 80.0  # Constant high throttle.

            if i < 30:
                rpm = 12000.0
            elif i < 34:
                # TCS event: 4 consecutive RPM drops.
                rpm = 12000.0 - (i - 29) * 500
            else:
                rpm = 12000.0

            rows.append((t, throttle, rpm))

        session = _make_session_with_data(BASE_TIME, rows)
        events = await detect_tcs(session, SESSION_ID, laps)

        assert len(events) >= 1
        event = events[0]
        assert event["lap_number"] == 1
        assert event["throttle_pos_at_trigger"] == 80.0
        assert event["rpm_drop"] > 0
        assert event["duration_ms"] > 0

    @pytest.mark.asyncio
    async def test_no_tcs_when_throttle_closed(self):
        """RPM drop with low throttle should not be detected as TCS."""
        laps = [MockLapSegment(1, 0, 2000)]

        rows = []
        for i in range(40):
            t = BASE_TIME + timedelta(milliseconds=i * 50)
            throttle = 10.0  # Below threshold.
            rpm = 12000.0 - i * 500 if i > 10 else 12000.0
            rows.append((t, throttle, rpm))

        session = _make_session_with_data(BASE_TIME, rows)
        events = await detect_tcs(session, SESSION_ID, laps)

        assert len(events) == 0

    @pytest.mark.asyncio
    async def test_no_tcs_when_throttle_closing(self):
        """RPM drop while throttle is also dropping is normal decel, not TCS."""
        laps = [MockLapSegment(1, 0, 2000)]

        rows = []
        for i in range(40):
            t = BASE_TIME + timedelta(milliseconds=i * 50)
            # Throttle decreasing rapidly while RPM drops.
            throttle = max(0, 80.0 - i * 5.0)
            rpm = 12000.0 - i * 400
            rows.append((t, throttle, rpm))

        session = _make_session_with_data(BASE_TIME, rows)
        events = await detect_tcs(session, SESSION_ID, laps)

        # Most of these should be filtered because throttle is decreasing.
        # Only events where throttle is still above 20% and steady matter.
        # With 5% decrease per sample, throttle drops from 80→0 rapidly.
        # The first few might still match, but with throttle dropping 5/sample
        # that exceeds the 2.0 tolerance, so no events.
        assert len(events) == 0

    @pytest.mark.asyncio
    async def test_single_sample_filtered(self):
        """A single RPM drop sample should be filtered (need >= 2)."""
        laps = [MockLapSegment(1, 0, 2000)]

        rows = []
        for i in range(40):
            t = BASE_TIME + timedelta(milliseconds=i * 50)
            throttle = 80.0
            # Only one big drop at i=20.
            if i == 20:
                rpm = 10000.0
            else:
                rpm = 12000.0
            rows.append((t, throttle, rpm))

        session = _make_session_with_data(BASE_TIME, rows)
        events = await detect_tcs(session, SESSION_ID, laps)

        # Single sample → filtered by _MIN_EVENT_SAMPLES = 2.
        assert len(events) == 0

    @pytest.mark.asyncio
    async def test_no_laps_returns_empty(self):
        session = MockAsyncSession()
        events = await detect_tcs(session, SESSION_ID, [])
        assert events == []

    @pytest.mark.asyncio
    async def test_null_data_handled(self):
        """Null throttle/rpm values should not crash."""
        laps = [MockLapSegment(1, 0, 1000)]

        rows = [
            (BASE_TIME + timedelta(milliseconds=i * 50), None, None)
            for i in range(20)
        ]

        session = _make_session_with_data(BASE_TIME, rows)
        events = await detect_tcs(session, SESSION_ID, laps)

        assert events == []
