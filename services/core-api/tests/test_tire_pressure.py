"""Tests for tire pressure CRUD — context filter, date range, delete."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Create ──────────────────────────────────────────────────────────────────


async def test_create_tire_pressure(client: AsyncClient, user, bike):
    resp = await client.post(
        f"/garage/bikes/{bike.id}/tire-pressure",
        json={
            "front_psi": 32.5,
            "rear_psi": 30.0,
            "context": "pre_ride",
            "recorded_at": _now_iso(),
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["front_psi"] == 32.5
    assert body["rear_psi"] == 30.0
    assert body["context"] == "pre_ride"
    assert body["bike_id"] == str(bike.id)


async def test_create_tire_pressure_with_temps(client: AsyncClient, user, bike):
    resp = await client.post(
        f"/garage/bikes/{bike.id}/tire-pressure",
        json={
            "front_psi": 34.0,
            "rear_psi": 31.5,
            "front_temp_c": 45.0,
            "rear_temp_c": 52.0,
            "context": "post_session",
            "recorded_at": _now_iso(),
        },
    )
    assert resp.status_code == 201
    assert resp.json()["front_temp_c"] == 45.0


# ── List with context filter ───────────────────────────────────────────────


async def test_list_tire_pressure_filter_context(
    client: AsyncClient, user, bike
):
    now = _now_iso()
    await client.post(
        f"/garage/bikes/{bike.id}/tire-pressure",
        json={"front_psi": 32, "context": "cold", "recorded_at": now},
    )
    await client.post(
        f"/garage/bikes/{bike.id}/tire-pressure",
        json={"front_psi": 34, "context": "post_ride", "recorded_at": now},
    )

    resp = await client.get(
        f"/garage/bikes/{bike.id}/tire-pressure", params={"context": "cold"}
    )
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["context"] == "cold"


# ── List with date range ───────────────────────────────────────────────────


async def test_list_tire_pressure_date_range(client: AsyncClient, user, bike):
    base = datetime(2025, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
    old = (base - timedelta(days=30)).isoformat()
    recent = base.isoformat()

    await client.post(
        f"/garage/bikes/{bike.id}/tire-pressure",
        json={"front_psi": 32, "context": "pre_ride", "recorded_at": old},
    )
    await client.post(
        f"/garage/bikes/{bike.id}/tire-pressure",
        json={"front_psi": 33, "context": "pre_ride", "recorded_at": recent},
    )

    resp = await client.get(
        f"/garage/bikes/{bike.id}/tire-pressure",
        params={
            "from_date": (base - timedelta(days=1)).isoformat(),
            "to_date": (base + timedelta(days=1)).isoformat(),
        },
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 1


# ── Get detail ──────────────────────────────────────────────────────────────


async def test_get_tire_pressure_detail(client: AsyncClient, user, bike):
    create_resp = await client.post(
        f"/garage/bikes/{bike.id}/tire-pressure",
        json={"front_psi": 31, "context": "pit_stop", "recorded_at": _now_iso()},
    )
    rid = create_resp.json()["id"]

    resp = await client.get(f"/garage/bikes/{bike.id}/tire-pressure/{rid}")
    assert resp.status_code == 200
    assert resp.json()["id"] == rid


# ── Delete ──────────────────────────────────────────────────────────────────


async def test_delete_tire_pressure(client: AsyncClient, user, bike):
    create_resp = await client.post(
        f"/garage/bikes/{bike.id}/tire-pressure",
        json={"rear_psi": 29, "context": "pre_ride", "recorded_at": _now_iso()},
    )
    rid = create_resp.json()["id"]

    resp = await client.delete(f"/garage/bikes/{bike.id}/tire-pressure/{rid}")
    assert resp.status_code == 204

    detail = await client.get(f"/garage/bikes/{bike.id}/tire-pressure/{rid}")
    assert detail.status_code == 404
