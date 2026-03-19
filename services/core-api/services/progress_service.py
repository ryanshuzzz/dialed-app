"""Progress service — lap trends, suggestion efficacy, session history."""

from __future__ import annotations

import uuid
from collections import defaultdict

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.efficacy import EfficacyStats
from models.event import Event
from models.session import Session
from models.track import Track
from schemas.progress import (
    AvgDeltaByStatus,
    BestLapByTrack,
    EfficacyResponse,
    LapTrendItem,
    LapTrendResponse,
    SessionHistoryItem,
    SessionHistoryResponse,
)


def _best_lap_expr():
    """SQL expression: prefer csv_best_lap_ms, fall back to manual_best_lap_ms."""
    return func.coalesce(Session.csv_best_lap_ms, Session.manual_best_lap_ms)


class ProgressService:

    @staticmethod
    async def get_lap_trends(
        session: AsyncSession,
        user_id: uuid.UUID,
    ) -> LapTrendResponse:
        best_lap = _best_lap_expr()

        # Lap time trend — one row per session, ordered by event date
        trend_result = await session.execute(
            select(
                Session.id.label("session_id"),
                Event.date.label("date"),
                Track.name.label("track_name"),
                best_lap.label("best_lap_ms"),
            )
            .join(Event, Session.event_id == Event.id)
            .join(Track, Event.track_id == Track.id)
            .where(Session.user_id == user_id)
            .order_by(Event.date)
        )
        trend_rows = trend_result.all()

        lap_time_trend = [
            LapTrendItem(
                session_id=row.session_id,
                date=row.date,
                track_name=row.track_name,
                best_lap_ms=row.best_lap_ms,
            )
            for row in trend_rows
        ]

        # Best laps by track
        best_by_track_subq = (
            select(
                Track.id.label("track_id"),
                Track.name.label("track_name"),
                func.min(best_lap).label("best_lap_ms"),
            )
            .join(Event, Track.id == Event.track_id)
            .join(Session, Event.id == Session.event_id)
            .where(Session.user_id == user_id)
            .where(best_lap.isnot(None))
            .group_by(Track.id, Track.name)
            .subquery()
        )

        # For each track, find the session that achieved the best lap
        best_laps_result = await session.execute(
            select(
                best_by_track_subq.c.track_id,
                best_by_track_subq.c.track_name,
                best_by_track_subq.c.best_lap_ms,
                Session.id.label("session_id"),
                Event.date.label("date"),
            )
            .join(Event, Event.track_id == best_by_track_subq.c.track_id)
            .join(Session, Session.event_id == Event.id)
            .where(Session.user_id == user_id)
            .where(
                func.coalesce(Session.csv_best_lap_ms, Session.manual_best_lap_ms)
                == best_by_track_subq.c.best_lap_ms
            )
        )
        best_laps_rows = best_laps_result.all()

        # Deduplicate — keep only first match per track
        seen_tracks: set[uuid.UUID] = set()
        best_laps_by_track: list[BestLapByTrack] = []
        for row in best_laps_rows:
            if row.track_id not in seen_tracks:
                seen_tracks.add(row.track_id)
                best_laps_by_track.append(
                    BestLapByTrack(
                        track_id=row.track_id,
                        track_name=row.track_name,
                        best_lap_ms=row.best_lap_ms,
                        session_id=row.session_id,
                        date=row.date,
                    )
                )

        # Total time found: sum of per-track improvements (first lap - best lap)
        total_time_found_ms = 0
        by_track: dict[uuid.UUID, list[int]] = defaultdict(list)
        for row in trend_rows:
            if row.best_lap_ms is not None:
                by_track[row.session_id]  # not right, need track_id
        # Recalculate from trend data grouped by track
        track_laps: dict[str, list[int]] = defaultdict(list)
        for row in trend_rows:
            if row.best_lap_ms is not None:
                track_laps[row.track_name].append(row.best_lap_ms)
        for track_name, laps in track_laps.items():
            if len(laps) >= 2:
                total_time_found_ms += laps[0] - min(laps)

        return LapTrendResponse(
            lap_time_trend=lap_time_trend,
            best_laps_by_track=best_laps_by_track,
            total_time_found_ms=total_time_found_ms,
        )

    @staticmethod
    async def get_efficacy(
        session: AsyncSession,
        user_id: uuid.UUID,
    ) -> EfficacyResponse:
        """Suggestion efficacy stats — reads from ai schema via cross-schema reference.

        Since efficacy_stats lives in core schema and references ai.suggestions
        without FK, we compute adoption rate and average deltas from the
        efficacy_stats table alone.
        """
        stats_result = await session.execute(
            select(EfficacyStats).where(EfficacyStats.user_id == user_id)
        )
        stats = stats_result.scalars().all()

        total_suggestions = len(stats)
        if total_suggestions == 0:
            return EfficacyResponse()

        # Count non-null lap_delta_ms as "measured" outcomes
        with_delta = [s for s in stats if s.lap_delta_ms is not None]
        adoption_rate = len(with_delta) / total_suggestions if total_suggestions > 0 else 0.0

        # Average delta — all efficacy rows share the same structure
        deltas = [s.lap_delta_ms for s in with_delta]
        avg_delta = sum(deltas) / len(deltas) if deltas else None

        return EfficacyResponse(
            total_suggestions=total_suggestions,
            adoption_rate=adoption_rate,
            avg_delta_by_status=AvgDeltaByStatus(
                applied=avg_delta,
                applied_modified=None,
                skipped=None,
            ),
        )

    @staticmethod
    async def get_session_history(
        session: AsyncSession,
        user_id: uuid.UUID,
    ) -> SessionHistoryResponse:
        best_lap = _best_lap_expr()

        result = await session.execute(
            select(
                Session.id.label("session_id"),
                Event.id.label("event_id"),
                Event.date.label("date"),
                Track.name.label("track_name"),
                Track.id.label("track_id"),
                Session.session_type.label("session_type"),
                best_lap.label("best_lap_ms"),
            )
            .join(Event, Session.event_id == Event.id)
            .join(Track, Event.track_id == Track.id)
            .where(Session.user_id == user_id)
            .order_by(Event.date, Session.created_at)
        )
        rows = result.all()

        # Compute deltas: for each session, compare to previous at same track
        prev_by_track: dict[uuid.UUID, int | None] = {}
        items: list[SessionHistoryItem] = []
        for row in rows:
            delta = None
            if row.best_lap_ms is not None and row.track_id in prev_by_track:
                prev = prev_by_track[row.track_id]
                if prev is not None:
                    delta = row.best_lap_ms - prev

            items.append(
                SessionHistoryItem(
                    session_id=row.session_id,
                    event_id=row.event_id,
                    date=row.date,
                    track_name=row.track_name,
                    session_type=row.session_type,
                    best_lap_ms=row.best_lap_ms,
                    delta_from_previous_ms=delta,
                )
            )

            if row.best_lap_ms is not None:
                prev_by_track[row.track_id] = row.best_lap_ms

        return SessionHistoryResponse(sessions=items)
