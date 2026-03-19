"""Tests for sessions, tracks, events, setup snapshots, and change log."""

from __future__ import annotations

import uuid
from datetime import date

import pytest
from httpx import AsyncClient

from tests.conftest import USER_ID


# ═══════════════════════ TRACKS ═══════════════════════


async def test_create_track(client: AsyncClient, user):
    resp = await client.post(
        "/garage/tracks",
        json={"name": "Barber Motorsports Park", "config": "Full"},
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == "Barber Motorsports Park"


async def test_list_tracks(client: AsyncClient, user, track):
    resp = await client.get("/garage/tracks")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


async def test_get_track(client: AsyncClient, user, track):
    resp = await client.get(f"/garage/tracks/{track.id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Laguna Seca"


async def test_update_track(client: AsyncClient, user, track):
    resp = await client.patch(
        f"/garage/tracks/{track.id}",
        json={"surface_notes": "Freshly resurfaced T6"},
    )
    assert resp.status_code == 200
    assert resp.json()["surface_notes"] == "Freshly resurfaced T6"


async def test_delete_track(client: AsyncClient, user, track):
    resp = await client.delete(f"/garage/tracks/{track.id}")
    assert resp.status_code == 204

    detail = await client.get(f"/garage/tracks/{track.id}")
    assert detail.status_code == 404


async def test_get_track_not_found(client: AsyncClient, user):
    resp = await client.get(f"/garage/tracks/{uuid.uuid4()}")
    assert resp.status_code == 404


# ═══════════════════════ EVENTS ═══════════════════════


async def test_create_event(client: AsyncClient, user, bike, track):
    resp = await client.post(
        "/garage/events",
        json={
            "bike_id": str(bike.id),
            "track_id": str(track.id),
            "date": "2025-07-04",
            "conditions": {"temp_c": 30, "condition": "dry"},
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["date"] == "2025-07-04"
    assert body["conditions"]["temp_c"] == 30


async def test_list_events(client: AsyncClient, user, event):
    resp = await client.get("/garage/events")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


async def test_list_events_filter_bike(client: AsyncClient, user, event, bike):
    resp = await client.get(
        "/garage/events", params={"bike_id": str(bike.id)}
    )
    assert resp.status_code == 200
    assert all(e["bike_id"] == str(bike.id) for e in resp.json())


async def test_get_event_not_found(client: AsyncClient, user):
    resp = await client.get(f"/garage/events/{uuid.uuid4()}")
    assert resp.status_code == 404


async def test_delete_event(client: AsyncClient, user, event):
    resp = await client.delete(f"/garage/events/{event.id}")
    assert resp.status_code == 204


# ═══════════════════════ SESSIONS ═══════════════════════


async def test_create_session(client: AsyncClient, user, event):
    resp = await client.post(
        "/sessions",
        json={
            "event_id": str(event.id),
            "session_type": "practice",
            "manual_best_lap_ms": 92000,
            "rider_feedback": "Rear felt loose through T5",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["session_type"] == "practice"
    assert body["manual_best_lap_ms"] == 92000
    assert body["user_id"] == str(USER_ID)


async def test_create_session_with_tires(client: AsyncClient, user, event):
    resp = await client.post(
        "/sessions",
        json={
            "event_id": str(event.id),
            "session_type": "qualifying",
            "tire_front": {"brand": "Pirelli", "compound": "SC1", "laps": 0},
            "tire_rear": {"brand": "Pirelli", "compound": "SC2", "laps": 0},
        },
    )
    assert resp.status_code == 201
    assert resp.json()["tire_front"]["brand"] == "Pirelli"


async def test_create_session_invalid_type(client: AsyncClient, user, event):
    resp = await client.post(
        "/sessions",
        json={"event_id": str(event.id), "session_type": "INVALID"},
    )
    assert resp.status_code == 422


async def test_create_session_event_not_found(client: AsyncClient, user):
    resp = await client.post(
        "/sessions",
        json={"event_id": str(uuid.uuid4()), "session_type": "practice"},
    )
    assert resp.status_code == 404


async def test_list_sessions(client: AsyncClient, user, session_record):
    resp = await client.get("/sessions")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


async def test_list_sessions_filter_event(
    client: AsyncClient, user, event, session_record
):
    resp = await client.get("/sessions", params={"event_id": str(event.id)})
    assert resp.status_code == 200
    assert all(s["event_id"] == str(event.id) for s in resp.json())


async def test_get_session_detail(client: AsyncClient, user, session_record):
    resp = await client.get(f"/sessions/{session_record.id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == str(session_record.id)
    # SessionDetail includes embedded lists
    assert "snapshots" in body
    assert "changes" in body
    assert isinstance(body["snapshots"], list)


async def test_get_session_not_found(client: AsyncClient, user):
    resp = await client.get(f"/sessions/{uuid.uuid4()}")
    assert resp.status_code == 404


async def test_update_session(client: AsyncClient, user, session_record):
    resp = await client.patch(
        f"/sessions/{session_record.id}",
        json={"manual_best_lap_ms": 91500, "rider_feedback": "Much better"},
    )
    assert resp.status_code == 200
    assert resp.json()["manual_best_lap_ms"] == 91500


# ═══════════════════════ SETUP SNAPSHOTS (append-only) ═══════════════════════


async def test_create_snapshot(client: AsyncClient, user, session_record):
    resp = await client.post(
        f"/sessions/{session_record.id}/snapshot",
        json={
            "settings": {
                "schema_version": 1,
                "front": {"compression": 10, "rebound": 6},
                "rear": {"preload": 5.5},
            }
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["session_id"] == str(session_record.id)
    assert body["settings"]["front"]["compression"] == 10


async def test_create_multiple_snapshots(
    client: AsyncClient, user, session_record
):
    """Append-only: multiple snapshots can be created for the same session."""
    s1 = await client.post(
        f"/sessions/{session_record.id}/snapshot",
        json={"settings": {"schema_version": 1, "front": {"compression": 10}}},
    )
    s2 = await client.post(
        f"/sessions/{session_record.id}/snapshot",
        json={"settings": {"schema_version": 1, "front": {"compression": 12}}},
    )
    assert s1.status_code == 201
    assert s2.status_code == 201
    assert s1.json()["id"] != s2.json()["id"]

    # Both appear in session detail
    detail = await client.get(f"/sessions/{session_record.id}")
    assert len(detail.json()["snapshots"]) == 2


async def test_snapshot_no_update_or_delete(
    client: AsyncClient, user, session_record
):
    """Snapshots are append-only: no PATCH or DELETE routes exist."""
    create_resp = await client.post(
        f"/sessions/{session_record.id}/snapshot",
        json={"settings": {"schema_version": 1}},
    )
    snap_id = create_resp.json()["id"]

    # No PATCH route
    patch = await client.patch(
        f"/sessions/{session_record.id}/snapshot/{snap_id}",
        json={"settings": {"schema_version": 1}},
    )
    assert patch.status_code in (404, 405)

    # No DELETE route
    delete = await client.delete(
        f"/sessions/{session_record.id}/snapshot/{snap_id}"
    )
    assert delete.status_code in (404, 405)


# ═══════════════════════ CHANGE LOG ═══════════════════════


async def test_create_change_log(client: AsyncClient, user, session_record):
    resp = await client.post(
        f"/sessions/{session_record.id}/changes",
        json={
            "parameter": "front.compression",
            "from_value": "10",
            "to_value": "12",
            "rationale": "Too stiff on braking",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["parameter"] == "front.compression"
    assert body["from_value"] == "10"
    assert body["to_value"] == "12"


async def test_create_change_log_null_from_value(
    client: AsyncClient, user, session_record
):
    """null from_value = first-time setting."""
    resp = await client.post(
        f"/sessions/{session_record.id}/changes",
        json={
            "parameter": "rear.rebound",
            "from_value": None,
            "to_value": "8",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["from_value"] is None


async def test_list_change_log(client: AsyncClient, user, session_record):
    await client.post(
        f"/sessions/{session_record.id}/changes",
        json={"parameter": "front.compression", "to_value": "12"},
    )
    await client.post(
        f"/sessions/{session_record.id}/changes",
        json={"parameter": "rear.preload", "to_value": "5"},
    )

    resp = await client.get(f"/sessions/{session_record.id}/changes")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 2


async def test_change_log_session_not_found(client: AsyncClient, user):
    resp = await client.post(
        f"/sessions/{uuid.uuid4()}/changes",
        json={"parameter": "front.compression", "to_value": "12"},
    )
    assert resp.status_code == 404
