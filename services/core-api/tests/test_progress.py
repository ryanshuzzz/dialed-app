"""Tests for progress endpoints — lap trends, efficacy, session history."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import USER_ID


# ── Helpers to seed full session chains ─────────────────────────────────────


async def _create_session_chain(
    db_session: AsyncSession,
    user_id: uuid.UUID,
    track_name: str,
    event_date: date,
    lap_ms: int | None,
    *,
    csv_lap: int | None = None,
):
    """Create track → event → session chain and return the session."""
    from models.bike import Bike
    from models.event import Event
    from models.session import Session
    from models.track import Track

    # Reuse existing track or create new
    from sqlalchemy import select

    result = await db_session.execute(
        select(Track).where(Track.name == track_name)
    )
    track = result.scalar_one_or_none()
    if not track:
        track = Track(name=track_name)
        db_session.add(track)
        await db_session.flush()

    # Reuse or create bike
    result = await db_session.execute(
        select(Bike).where(Bike.user_id == user_id, Bike.deleted_at.is_(None))
    )
    bike = result.scalar_one_or_none()
    if not bike:
        bike = Bike(
            user_id=user_id,
            make="Test",
            model="Bike",
            suspension_spec={"schema_version": 1},
        )
        db_session.add(bike)
        await db_session.flush()

    event = Event(
        user_id=user_id,
        bike_id=bike.id,
        track_id=track.id,
        date=event_date,
        conditions={},
    )
    db_session.add(event)
    await db_session.flush()

    sess = Session(
        event_id=event.id,
        user_id=user_id,
        session_type="practice",
        manual_best_lap_ms=lap_ms,
        csv_best_lap_ms=csv_lap,
    )
    db_session.add(sess)
    await db_session.commit()
    await db_session.refresh(sess)
    return sess


# ═══════════════════════ LAP TRENDS ═══════════════════════


async def test_lap_trends_empty(client: AsyncClient, user):
    resp = await client.get("/progress")
    assert resp.status_code == 200
    body = resp.json()
    assert body["lap_time_trend"] == []
    assert body["best_laps_by_track"] == []
    assert body["total_time_found_ms"] == 0


async def test_lap_trends_with_data(client: AsyncClient, user, db_session):
    await _create_session_chain(
        db_session, USER_ID, "Laguna Seca", date(2025, 1, 1), 95000
    )
    await _create_session_chain(
        db_session, USER_ID, "Laguna Seca", date(2025, 2, 1), 93000
    )
    await _create_session_chain(
        db_session, USER_ID, "Road Atlanta", date(2025, 3, 1), 88000
    )

    resp = await client.get("/progress")
    assert resp.status_code == 200
    body = resp.json()

    # 3 sessions = 3 trend items
    assert len(body["lap_time_trend"]) == 3

    # Best lap per track
    assert len(body["best_laps_by_track"]) == 2
    laguna = next(
        b for b in body["best_laps_by_track"] if b["track_name"] == "Laguna Seca"
    )
    assert laguna["best_lap_ms"] == 93000

    # Total time found: 95000 - 93000 = 2000ms at Laguna (only track with improvement)
    assert body["total_time_found_ms"] == 2000


async def test_lap_trends_prefers_csv_over_manual(
    client: AsyncClient, user, db_session
):
    """csv_best_lap_ms takes priority over manual_best_lap_ms."""
    await _create_session_chain(
        db_session,
        USER_ID,
        "Barber",
        date(2025, 5, 1),
        lap_ms=100000,
        csv_lap=98000,
    )

    resp = await client.get("/progress")
    trend = resp.json()["lap_time_trend"]
    assert len(trend) == 1
    assert trend[0]["best_lap_ms"] == 98000


# ═══════════════════════ EFFICACY ═══════════════════════


async def test_efficacy_empty(client: AsyncClient, user):
    resp = await client.get("/progress/efficacy")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_suggestions"] == 0
    assert body["adoption_rate"] == 0.0


async def test_efficacy_with_data(client: AsyncClient, user, db_session):
    from models.efficacy import EfficacyStats

    for delta in [-500, -300, None]:
        stat = EfficacyStats(
            user_id=USER_ID,
            suggestion_id=uuid.uuid4(),
            lap_delta_ms=delta,
        )
        db_session.add(stat)
    await db_session.commit()

    resp = await client.get("/progress/efficacy")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_suggestions"] == 3
    # 2 out of 3 have a measured delta
    assert body["adoption_rate"] == pytest.approx(2 / 3, rel=1e-2)
    assert body["avg_delta_by_status"]["applied"] == pytest.approx(-400.0)


# ═══════════════════════ SESSION HISTORY ═══════════════════════


async def test_session_history_empty(client: AsyncClient, user):
    resp = await client.get("/progress/sessions")
    assert resp.status_code == 200
    assert resp.json()["sessions"] == []


async def test_session_history_with_delta(
    client: AsyncClient, user, db_session
):
    """Delta = current - previous at same track. Negative = improvement."""
    await _create_session_chain(
        db_session, USER_ID, "Laguna Seca", date(2025, 1, 1), 95000
    )
    await _create_session_chain(
        db_session, USER_ID, "Laguna Seca", date(2025, 2, 1), 93000
    )

    resp = await client.get("/progress/sessions")
    assert resp.status_code == 200
    sessions = resp.json()["sessions"]
    assert len(sessions) == 2
    # First session has no previous
    assert sessions[0]["delta_from_previous_ms"] is None
    # Second session improved by 2 seconds
    assert sessions[1]["delta_from_previous_ms"] == -2000
