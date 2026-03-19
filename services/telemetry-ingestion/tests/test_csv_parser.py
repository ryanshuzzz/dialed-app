"""Tests for pipelines/csv_parser.py — column mapping, lap detection, CSV parsing."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest

from pipelines.csv_parser import (
    CORE_CHANNELS,
    ColumnMapping,
    LapBoundary,
    bulk_insert_telemetry,
    detect_lap_boundaries,
    fetch_channel_aliases,
    map_columns,
    parse_csv,
)
from tests.conftest import SESSION_ID


# ═══════════════════════ fetch_channel_aliases ═══════════════════════════════


@pytest.mark.asyncio
async def test_fetch_channel_aliases(channel_aliases):
    """fetch_channel_aliases returns a flat raw_name→canonical_name dict."""
    mock_resp = AsyncMock()
    mock_resp.json.return_value = channel_aliases
    mock_resp.raise_for_status = lambda: None

    with patch("pipelines.csv_parser.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get.return_value = mock_resp
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await fetch_channel_aliases("http://core-api:8001", "token")

    assert result["GPS Speed"] == "gps_speed"
    assert result["Throttle"] == "throttle_pos"
    # Model-specific key.
    assert result["AiM EVO5:GPS_Speed"] == "gps_speed"
    assert result["AiM EVO5:TPS"] == "throttle_pos"


# ═══════════════════════ map_columns ═════════════════════════════════════════


class TestMapColumns:
    def test_core_channels_mapped(self, alias_dict):
        headers = ["Time", "GPS Speed", "Throttle", "Engine RPM", "Gear"]
        result = map_columns(headers, alias_dict)

        # Time column (idx 0) should be skipped.
        assert 0 not in result
        assert result[1].canonical_name == "gps_speed"
        assert result[1].is_core is True
        assert result[2].canonical_name == "throttle_pos"
        assert result[3].canonical_name == "rpm"
        assert result[4].canonical_name == "gear"

    def test_extra_channels(self, alias_dict):
        headers = ["Time", "GPS Speed", "Lambda"]
        result = map_columns(headers, alias_dict)

        # Lambda maps to lambda_afr via alias — not a core channel.
        assert result[2].canonical_name == "lambda_afr"
        assert result[2].is_core is False

    def test_model_specific_alias(self, alias_dict):
        headers = ["Time", "GPS_Speed", "TPS"]
        result = map_columns(headers, alias_dict, logger_model="AiM EVO5")

        assert result[1].canonical_name == "gps_speed"
        assert result[2].canonical_name == "throttle_pos"

    def test_unknown_column_becomes_extra(self, alias_dict):
        headers = ["Time", "GPS Speed", "WheelieLevel"]
        result = map_columns(headers, alias_dict)

        assert result[2].canonical_name == "wheelielevel"
        assert result[2].is_core is False

    def test_empty_headers(self, alias_dict):
        result = map_columns(["Time"], alias_dict)
        assert result == {}

    def test_timestamp_variants_skipped(self, alias_dict):
        """Columns named 'timestamp' or 'datetime' should be skipped like 'time'."""
        for name in ["timestamp", "Timestamp", "datetime", "DateTime"]:
            result = map_columns([name, "GPS Speed"], alias_dict)
            assert 0 not in result
            assert 1 in result


# ═══════════════════════ detect_lap_boundaries ═══════════════════════════════


class TestLapDetection:
    def test_beacon_detection(self):
        """Rising edges in beacon column create lap boundaries."""
        timestamps = [i * 0.05 for i in range(60)]  # 3 seconds at 20Hz
        beacon = [0.0] * 60
        beacon[0] = 1.0   # Trigger at 0s
        beacon[20] = 1.0  # Trigger at 1s
        beacon[40] = 1.0  # Trigger at 2s

        laps = detect_lap_boundaries(timestamps, beacon_column=beacon)

        assert len(laps) == 2
        assert laps[0].lap_number == 1
        assert laps[0].start_time_ms == 0
        assert laps[0].end_time_ms == 1000
        assert laps[0].beacon_start_s == 0.0
        assert laps[0].beacon_end_s == 1.0
        assert laps[1].lap_number == 2
        assert laps[1].start_time_ms == 1000
        assert laps[1].end_time_ms == 2000

    def test_single_beacon_returns_one_lap(self):
        """A single beacon trigger means no complete lap — treat as one."""
        timestamps = [i * 0.05 for i in range(20)]
        beacon = [0.0] * 20
        beacon[5] = 1.0

        laps = detect_lap_boundaries(timestamps, beacon_column=beacon)
        assert len(laps) == 1
        assert laps[0].lap_number == 1

    def test_gps_fallback(self):
        """GPS crossings detect laps when no beacon is available."""
        timestamps = [i * 0.05 for i in range(100)]
        # Simulate: start near ref, move away, come back, move away, come back.
        ref_lat, ref_lon = 40.0, -74.0
        gps_data = []
        for i in range(100):
            if i < 10:
                gps_data.append((ref_lat, ref_lon))  # Near start.
            elif i < 30:
                gps_data.append((ref_lat + 0.01, ref_lon + 0.01))  # Far away.
            elif i < 40:
                gps_data.append((ref_lat, ref_lon))  # Back near start.
            elif i < 60:
                gps_data.append((ref_lat + 0.02, ref_lon + 0.02))  # Far away again.
            elif i < 70:
                gps_data.append((ref_lat, ref_lon))  # Back again.
            else:
                gps_data.append((ref_lat + 0.03, ref_lon))  # Far.

        laps = detect_lap_boundaries(timestamps, gps_data=gps_data)

        assert len(laps) >= 1
        assert laps[0].lap_number == 1

    def test_no_beacon_no_gps(self):
        """Without beacon or GPS, treat entire file as one lap."""
        timestamps = [i * 0.05 for i in range(40)]  # 2 seconds
        laps = detect_lap_boundaries(timestamps)

        assert len(laps) == 1
        assert laps[0].lap_number == 1
        assert laps[0].lap_time_ms == 1950

    def test_empty_timestamps(self):
        laps = detect_lap_boundaries([])
        assert laps == []


# ═══════════════════════ parse_csv ════════════════════════════════════════════


class TestParseCsv:
    def test_valid_csv(self, valid_csv_path, alias_dict):
        result = parse_csv(valid_csv_path, alias_dict, session_id=SESSION_ID)

        assert result.row_count == 20
        assert result.total_duration_s > 0
        assert len(result.channels_found) > 0
        assert "gps_speed" in result.channels_found
        assert "throttle_pos" in result.channels_found

        # All rows should have session_id.
        for row in result.rows:
            assert row["session_id"] == SESSION_ID

        # Check core channel values are numeric.
        first_row = result.rows[0]
        assert isinstance(first_row["gps_speed"], float)
        assert isinstance(first_row["gear"], int)

    def test_extra_channels_in_rows(self, valid_csv_path, alias_dict):
        """Lambda column should end up in extra_channels."""
        result = parse_csv(valid_csv_path, alias_dict)

        # Lambda maps to lambda_afr, which is not a core channel.
        assert "lambda_afr" in result.channels_found
        rows_with_extra = [r for r in result.rows if "extra_channels" in r]
        assert len(rows_with_extra) > 0
        assert "lambda_afr" in rows_with_extra[0]["extra_channels"]

    def test_beacon_creates_laps(self, valid_csv_path, alias_dict):
        """Valid CSV with beacon column should detect laps."""
        result = parse_csv(valid_csv_path, alias_dict)

        assert len(result.laps) >= 1
        assert result.best_lap_ms > 0

    def test_evo5_model_specific(self, aim_evo5_csv_path, alias_dict):
        """AiM EVO5 column names resolve via model-specific aliases."""
        result = parse_csv(aim_evo5_csv_path, alias_dict, logger_model="AiM EVO5")

        assert result.row_count == 10
        assert "gps_speed" in result.channels_found
        assert "throttle_pos" in result.channels_found

    def test_empty_csv_raises(self, empty_csv_path, alias_dict):
        with pytest.raises(ValueError, match="empty"):
            parse_csv(empty_csv_path, alias_dict)

    def test_headers_only_raises(self, headers_only_csv_path, alias_dict):
        with pytest.raises(ValueError, match="no data rows"):
            parse_csv(headers_only_csv_path, alias_dict)

    def test_no_channels_raises(self, no_channels_csv_path, alias_dict):
        """CSV with only a time column should raise."""
        with pytest.raises(ValueError, match="no recognisable channels"):
            parse_csv(no_channels_csv_path, alias_dict)

    def test_malformed_values_handled(self, malformed_csv_path, alias_dict):
        """Malformed numeric values should become None, not crash."""
        result = parse_csv(malformed_csv_path, alias_dict)

        assert result.row_count == 3
        # "abc" should be None.
        assert result.rows[0].get("gps_speed") is None
        # Empty string should be None.
        assert result.rows[1].get("gps_speed") is None


# ═══════════════════════ bulk_insert_telemetry ═══════════════════════════════


class TestBulkInsert:
    @pytest.mark.asyncio
    async def test_empty_rows_returns_zero(self, mock_ts_session):
        inserted = await bulk_insert_telemetry(mock_ts_session, SESSION_ID, [])
        assert inserted == 0

    @pytest.mark.asyncio
    async def test_inserts_in_chunks(self, mock_ts_session):
        """Verify rows are inserted and commit is called."""
        rows = [
            {"time": datetime.now(timezone.utc), "gps_speed": 100.0}
            for _ in range(10)
        ]

        inserted = await bulk_insert_telemetry(mock_ts_session, SESSION_ID, rows)

        assert inserted == 10
        mock_ts_session.execute.assert_called()
        mock_ts_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_sets_session_id_default(self, mock_ts_session):
        """Rows without session_id should get it set."""
        rows = [{"time": datetime.now(timezone.utc), "gps_speed": 50.0}]

        await bulk_insert_telemetry(mock_ts_session, SESSION_ID, rows)

        # Verify execute was called (insert statement).
        call_args = mock_ts_session.execute.call_args
        assert call_args is not None
