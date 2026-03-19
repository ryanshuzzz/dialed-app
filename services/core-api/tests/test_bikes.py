"""Tests for bike CRUD — soft delete, suspension spec, ownership checks."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import OTHER_USER_ID, USER_ID


# ── Create ──────────────────────────────────────────────────────────────────


async def test_create_bike_minimal(client: AsyncClient, user):
    resp = await client.post(
        "/garage/bikes", json={"make": "Honda", "model": "CBR600RR"}
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["make"] == "Honda"
    assert body["model"] == "CBR600RR"
    assert body["user_id"] == str(USER_ID)
    assert body["status"] == "owned"
    # Default suspension spec
    assert body["suspension_spec"]["schema_version"] == 1


async def test_create_bike_full(client: AsyncClient, user):
    resp = await client.post(
        "/garage/bikes",
        json={
            "make": "Ducati",
            "model": "Panigale V4",
            "year": 2024,
            "color": "Red",
            "mileage_km": 1200,
            "suspension_spec": {
                "schema_version": 1,
                "front": {"compression": 12, "rebound": 8},
                "rear": {"preload": 5.0},
            },
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["year"] == 2024
    spec = body["suspension_spec"]
    assert spec["front"]["compression"] == 12


async def test_create_bike_missing_required(client: AsyncClient, user):
    resp = await client.post("/garage/bikes", json={"make": "Honda"})
    assert resp.status_code == 422


# ── Read ────────────────────────────────────────────────────────────────────


async def test_list_bikes(client: AsyncClient, user, bike):
    resp = await client.get("/garage/bikes")
    assert resp.status_code == 200
    bikes = resp.json()
    assert len(bikes) == 1
    assert bikes[0]["make"] == "Yamaha"


async def test_get_bike_detail(client: AsyncClient, user, bike):
    resp = await client.get(f"/garage/bikes/{bike.id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == str(bike.id)
    # BikeDetail includes stats
    assert "stats" in body
    assert body["stats"]["maintenance_count"] == 0
    assert body["stats"]["session_count"] == 0


async def test_get_bike_not_found(client: AsyncClient, user):
    resp = await client.get(f"/garage/bikes/{uuid.uuid4()}")
    assert resp.status_code == 404


# ── Update ──────────────────────────────────────────────────────────────────


async def test_update_bike(client: AsyncClient, user, bike):
    resp = await client.patch(
        f"/garage/bikes/{bike.id}",
        json={"color": "Midnight Blue", "mileage_km": 6000},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["color"] == "Midnight Blue"
    assert body["mileage_km"] == 6000


async def test_update_bike_suspension_spec(client: AsyncClient, user, bike):
    resp = await client.patch(
        f"/garage/bikes/{bike.id}",
        json={
            "suspension_spec": {
                "schema_version": 1,
                "front": {"compression": 14, "rebound": 10},
            }
        },
    )
    assert resp.status_code == 200
    assert resp.json()["suspension_spec"]["front"]["compression"] == 14


# ── Soft delete ─────────────────────────────────────────────────────────────


async def test_delete_bike_soft(client: AsyncClient, user, bike):
    resp = await client.delete(f"/garage/bikes/{bike.id}")
    assert resp.status_code == 204

    # List should exclude deleted bike
    list_resp = await client.get("/garage/bikes")
    assert len(list_resp.json()) == 0

    # Detail should also 404
    detail = await client.get(f"/garage/bikes/{bike.id}")
    assert detail.status_code == 404


# ── Suspension spec validation ──────────────────────────────────────────────


async def test_suspension_spec_missing_schema_version(client: AsyncClient, user):
    resp = await client.post(
        "/garage/bikes",
        json={
            "make": "KTM",
            "model": "RC 390",
            "suspension_spec": {"front": {"compression": 5}},
        },
    )
    assert resp.status_code == 422


async def test_suspension_spec_wrong_version(client: AsyncClient, user):
    resp = await client.post(
        "/garage/bikes",
        json={
            "make": "KTM",
            "model": "RC 390",
            "suspension_spec": {"schema_version": 99},
        },
    )
    assert resp.status_code == 422


# ── Unauthorized access ────────────────────────────────────────────────────


async def test_access_other_users_bike(client: AsyncClient, user, other_bike):
    """Accessing another user's bike should return 403."""
    resp = await client.get(f"/garage/bikes/{other_bike.id}")
    assert resp.status_code == 403


async def test_delete_other_users_bike(client: AsyncClient, user, other_bike):
    resp = await client.delete(f"/garage/bikes/{other_bike.id}")
    assert resp.status_code == 403


async def test_update_other_users_bike(client: AsyncClient, user, other_bike):
    resp = await client.patch(
        f"/garage/bikes/{other_bike.id}", json={"color": "Black"}
    )
    assert resp.status_code == 403
