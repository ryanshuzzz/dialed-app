"""TCS (Traction Control System) intervention detector.

Detects TCS events by looking for sudden RPM drops while the throttle
position is constant or increasing — the signature of electronic
traction control cutting engine power.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dialed_shared.logging import setup_logger
from models.lap_segment import LapSegment
from models.telemetry_point import TelemetryPoint

logger = setup_logger("telemetry-ingestion")

# Minimum RPM drop per sample to trigger a TCS event candidate.
_RPM_DROP_THRESHOLD = 300.0

# Minimum throttle position to consider (TCS only activates under load).
_MIN_THROTTLE_POS = 20.0

# Minimum consecutive samples with RPM drop to confirm a TCS event.
_MIN_EVENT_SAMPLES = 2

# Maximum gap between TCS samples to consider them part of the same event (ms).
_EVENT_MERGE_GAP_MS = 200


async def detect_tcs(
    session: AsyncSession,
    session_id: str | UUID,
    laps: list[LapSegment],
) -> list[dict[str, Any]]:
    """Detect TCS intervention events across all laps.

    Args:
        session: Async TimescaleDB session.
        session_id: Session UUID.
        laps: List of LapSegment rows for this session.

    Returns:
        List of TCS event dicts with ``time``, ``lap_number``,
        ``duration_ms``, ``throttle_pos_at_trigger``, ``rpm_drop``.
    """
    if not laps:
        return []

    # Get base timestamp.
    base_row = await session.execute(
        select(TelemetryPoint.time)
        .where(TelemetryPoint.session_id == str(session_id))
        .order_by(TelemetryPoint.time)
        .limit(1)
    )
    base_time_scalar = base_row.scalar_one_or_none()
    if base_time_scalar is None:
        return []

    base_time: datetime = base_time_scalar
    events: list[dict[str, Any]] = []

    for lap in laps:
        lap_start = base_time + timedelta(milliseconds=lap.start_time_ms)
        lap_end = base_time + timedelta(milliseconds=lap.end_time_ms)

        rows = await session.execute(
            select(
                TelemetryPoint.time,
                TelemetryPoint.throttle_pos,
                TelemetryPoint.rpm,
            )
            .where(
                TelemetryPoint.session_id == str(session_id),
                TelemetryPoint.time >= lap_start,
                TelemetryPoint.time < lap_end,
            )
            .order_by(TelemetryPoint.time)
        )
        points = rows.all()

        if len(points) < 2:
            continue

        # Detect RPM drops while throttle is open.
        candidate_indices: list[int] = []

        for i in range(1, len(points)):
            prev_t, prev_throttle, prev_rpm = points[i - 1]
            curr_t, curr_throttle, curr_rpm = points[i]

            # Skip if we don't have the data we need.
            if any(v is None for v in (prev_throttle, prev_rpm, curr_throttle, curr_rpm)):
                continue

            # TCS signature: throttle steady or increasing, RPM drops.
            throttle_steady_or_up = curr_throttle >= prev_throttle - 2.0
            throttle_above_min = curr_throttle >= _MIN_THROTTLE_POS
            rpm_dropped = (prev_rpm - curr_rpm) >= _RPM_DROP_THRESHOLD

            if throttle_steady_or_up and throttle_above_min and rpm_dropped:
                candidate_indices.append(i)

        # Group adjacent candidates into events.
        if not candidate_indices:
            continue

        event_groups: list[list[int]] = [[candidate_indices[0]]]

        for idx in candidate_indices[1:]:
            prev_idx = event_groups[-1][-1]
            prev_time: datetime = points[prev_idx][0]
            curr_time: datetime = points[idx][0]
            gap_ms = (curr_time - prev_time).total_seconds() * 1000

            if gap_ms <= _EVENT_MERGE_GAP_MS:
                event_groups[-1].append(idx)
            else:
                event_groups.append([idx])

        # Convert groups to events, filtering by minimum duration.
        for group in event_groups:
            if len(group) < _MIN_EVENT_SAMPLES:
                continue

            first_idx = group[0]
            last_idx = group[-1]

            event_start: datetime = points[first_idx][0]
            event_end: datetime = points[last_idx][0]
            duration_ms = int((event_end - event_start).total_seconds() * 1000)

            # Throttle at trigger is from the sample just before the first drop.
            trigger_idx = max(0, first_idx - 1)
            throttle_at_trigger = points[trigger_idx][1] or 0.0

            # Total RPM drop across the event.
            start_rpm = points[max(0, first_idx - 1)][2] or 0.0
            min_rpm = min((points[i][2] or float("inf")) for i in group)
            rpm_drop = start_rpm - min_rpm

            events.append({
                "time": event_start.isoformat(),
                "lap_number": lap.lap_number,
                "duration_ms": max(duration_ms, 1),
                "throttle_pos_at_trigger": round(throttle_at_trigger, 1),
                "rpm_drop": round(rpm_drop, 0),
            })

    logger.info(
        "TCS detection: %d events across %d laps for session %s",
        len(events), len(laps), session_id,
    )

    return events
