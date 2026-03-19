"""CSV telemetry ingestion pipeline.

Parses AiM-compatible CSV data logger files, maps columns through the channel
alias table, detects lap boundaries, and prepares rows for bulk insert into
the TimescaleDB telemetry_points hypertable.
"""

from __future__ import annotations

import csv
import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import httpx
from sqlalchemy import insert
from sqlalchemy.ext.asyncio import AsyncSession

from dialed_shared.logging import setup_logger
from models.telemetry_point import TelemetryPoint

logger = setup_logger("telemetry-ingestion")

# The 13 core channel columns that map directly to telemetry_points columns.
CORE_CHANNELS: set[str] = {
    "gps_speed",
    "throttle_pos",
    "rpm",
    "gear",
    "lean_angle",
    "front_brake_psi",
    "rear_brake_psi",
    "fork_position",
    "shock_position",
    "coolant_temp",
    "oil_temp",
    "lat",
    "lon",
}

# Column names in AiM CSVs that indicate a beacon / marker channel.
BEACON_COLUMN_NAMES: set[str] = {
    "beacon",
    "marker",
    "lap_beacon",
    "lap_marker",
    "ext_marker",
    "external_marker",
}

# Minimum distance (in degrees) between two GPS points to consider movement.
_GPS_MIN_DISTANCE_DEG = 0.0001  # ~11 m at the equator

INSERT_CHUNK_SIZE = 5000


# ── Data structures ─────────────────────────────────────────────────────────


@dataclass
class ColumnMapping:
    """Describes how a single CSV column maps to the telemetry_points table."""

    csv_index: int
    canonical_name: str
    is_core: bool  # True → direct column; False → goes into extra_channels


@dataclass
class LapBoundary:
    """Raw lap boundary data before insertion into lap_segments."""

    lap_number: int
    start_time_ms: int
    end_time_ms: int
    lap_time_ms: int
    beacon_start_s: float | None = None
    beacon_end_s: float | None = None


@dataclass
class ParseResult:
    """Output of parse_csv — everything needed for ingestion."""

    rows: list[dict[str, Any]]
    laps: list[LapBoundary]
    best_lap_ms: int
    channels_found: list[str]
    total_duration_s: float
    row_count: int


# ── Channel alias fetching ───────────────────────────────────────────────────


async def fetch_channel_aliases(
    core_api_url: str,
    internal_token: str,
) -> dict[str, str]:
    """Fetch the channel alias lookup table from the Core API.

    Returns a dict mapping ``raw_name`` → ``canonical_name``.  If a
    ``logger_model`` is present on an alias it is stored as a secondary key
    ``(logger_model, raw_name)`` so callers can do model-specific lookups,
    but the primary key is always the bare ``raw_name`` (last-write-wins for
    duplicates across models).
    """
    url = f"{core_api_url.rstrip('/')}/admin/channel-aliases"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            url,
            headers={"X-Internal-Token": internal_token},
        )
        resp.raise_for_status()

    aliases: list[dict[str, Any]] = resp.json()

    mapping: dict[str, str] = {}
    for alias in aliases:
        raw = alias["raw_name"]
        canonical = alias["canonical_name"]
        # Store a model-specific key when available.
        model = alias.get("logger_model")
        if model:
            mapping[f"{model}:{raw}"] = canonical
        # Bare raw_name is always stored (fallback).
        mapping[raw] = canonical

    return mapping


# ── Column mapping ───────────────────────────────────────────────────────────


def map_columns(
    csv_headers: list[str],
    aliases: dict[str, str],
    logger_model: str | None = None,
) -> dict[int, ColumnMapping]:
    """Map CSV column indices to telemetry_points targets.

    Returns ``{csv_column_index: ColumnMapping}``.  The ``time`` column is
    excluded from the mapping — it is handled separately during row parsing.
    """
    mapping: dict[int, ColumnMapping] = {}

    for idx, raw_header in enumerate(csv_headers):
        header = raw_header.strip()
        lower = header.lower()

        # Skip the time column — handled separately.
        if lower in ("time", "timestamp", "datetime"):
            continue

        # Resolve canonical name via alias table.
        canonical: str | None = None
        if logger_model:
            canonical = aliases.get(f"{logger_model}:{header}")
            if canonical is None:
                canonical = aliases.get(f"{logger_model}:{lower}")
        if canonical is None:
            canonical = aliases.get(header)
        if canonical is None:
            canonical = aliases.get(lower)
        if canonical is None:
            # No alias found — use the header as-is, lowered and cleaned.
            canonical = lower.replace(" ", "_")

        is_core = canonical in CORE_CHANNELS
        mapping[idx] = ColumnMapping(
            csv_index=idx,
            canonical_name=canonical,
            is_core=is_core,
        )

    return mapping


# ── Lap boundary detection ───────────────────────────────────────────────────


def detect_lap_boundaries(
    timestamps: list[float],
    beacon_column: list[float | None] | None = None,
    gps_data: list[tuple[float, float] | None] | None = None,
) -> list[LapBoundary]:
    """Detect lap boundaries from beacon triggers or GPS crossings.

    Args:
        timestamps: List of elapsed-time values in seconds from the file.
        beacon_column: Optional list of beacon/marker channel values (one per
            row). A rising edge (0 → non-zero) indicates a lap trigger.
        gps_data: Optional list of ``(lat, lon)`` tuples (one per row). Used
            as a fallback when no beacon column is available — detects when the
            rider crosses the start/finish line again.

    Returns:
        Ordered list of ``LapBoundary`` objects.
    """
    if not timestamps:
        return []

    if beacon_column is not None:
        return _detect_from_beacon(timestamps, beacon_column)

    if gps_data is not None:
        return _detect_from_gps(timestamps, gps_data)

    # No beacon and no GPS — treat the entire file as a single lap.
    duration_ms = int((timestamps[-1] - timestamps[0]) * 1000)
    return [
        LapBoundary(
            lap_number=1,
            start_time_ms=0,
            end_time_ms=duration_ms,
            lap_time_ms=duration_ms,
        )
    ]


def _detect_from_beacon(
    timestamps: list[float],
    beacon: list[float | None],
) -> list[LapBoundary]:
    """Detect laps from beacon rising-edge triggers."""
    trigger_indices: list[int] = []
    prev_value: float = 0.0

    for i, val in enumerate(beacon):
        current = float(val) if val is not None else 0.0
        if prev_value == 0.0 and current != 0.0:
            trigger_indices.append(i)
        prev_value = current

    if len(trigger_indices) < 2:
        # Not enough triggers for a complete lap — return entire file.
        duration_ms = int((timestamps[-1] - timestamps[0]) * 1000)
        return [
            LapBoundary(
                lap_number=1,
                start_time_ms=0,
                end_time_ms=duration_ms,
                lap_time_ms=duration_ms,
                beacon_start_s=timestamps[trigger_indices[0]] if trigger_indices else None,
                beacon_end_s=None,
            )
        ]

    laps: list[LapBoundary] = []
    for lap_num, (start_idx, end_idx) in enumerate(
        zip(trigger_indices, trigger_indices[1:]), start=1
    ):
        start_s = timestamps[start_idx]
        end_s = timestamps[end_idx]
        start_ms = int(start_s * 1000)
        end_ms = int(end_s * 1000)
        laps.append(
            LapBoundary(
                lap_number=lap_num,
                start_time_ms=start_ms,
                end_time_ms=end_ms,
                lap_time_ms=end_ms - start_ms,
                beacon_start_s=start_s,
                beacon_end_s=end_s,
            )
        )

    return laps


def _detect_from_gps(
    timestamps: list[float],
    gps_data: list[tuple[float, float] | None],
) -> list[LapBoundary]:
    """Detect laps by GPS start/finish line crossings.

    Uses the first valid GPS point as the reference start/finish location.
    A crossing is registered when the rider moves away and then returns
    within ``_GPS_MIN_DISTANCE_DEG`` of the reference point.
    """
    # Find the first valid GPS point as the reference.
    ref_lat: float | None = None
    ref_lon: float | None = None
    for point in gps_data:
        if point is not None:
            ref_lat, ref_lon = point
            break

    if ref_lat is None or ref_lon is None:
        duration_ms = int((timestamps[-1] - timestamps[0]) * 1000)
        return [
            LapBoundary(
                lap_number=1,
                start_time_ms=0,
                end_time_ms=duration_ms,
                lap_time_ms=duration_ms,
            )
        ]

    crossing_indices: list[int] = []
    was_near = True  # Start near the line.

    for i, point in enumerate(gps_data):
        if point is None:
            continue
        lat, lon = point
        dist = math.hypot(lat - ref_lat, lon - ref_lon)
        is_near = dist < _GPS_MIN_DISTANCE_DEG

        if is_near and not was_near:
            crossing_indices.append(i)
        was_near = is_near

    if len(crossing_indices) < 2:
        duration_ms = int((timestamps[-1] - timestamps[0]) * 1000)
        return [
            LapBoundary(
                lap_number=1,
                start_time_ms=0,
                end_time_ms=duration_ms,
                lap_time_ms=duration_ms,
            )
        ]

    laps: list[LapBoundary] = []
    for lap_num, (start_idx, end_idx) in enumerate(
        zip(crossing_indices, crossing_indices[1:]), start=1
    ):
        start_ms = int(timestamps[start_idx] * 1000)
        end_ms = int(timestamps[end_idx] * 1000)
        laps.append(
            LapBoundary(
                lap_number=lap_num,
                start_time_ms=start_ms,
                end_time_ms=end_ms,
                lap_time_ms=end_ms - start_ms,
            )
        )

    return laps


# ── CSV parsing ──────────────────────────────────────────────────────────────


def _find_time_column(headers: list[str]) -> int | None:
    """Return the index of the time / timestamp column, or None."""
    for idx, h in enumerate(headers):
        if h.strip().lower() in ("time", "timestamp", "datetime"):
            return idx
    return None


def _find_beacon_column(
    headers: list[str],
    col_map: dict[int, ColumnMapping],
) -> int | None:
    """Return the CSV index of a beacon/marker column, if present."""
    for idx, h in enumerate(headers):
        if h.strip().lower() in BEACON_COLUMN_NAMES:
            return idx
    # Also check canonical names produced by the alias mapping.
    for idx, cm in col_map.items():
        if cm.canonical_name in BEACON_COLUMN_NAMES:
            return idx
    return None


def _parse_time(raw: str) -> datetime | None:
    """Try to parse a time value from a CSV cell.

    Supports ISO-8601, epoch seconds, and elapsed seconds (float).
    """
    raw = raw.strip()
    if not raw:
        return None

    # ISO-8601
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S.%f"):
        try:
            dt = datetime.strptime(raw, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue

    # Numeric — treat as elapsed seconds from epoch (will be rebased later).
    try:
        secs = float(raw)
        return datetime.fromtimestamp(secs, tz=timezone.utc)
    except (ValueError, OSError):
        return None


def _safe_float(raw: str) -> float | None:
    """Convert a CSV cell to float, returning None for blanks / errors."""
    raw = raw.strip()
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def _safe_int(raw: str) -> int | None:
    """Convert a CSV cell to int (via float to handle '3.0'), or None."""
    val = _safe_float(raw)
    if val is None:
        return None
    return int(val)


def parse_csv(
    file_path: str,
    aliases: dict[str, str],
    session_id: str | UUID | None = None,
    logger_model: str | None = None,
) -> ParseResult:
    """Parse an AiM-compatible CSV file and return data ready for ingestion.

    Args:
        file_path: Path to the CSV file on disk.
        aliases: Channel alias mapping from ``fetch_channel_aliases``.
        session_id: Optional session UUID to embed in every row.
        logger_model: Optional logger model identifier for model-specific
            alias resolution.

    Returns:
        A ``ParseResult`` with rows, lap data, and summary statistics.

    Raises:
        ValueError: If the CSV is empty or contains no recognisable channels.
    """
    with open(file_path, newline="", encoding="utf-8-sig") as fh:
        reader = csv.reader(fh)

        # Read headers.
        try:
            headers = next(reader)
        except StopIteration:
            raise ValueError("CSV file is empty")

        if not headers:
            raise ValueError("CSV file is empty")

        time_col_idx = _find_time_column(headers)
        col_map = map_columns(headers, aliases, logger_model=logger_model)

        if not col_map:
            raise ValueError("CSV file contains no recognisable channels")

        beacon_col_idx = _find_beacon_column(headers, col_map)

        # Collect data rows.
        rows: list[dict[str, Any]] = []
        timestamps: list[float] = []
        beacon_values: list[float | None] = [] if beacon_col_idx is not None else None
        gps_lats: list[float | None] = []
        gps_lons: list[float | None] = []
        has_gps = False

        row_start_time: datetime | None = None

        for line_num, raw_row in enumerate(reader, start=2):
            # Skip blank lines.
            if not any(cell.strip() for cell in raw_row):
                continue

            # Parse time.
            time_val: datetime | None = None
            elapsed_s: float = 0.0

            if time_col_idx is not None and time_col_idx < len(raw_row):
                time_val = _parse_time(raw_row[time_col_idx])

            if time_val is None:
                # Fallback: synthesise from row index at 20Hz.
                elapsed_s = (line_num - 2) * 0.05
                time_val = datetime.fromtimestamp(elapsed_s, tz=timezone.utc)
            else:
                if row_start_time is None:
                    row_start_time = time_val
                elapsed_s = (time_val - row_start_time).total_seconds()

            timestamps.append(elapsed_s)

            # Build the row dict.
            row: dict[str, Any] = {"time": time_val}
            if session_id is not None:
                row["session_id"] = str(session_id)

            extra: dict[str, float | None] = {}

            for idx, cm in col_map.items():
                if idx >= len(raw_row):
                    continue

                cell = raw_row[idx]
                if cm.canonical_name == "gear":
                    value = _safe_int(cell)
                else:
                    value = _safe_float(cell)

                if cm.is_core:
                    row[cm.canonical_name] = value
                else:
                    extra[cm.canonical_name] = value

            if extra:
                row["extra_channels"] = extra

            # Collect beacon values.
            if beacon_col_idx is not None and beacon_col_idx < len(raw_row):
                beacon_values.append(_safe_float(raw_row[beacon_col_idx]))

            # Collect GPS data for fallback lap detection.
            lat = row.get("lat")
            lon = row.get("lon")
            if lat is not None and lon is not None:
                gps_lats.append(lat)
                gps_lons.append(lon)
                has_gps = True
            else:
                gps_lats.append(None)
                gps_lons.append(None)

            rows.append(row)

    if not rows:
        raise ValueError("CSV file contains no data rows")

    # Detect lap boundaries.
    gps_pairs: list[tuple[float, float] | None] | None = None
    if has_gps:
        gps_pairs = [
            (lat, lon) if lat is not None and lon is not None else None
            for lat, lon in zip(gps_lats, gps_lons)
        ]

    laps = detect_lap_boundaries(
        timestamps=timestamps,
        beacon_column=beacon_values,
        gps_data=gps_pairs,
    )

    best_lap_ms = min((lap.lap_time_ms for lap in laps), default=0)

    # Collect channel names found.
    channels_found = sorted({cm.canonical_name for cm in col_map.values()})

    total_duration_s = timestamps[-1] - timestamps[0] if len(timestamps) > 1 else 0.0

    return ParseResult(
        rows=rows,
        laps=laps,
        best_lap_ms=best_lap_ms,
        channels_found=channels_found,
        total_duration_s=total_duration_s,
        row_count=len(rows),
    )


# ── Bulk insert ──────────────────────────────────────────────────────────────


async def bulk_insert_telemetry(
    session: AsyncSession,
    session_id: str | UUID,
    rows: list[dict[str, Any]],
) -> int:
    """Batch-insert telemetry rows into the hypertable.

    Inserts in chunks of ``INSERT_CHUNK_SIZE`` to avoid excessive memory use.
    Returns the total number of rows inserted.
    """
    if not rows:
        return 0

    sid = str(session_id)
    total_inserted = 0

    for offset in range(0, len(rows), INSERT_CHUNK_SIZE):
        chunk = rows[offset : offset + INSERT_CHUNK_SIZE]

        # Ensure every row has session_id and defaults for missing fields.
        values: list[dict[str, Any]] = []
        for row in chunk:
            row_copy = dict(row)
            row_copy.setdefault("session_id", sid)
            row_copy.setdefault("extra_channels", {})
            values.append(row_copy)

        stmt = insert(TelemetryPoint).values(values)
        await session.execute(stmt)
        total_inserted += len(values)

    await session.commit()
    return total_inserted
