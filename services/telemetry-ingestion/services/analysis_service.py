"""Analysis orchestrator — runs all analysers and returns combined results.

Called by the ``GET /telemetry/{session_id}/analysis`` endpoint.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from analysers.braking_zones import analyse_braking
from analysers.fork_rebound import analyse_fork
from analysers.tcs_detector import detect_tcs
from dialed_shared.logging import setup_logger
from models.lap_segment import LapSegment

logger = setup_logger("telemetry-ingestion")


async def run_analysis(
    db_session: AsyncSession,
    ts_session: AsyncSession,
    session_id: str | UUID,
) -> dict[str, Any]:
    """Run all analysers for a session and return combined results.

    Args:
        db_session: Async session against the shared Postgres
            (for querying lap_segments).
        ts_session: Async session against TimescaleDB
            (for querying telemetry_points).
        session_id: Session UUID.

    Returns:
        A dict matching the ``SessionAnalysis`` schema: ``session_id``,
        ``lap_segments``, ``best_lap``, ``braking_zones``,
        ``fork_rebound``, ``tcs_events``.
    """
    sid = str(session_id)

    # Fetch lap segments.
    rows = await db_session.execute(
        select(LapSegment)
        .where(LapSegment.session_id == sid)
        .order_by(LapSegment.lap_number)
    )
    laps: list[LapSegment] = list(rows.scalars().all())

    # Serialise lap segments for the response.
    lap_dicts = [
        {
            "id": str(lap.id),
            "session_id": str(lap.session_id),
            "lap_number": lap.lap_number,
            "start_time_ms": lap.start_time_ms,
            "end_time_ms": lap.end_time_ms,
            "lap_time_ms": lap.lap_time_ms,
            "beacon_start_s": lap.beacon_start_s,
            "beacon_end_s": lap.beacon_end_s,
            "created_at": lap.created_at.isoformat() if lap.created_at else None,
        }
        for lap in laps
    ]

    # Determine best lap.
    best_lap: dict[str, Any] | None = None
    if laps:
        fastest = min(laps, key=lambda l: l.lap_time_ms)
        best_lap = {
            "lap_number": fastest.lap_number,
            "lap_time_ms": fastest.lap_time_ms,
        }

    # Run all three analysers against the TimescaleDB session.
    braking_zones = await analyse_braking(ts_session, sid, laps)
    fork_rebound = await analyse_fork(ts_session, sid, laps)
    tcs_events = await detect_tcs(ts_session, sid, laps)

    result = {
        "session_id": sid,
        "lap_segments": lap_dicts,
        "best_lap": best_lap,
        "braking_zones": braking_zones,
        "fork_rebound": fork_rebound,
        "tcs_events": tcs_events,
    }

    logger.info(
        "Analysis complete for session %s: %d laps, %d braking zones, %d TCS events",
        sid,
        len(laps),
        len(braking_zones),
        len(tcs_events),
    )

    return result
