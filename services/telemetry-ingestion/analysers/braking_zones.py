"""Braking zone analyser — identify and measure braking events per lap.

Queries ``front_brake_psi`` from the telemetry_points hypertable,
detects threshold crossings to delimit braking zones, and measures
entry/exit speed, peak pressure, and duration.
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


# Minimum brake pressure (PSI) to consider as an active braking event.
_BRAKE_THRESHOLD_PSI = 5.0

# Minimum braking duration in samples to filter noise (at 20Hz, 3 = 150ms).
_MIN_BRAKE_SAMPLES = 3


async def analyse_braking(
    session: AsyncSession,
    session_id: str | UUID,
    laps: list[LapSegment],
) -> list[dict[str, Any]]:
    """Analyse braking zones for each lap in a session.

    Args:
        session: Async TimescaleDB session.
        session_id: Session UUID.
        laps: List of LapSegment rows for this session.

    Returns:
        List of braking zone dicts, each containing:
        ``zone_id``, ``lap_number``, ``entry_speed_kph``, ``exit_speed_kph``,
        ``max_brake_psi``, ``duration_ms``, ``start_time``, ``end_time``.
    """
    if not laps:
        return []

    # We need the session's base timestamp to convert lap offsets.
    # Query the earliest telemetry point for this session.
    base_time_row = await session.execute(
        select(TelemetryPoint.time)
        .where(TelemetryPoint.session_id == str(session_id))
        .order_by(TelemetryPoint.time)
        .limit(1)
    )
    base_time_scalar = base_time_row.scalar_one_or_none()
    if base_time_scalar is None:
        return []

    base_time: datetime = base_time_scalar
    zones: list[dict[str, Any]] = []
    zone_counter = 0

    # Determine whether to read from named columns or extra_channels fallback.
    sid_str = str(session_id)
    use_extra_brake = not await _channel_has_data(session, sid_str, "front_brake_psi")
    use_extra_speed = not await _channel_has_data(session, sid_str, "gps_speed")

    for lap in laps:
        lap_start = base_time + timedelta(milliseconds=lap.start_time_ms)
        lap_end = base_time + timedelta(milliseconds=lap.end_time_ms)

        if use_extra_brake or use_extra_speed:
            # Fall back to reading from extra_channels JSONB.
            raw_rows = await session.execute(
                text(
                    "SELECT time, "
                    "  CASE WHEN :use_extra_brake THEN "
                    "    (extra_channels->>'front_brake_psi')::double precision "
                    "  ELSE front_brake_psi END AS front_brake_psi, "
                    "  CASE WHEN :use_extra_speed THEN "
                    "    (extra_channels->>'gps_speed')::double precision "
                    "  ELSE gps_speed END AS gps_speed "
                    "FROM telemetry.telemetry_points "
                    "WHERE session_id = :sid AND time >= :start AND time < :end "
                    "ORDER BY time"
                ),
                {
                    "sid": sid_str,
                    "start": lap_start,
                    "end": lap_end,
                    "use_extra_brake": use_extra_brake,
                    "use_extra_speed": use_extra_speed,
                },
            )
            points = raw_rows.all()
        else:
            rows = await session.execute(
                select(
                    TelemetryPoint.time,
                    TelemetryPoint.front_brake_psi,
                    TelemetryPoint.gps_speed,
                )
                .where(
                    TelemetryPoint.session_id == sid_str,
                    TelemetryPoint.time >= lap_start,
                    TelemetryPoint.time < lap_end,
                )
                .order_by(TelemetryPoint.time)
            )
            points = rows.all()

        if not points:
            continue

        # Walk through points and detect braking zones via threshold crossing.
        in_zone = False
        zone_start_idx = 0

        for i, (t, brake_psi, speed) in enumerate(points):
            psi = brake_psi or 0.0
            above = psi >= _BRAKE_THRESHOLD_PSI

            if above and not in_zone:
                # Entering a braking zone.
                in_zone = True
                zone_start_idx = i
            elif not above and in_zone:
                # Exiting a braking zone.
                in_zone = False
                zone_len = i - zone_start_idx

                if zone_len >= _MIN_BRAKE_SAMPLES:
                    zone_points = points[zone_start_idx:i]
                    zone_counter += 1

                    entry_speed = zone_points[0][2] or 0.0
                    exit_speed = zone_points[-1][2] or 0.0
                    max_psi = max((p[1] or 0.0) for p in zone_points)
                    start_t: datetime = zone_points[0][0]
                    end_t: datetime = zone_points[-1][0]
                    dur_ms = int((end_t - start_t).total_seconds() * 1000)

                    zones.append({
                        "zone_id": zone_counter,
                        "lap_number": lap.lap_number,
                        "entry_speed_kph": round(entry_speed, 1),
                        "exit_speed_kph": round(exit_speed, 1),
                        "max_brake_psi": round(max_psi, 1),
                        "duration_ms": dur_ms,
                        "start_time": start_t.isoformat(),
                        "end_time": end_t.isoformat(),
                    })

        # Handle zone that extends to end of lap.
        if in_zone:
            zone_len = len(points) - zone_start_idx
            if zone_len >= _MIN_BRAKE_SAMPLES:
                zone_points = points[zone_start_idx:]
                zone_counter += 1

                entry_speed = zone_points[0][2] or 0.0
                exit_speed = zone_points[-1][2] or 0.0
                max_psi = max((p[1] or 0.0) for p in zone_points)
                start_t = zone_points[0][0]
                end_t = zone_points[-1][0]
                dur_ms = int((end_t - start_t).total_seconds() * 1000)

                zones.append({
                    "zone_id": zone_counter,
                    "lap_number": lap.lap_number,
                    "entry_speed_kph": round(entry_speed, 1),
                    "exit_speed_kph": round(exit_speed, 1),
                    "max_brake_psi": round(max_psi, 1),
                    "duration_ms": dur_ms,
                    "start_time": start_t.isoformat(),
                    "end_time": end_t.isoformat(),
                })

    logger.info(
        "Braking analysis: %d zones across %d laps for session %s",
        len(zones), len(laps), session_id,
    )

    return zones
