"""Tests for modification CRUD — status/category filters."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


# ── Create ──────────────────────────────────────────────────────────────────


async def test_create_modification(client: AsyncClient, user, bike):
    resp = await client.post(
        f"/garage/bikes/{bike.id}/mods",
        json={
            "action": "installed",
            "category": "exhaust",
            "part_name": "Akrapovic Full System",
            "brand": "Akrapovic",
            "cost": 2200,
            "installed_at": "2025-03-15",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["part_name"] == "Akrapovic Full System"
    assert body["action"] == "installed"
    assert body["category"] == "exhaust"
    assert body["removed_at"] is None


async def test_create_modification_cosmetics_category(
    client: AsyncClient, user, bike
):
    resp = await client.post(
        f"/garage/bikes/{bike.id}/mods",
        json={
            "action": "installed",
            "category": "cosmetics",
            "part_name": "Custom fairing kit",
            "installed_at": "2025-03-15",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["category"] == "cosmetics"


async def test_create_modification_invalid_category(
    client: AsyncClient, user, bike
):
    resp = await client.post(
        f"/garage/bikes/{bike.id}/mods",
        json={
            "action": "installed",
            "category": "NONEXISTENT",
            "part_name": "Widget",
            "installed_at": "2025-03-15",
        },
    )
    assert resp.status_code == 422


async def test_create_modification_invalid_action(
    client: AsyncClient, user, bike
):
    resp = await client.post(
        f"/garage/bikes/{bike.id}/mods",
        json={
            "action": "DESTROYED",
            "category": "exhaust",
            "part_name": "Widget",
            "installed_at": "2025-03-15",
        },
    )
    assert resp.status_code == 422


# ── Read / List ─────────────────────────────────────────────────────────────


async def test_list_modifications(client: AsyncClient, user, bike):
    await client.post(
        f"/garage/bikes/{bike.id}/mods",
        json={
            "action": "installed",
            "category": "exhaust",
            "part_name": "Full System",
            "installed_at": "2025-01-01",
        },
    )
    await client.post(
        f"/garage/bikes/{bike.id}/mods",
        json={
            "action": "upgraded",
            "category": "ecu",
            "part_name": "Flash Tune",
            "installed_at": "2025-02-01",
        },
    )

    resp = await client.get(f"/garage/bikes/{bike.id}/mods")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


async def test_list_modifications_filter_category(
    client: AsyncClient, user, bike
):
    await client.post(
        f"/garage/bikes/{bike.id}/mods",
        json={
            "action": "installed",
            "category": "exhaust",
            "part_name": "System A",
            "installed_at": "2025-01-01",
        },
    )
    await client.post(
        f"/garage/bikes/{bike.id}/mods",
        json={
            "action": "installed",
            "category": "brakes",
            "part_name": "Steel lines",
            "installed_at": "2025-02-01",
        },
    )

    resp = await client.get(
        f"/garage/bikes/{bike.id}/mods", params={"category": "exhaust"}
    )
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["category"] == "exhaust"


async def test_list_modifications_filter_status_active(
    client: AsyncClient, user, bike
):
    """Active = removed_at IS NULL."""
    # Active mod
    await client.post(
        f"/garage/bikes/{bike.id}/mods",
        json={
            "action": "installed",
            "category": "exhaust",
            "part_name": "Active Pipe",
            "installed_at": "2025-01-01",
        },
    )
    # Removed mod
    await client.post(
        f"/garage/bikes/{bike.id}/mods",
        json={
            "action": "installed",
            "category": "exhaust",
            "part_name": "Old Pipe",
            "installed_at": "2024-01-01",
            "removed_at": "2025-01-01",
        },
    )

    active_resp = await client.get(
        f"/garage/bikes/{bike.id}/mods", params={"status": "active"}
    )
    assert len(active_resp.json()) == 1
    assert active_resp.json()[0]["part_name"] == "Active Pipe"

    removed_resp = await client.get(
        f"/garage/bikes/{bike.id}/mods", params={"status": "removed"}
    )
    assert len(removed_resp.json()) == 1
    assert removed_resp.json()[0]["part_name"] == "Old Pipe"


async def test_get_modification_detail(client: AsyncClient, user, bike):
    create_resp = await client.post(
        f"/garage/bikes/{bike.id}/mods",
        json={
            "action": "installed",
            "category": "suspension",
            "part_name": "Ohlins TTX",
            "installed_at": "2025-06-01",
        },
    )
    mod_id = create_resp.json()["id"]

    resp = await client.get(f"/garage/bikes/{bike.id}/mods/{mod_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == mod_id


async def test_get_modification_not_found(client: AsyncClient, user, bike):
    resp = await client.get(f"/garage/bikes/{bike.id}/mods/{uuid.uuid4()}")
    assert resp.status_code == 404


# ── Update ──────────────────────────────────────────────────────────────────


async def test_update_modification(client: AsyncClient, user, bike):
    create_resp = await client.post(
        f"/garage/bikes/{bike.id}/mods",
        json={
            "action": "installed",
            "category": "exhaust",
            "part_name": "Pipe V1",
            "installed_at": "2025-01-01",
        },
    )
    mod_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/garage/bikes/{bike.id}/mods/{mod_id}",
        json={"removed_at": "2025-06-01", "notes": "Upgraded to V2"},
    )
    assert resp.status_code == 200
    assert resp.json()["removed_at"] == "2025-06-01"
    assert resp.json()["notes"] == "Upgraded to V2"


# ── Delete ──────────────────────────────────────────────────────────────────


async def test_delete_modification(client: AsyncClient, user, bike):
    create_resp = await client.post(
        f"/garage/bikes/{bike.id}/mods",
        json={
            "action": "installed",
            "category": "brakes",
            "part_name": "SS Lines",
            "installed_at": "2025-01-01",
        },
    )
    mod_id = create_resp.json()["id"]

    resp = await client.delete(f"/garage/bikes/{bike.id}/mods/{mod_id}")
    assert resp.status_code == 204

    detail = await client.get(f"/garage/bikes/{bike.id}/mods/{mod_id}")
    assert detail.status_code == 404
