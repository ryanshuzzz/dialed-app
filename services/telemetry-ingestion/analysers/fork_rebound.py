"""Fork rebound analyser — measure compression/rebound patterns per lap.

Queries ``fork_position`` from the telemetry_points hypertable,
identifies compression (position decreasing) and rebound (position
increasing) phases, and calculates rebound speed metrics useful for
suspension tuning.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from dialed_shared.logging import setup_logger
from models.lap_segment import LapSegment
from models.telemetry_point import TelemetryPoint

logger = setup_logger("telemetry-ingestion")


async def _channel_has_data(
    session: AsyncSession,
    session_id: str,
    col_name: str,
) -> bool:
    """Return True if the named core column has at least one non-NULL value."""
    col = getattr(TelemetryPoint, col_name)
    row = await session.execute(
        select(col)
        .where(
            TelemetryPoint.session_id == session_id,
            col.isnot(None),
        )
        .limit(1)
    )
    return row.scalar_one_or_none() is not None

# Minimum fork movement in mm to register as a compression/rebound event.
_MIN_TRAVEL_MM = 2.0

# Sampling interval at 20Hz in seconds.
_SAMPLE_INTERVAL_S = 0.05


async def analyse_fork(
    session: AsyncSession,
    session_id: str | UUID,
    laps: list[LapSegment],
) -> dict[str, Any]:
    """Analyse fork compression and rebound patterns.

    Args:
        session: Async TimescaleDB session.
        session_id: Session UUID.
        laps: List of LapSegment rows for this session.

    Returns:
        Dict with ``avg_rebound_rate`` (mm/s), ``max_compression_mm``,
        and ``per_lap`` details.
    """
    if not laps:
        return {
            "avg_rebound_rate": None,
            "max_compression_mm": None,
            "per_lap": [],
        }

    # Get base timestamp.
    base_row = await session.execute(
        select(TelemetryPoint.time)
        .where(TelemetryPoint.session_id == str(session_id))
        .order_by(TelemetryPoint.time)
        .limit(1)
    )
    base_time_scalar = base_row.scalar_one_or_none()
    if base_time_scalar is None:
        return {"avg_rebound_rate": None, "max_compression_mm": None, "per_lap": []}

    base_time: datetime = base_time_scalar

    all_rebound_rates: list[float] = []
    global_max_compression = 0.0
    per_lap: list[dict[str, Any]] = []

    # Determine whether fork_position lives in the named column or extra_channels.
    sid_str = str(session_id)
    use_extra_fork = not await _channel_has_data(session, sid_str, "fork_position")

    for lap in laps:
        lap_start = base_time + timedelta(milliseconds=lap.start_time_ms)
        lap_end = base_time + timedelta(milliseconds=lap.end_time_ms)

        if use_extra_fork:
            raw_rows = await session.execute(
                text(
                    "SELECT time, "
                    "  (extra_channels->>'fork_position')::double precision AS fork_position "
                    "FROM telemetry.telemetry_points "
                    "WHERE session_id = :sid AND time >= :start AND time < :end "
                    "ORDER BY time"
                ),
                {"sid": sid_str, "start": lap_start, "end": lap_end},
            )
            points = raw_rows.all()
        else:
            rows = await session.execute(
                select(TelemetryPoint.time, TelemetryPoint.fork_position)
                .where(
                    TelemetryPoint.session_id == sid_str,
                    TelemetryPoint.time >= lap_start,
                    TelemetryPoint.time < lap_end,
                )
                .order_by(TelemetryPoint.time)
            )
            points = rows.all()

        if len(points) < 2:
            continue

        # Extract fork position values, skipping nulls.
        positions: list[tuple[datetime, float]] = [
            (t, pos) for t, pos in points if pos is not None
        ]

        if len(positions) < 2:
            continue

        # Identify compression peaks and rebound valleys.
        # Fork position: 0 = fully extended, higher = more compressed.
        lap_max_compression = max(pos for _, pos in positions)
        global_max_compression = max(global_max_compression, lap_max_compression)

        # Calculate rebound rates: when fork position is decreasing
        # (rebounding), measure the rate of change.
        lap_rebound_rates: list[float] = []

        for i in range(1, len(positions)):
            prev_t, prev_pos = positions[i - 1]
            curr_t, curr_pos = positions[i]

            dt = (curr_t - prev_t).total_seconds()
            if dt <= 0:
                continue

            delta_mm = prev_pos - curr_pos  # Positive when rebounding.
            if delta_mm > 0:
                rate = delta_mm / dt  # mm/s
                lap_rebound_rates.append(rate)

        avg_lap_rate = (
            sum(lap_rebound_rates) / len(lap_rebound_rates)
            if lap_rebound_rates
            else None
        )
        all_rebound_rates.extend(lap_rebound_rates)

        per_lap.append({
            "lap_number": lap.lap_number,
            "max_compression_mm": round(lap_max_compression, 1),
            "avg_rebound_rate": round(avg_lap_rate, 1) if avg_lap_rate else None,
            "rebound_event_count": len(lap_rebound_rates),
        })

    avg_rebound_rate = (
        round(sum(all_rebound_rates) / len(all_rebound_rates), 1)
        if all_rebound_rates
        else None
    )

    result = {
        "avg_rebound_rate": avg_rebound_rate,
        "max_compression_mm": round(global_max_compression, 1) if global_max_compression > 0 else None,
        "per_lap": per_lap,
    }

    logger.info(
        "Fork analysis: avg_rebound=%.1f mm/s, max_compression=%.1f mm for session %s",
        avg_rebound_rate or 0.0,
        global_max_compression,
        session_id,
    )

    return result
