"""Tests for maintenance log CRUD and upcoming maintenance logic."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from httpx import AsyncClient


# ── Create ──────────────────────────────────────────────────────────────────


async def test_create_maintenance(client: AsyncClient, user, bike):
    resp = await client.post(
        f"/garage/bikes/{bike.id}/maintenance",
        json={
            "category": "oil_change",
            "performed_at": "2025-06-01",
            "mileage_km": 5000,
            "cost": 89.99,
            "next_due_km": 10000,
            "next_due_date": "2025-12-01",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["category"] == "oil_change"
    assert body["bike_id"] == str(bike.id)
    assert body["cost"] == 89.99


async def test_create_maintenance_invalid_category(client: AsyncClient, user, bike):
    resp = await client.post(
        f"/garage/bikes/{bike.id}/maintenance",
        json={"category": "INVALID_CAT", "performed_at": "2025-06-01"},
    )
    assert resp.status_code == 422


async def test_create_maintenance_missing_required(client: AsyncClient, user, bike):
    resp = await client.post(
        f"/garage/bikes/{bike.id}/maintenance",
        json={"category": "chain"},
    )
    assert resp.status_code == 422


# ── Read / List ─────────────────────────────────────────────────────────────


async def test_list_maintenance(client: AsyncClient, user, bike):
    await client.post(
        f"/garage/bikes/{bike.id}/maintenance",
        json={"category": "chain", "performed_at": "2025-05-01"},
    )
    await client.post(
        f"/garage/bikes/{bike.id}/maintenance",
        json={"category": "oil_change", "performed_at": "2025-06-01"},
    )

    resp = await client.get(f"/garage/bikes/{bike.id}/maintenance")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


async def test_list_maintenance_filter_category(client: AsyncClient, user, bike):
    await client.post(
        f"/garage/bikes/{bike.id}/maintenance",
        json={"category": "chain", "performed_at": "2025-05-01"},
    )
    await client.post(
        f"/garage/bikes/{bike.id}/maintenance",
        json={"category": "oil_change", "performed_at": "2025-06-01"},
    )

    resp = await client.get(
        f"/garage/bikes/{bike.id}/maintenance", params={"category": "chain"}
    )
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["category"] == "chain"


async def test_get_maintenance_detail(client: AsyncClient, user, bike):
    create_resp = await client.post(
        f"/garage/bikes/{bike.id}/maintenance",
        json={"category": "brake_pads", "performed_at": "2025-07-01"},
    )
    mid = create_resp.json()["id"]

    resp = await client.get(f"/garage/bikes/{bike.id}/maintenance/{mid}")
    assert resp.status_code == 200
    assert resp.json()["id"] == mid


async def test_get_maintenance_not_found(client: AsyncClient, user, bike):
    resp = await client.get(
        f"/garage/bikes/{bike.id}/maintenance/{uuid.uuid4()}"
    )
    assert resp.status_code == 404


# ── Update ──────────────────────────────────────────────────────────────────


async def test_update_maintenance(client: AsyncClient, user, bike):
    create_resp = await client.post(
        f"/garage/bikes/{bike.id}/maintenance",
        json={"category": "chain", "performed_at": "2025-05-01", "cost": 30},
    )
    mid = create_resp.json()["id"]

    resp = await client.patch(
        f"/garage/bikes/{bike.id}/maintenance/{mid}",
        json={"cost": 45, "notes": "Used premium chain lube"},
    )
    assert resp.status_code == 200
    assert resp.json()["cost"] == 45
    assert resp.json()["notes"] == "Used premium chain lube"


# ── Delete ──────────────────────────────────────────────────────────────────


async def test_delete_maintenance(client: AsyncClient, user, bike):
    create_resp = await client.post(
        f"/garage/bikes/{bike.id}/maintenance",
        json={"category": "spark_plugs", "performed_at": "2025-04-01"},
    )
    mid = create_resp.json()["id"]

    resp = await client.delete(f"/garage/bikes/{bike.id}/maintenance/{mid}")
    assert resp.status_code == 204

    detail = await client.get(f"/garage/bikes/{bike.id}/maintenance/{mid}")
    assert detail.status_code == 404


# ── Upcoming maintenance ────────────────────────────────────────────────────


async def test_upcoming_maintenance_by_km(client: AsyncClient, user, bike):
    """Bike has 5000 km. A record with next_due_km=5400 is within 500 km."""
    await client.post(
        f"/garage/bikes/{bike.id}/maintenance",
        json={
            "category": "oil_change",
            "performed_at": "2025-01-01",
            "next_due_km": 5400,
        },
    )
    resp = await client.get(f"/garage/bikes/{bike.id}/maintenance/upcoming")
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["next_due_km"] == 5400
    assert items[0]["current_mileage_km"] == 5000


async def test_upcoming_maintenance_by_date(client: AsyncClient, user, bike):
    """A record with next_due_date within 30 days of today should appear."""
    soon = (date.today() + timedelta(days=10)).isoformat()
    await client.post(
        f"/garage/bikes/{bike.id}/maintenance",
        json={
            "category": "brake_fluid",
            "performed_at": "2025-01-01",
            "next_due_date": soon,
        },
    )
    resp = await client.get(f"/garage/bikes/{bike.id}/maintenance/upcoming")
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 1


async def test_upcoming_maintenance_excludes_far_items(
    client: AsyncClient, user, bike
):
    """A record due in 60 days and 2000 km away should NOT appear."""
    far_date = (date.today() + timedelta(days=60)).isoformat()
    await client.post(
        f"/garage/bikes/{bike.id}/maintenance",
        json={
            "category": "valve_check",
            "performed_at": "2025-01-01",
            "next_due_km": 8000,
            "next_due_date": far_date,
        },
    )
    resp = await client.get(f"/garage/bikes/{bike.id}/maintenance/upcoming")
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 0


# ── Maintenance on deleted bike ─────────────────────────────────────────────


async def test_maintenance_on_deleted_bike_returns_404(
    client: AsyncClient, user, bike
):
    await client.delete(f"/garage/bikes/{bike.id}")
    resp = await client.get(f"/garage/bikes/{bike.id}/maintenance")
    assert resp.status_code == 404
