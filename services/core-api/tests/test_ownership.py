"""Tests for ownership timeline — create, list, delete."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


# ── Create ──────────────────────────────────────────────────────────────────


async def test_create_ownership_event(client: AsyncClient, user, bike):
    resp = await client.post(
        f"/garage/bikes/{bike.id}/ownership",
        json={
            "event_type": "purchased",
            "date": "2024-01-15",
            "price": 15000,
            "mileage_km": 0,
            "counterparty": "Dealer ABC",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["event_type"] == "purchased"
    assert body["price"] == 15000
    assert body["counterparty"] == "Dealer ABC"


async def test_create_ownership_invalid_event_type(
    client: AsyncClient, user, bike
):
    resp = await client.post(
        f"/garage/bikes/{bike.id}/ownership",
        json={"event_type": "STOLEN", "date": "2024-01-15"},
    )
    assert resp.status_code == 422


async def test_create_ownership_missing_date(client: AsyncClient, user, bike):
    resp = await client.post(
        f"/garage/bikes/{bike.id}/ownership",
        json={"event_type": "purchased"},
    )
    assert resp.status_code == 422


# ── List timeline ───────────────────────────────────────────────────────────


async def test_list_ownership_timeline(client: AsyncClient, user, bike):
    await client.post(
        f"/garage/bikes/{bike.id}/ownership",
        json={"event_type": "purchased", "date": "2022-06-01"},
    )
    await client.post(
        f"/garage/bikes/{bike.id}/ownership",
        json={"event_type": "traded", "date": "2024-01-01"},
    )

    resp = await client.get(f"/garage/bikes/{bike.id}/ownership")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 2
    # Ordered by date descending
    assert items[0]["date"] == "2024-01-01"
    assert items[1]["date"] == "2022-06-01"


# ── Delete ──────────────────────────────────────────────────────────────────


async def test_delete_ownership_event(client: AsyncClient, user, bike):
    create_resp = await client.post(
        f"/garage/bikes/{bike.id}/ownership",
        json={"event_type": "gifted", "date": "2023-12-25"},
    )
    oid = create_resp.json()["id"]

    resp = await client.delete(f"/garage/bikes/{bike.id}/ownership/{oid}")
    assert resp.status_code == 204

    list_resp = await client.get(f"/garage/bikes/{bike.id}/ownership")
    assert len(list_resp.json()) == 0


async def test_delete_ownership_not_found(client: AsyncClient, user, bike):
    resp = await client.delete(
        f"/garage/bikes/{bike.id}/ownership/{uuid.uuid4()}"
    )
    assert resp.status_code == 404


# ── Bike ownership check ───────────────────────────────────────────────────


async def test_ownership_on_other_users_bike(
    client: AsyncClient, user, other_bike
):
    resp = await client.get(f"/garage/bikes/{other_bike.id}/ownership")
    assert resp.status_code == 403
