"""Tests for admin channel alias CRUD and unique constraint."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


# ── Create ──────────────────────────────────────────────────────────────────


async def test_create_channel_alias(client: AsyncClient, user):
    resp = await client.post(
        "/admin/channel-aliases",
        json={
            "raw_name": "GPS_Speed",
            "canonical_name": "speed",
            "logger_model": "AiM Solo 2",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["raw_name"] == "GPS_Speed"
    assert body["canonical_name"] == "speed"
    assert body["logger_model"] == "AiM Solo 2"
    assert "id" in body
    assert "created_at" in body


async def test_create_channel_alias_no_logger(client: AsyncClient, user):
    resp = await client.post(
        "/admin/channel-aliases",
        json={"raw_name": "RPM", "canonical_name": "engine_rpm"},
    )
    assert resp.status_code == 201
    assert resp.json()["logger_model"] is None


async def test_create_channel_alias_missing_required(
    client: AsyncClient, user
):
    resp = await client.post(
        "/admin/channel-aliases", json={"raw_name": "GPS_Speed"}
    )
    assert resp.status_code == 422


# ── List ────────────────────────────────────────────────────────────────────


async def test_list_channel_aliases(client: AsyncClient, user):
    await client.post(
        "/admin/channel-aliases",
        json={"raw_name": "A_Channel", "canonical_name": "alpha"},
    )
    await client.post(
        "/admin/channel-aliases",
        json={"raw_name": "B_Channel", "canonical_name": "beta"},
    )

    resp = await client.get("/admin/channel-aliases")
    assert resp.status_code == 200
    aliases = resp.json()
    assert len(aliases) == 2
    # Ordered by raw_name
    assert aliases[0]["raw_name"] == "A_Channel"


# ── Update ──────────────────────────────────────────────────────────────────


async def test_update_channel_alias(client: AsyncClient, user):
    create_resp = await client.post(
        "/admin/channel-aliases",
        json={"raw_name": "Lat_G", "canonical_name": "lateral_g"},
    )
    alias_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/admin/channel-aliases/{alias_id}",
        json={"canonical_name": "lat_accel_g"},
    )
    assert resp.status_code == 200
    assert resp.json()["canonical_name"] == "lat_accel_g"


async def test_update_channel_alias_not_found(client: AsyncClient, user):
    resp = await client.patch(
        f"/admin/channel-aliases/{uuid.uuid4()}",
        json={"canonical_name": "nope"},
    )
    assert resp.status_code == 404


# ── Delete ──────────────────────────────────────────────────────────────────


async def test_delete_channel_alias(client: AsyncClient, user):
    create_resp = await client.post(
        "/admin/channel-aliases",
        json={"raw_name": "Temp_Water", "canonical_name": "coolant_temp"},
    )
    alias_id = create_resp.json()["id"]

    resp = await client.delete(f"/admin/channel-aliases/{alias_id}")
    assert resp.status_code == 204

    list_resp = await client.get("/admin/channel-aliases")
    assert len(list_resp.json()) == 0


async def test_delete_channel_alias_not_found(client: AsyncClient, user):
    resp = await client.delete(f"/admin/channel-aliases/{uuid.uuid4()}")
    assert resp.status_code == 404


# ── Unique constraint (raw_name, logger_model) ─────────────────────────────


async def test_unique_constraint_same_logger(client: AsyncClient, user):
    """Duplicate (raw_name, logger_model) should fail."""
    await client.post(
        "/admin/channel-aliases",
        json={
            "raw_name": "GPS_Speed",
            "canonical_name": "speed",
            "logger_model": "AiM Solo 2",
        },
    )
    resp = await client.post(
        "/admin/channel-aliases",
        json={
            "raw_name": "GPS_Speed",
            "canonical_name": "gps_speed",
            "logger_model": "AiM Solo 2",
        },
    )
    assert resp.status_code == 500  # IntegrityError → internal error


async def test_unique_constraint_different_logger_ok(
    client: AsyncClient, user
):
    """Same raw_name with different logger_model is allowed."""
    r1 = await client.post(
        "/admin/channel-aliases",
        json={
            "raw_name": "GPS_Speed",
            "canonical_name": "speed",
            "logger_model": "AiM Solo 2",
        },
    )
    r2 = await client.post(
        "/admin/channel-aliases",
        json={
            "raw_name": "GPS_Speed",
            "canonical_name": "gps_speed",
            "logger_model": "RaceCapture Pro",
        },
    )
    assert r1.status_code == 201
    assert r2.status_code == 201
