"""Tests for auth endpoints — register, login, refresh, profile, API keys."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import USER_ID


# ── Registration ────────────────────────────────────────────────────────────


async def test_register_success(client: AsyncClient):
    resp = await client.post(
        "/auth/register",
        json={"email": "new@example.com", "password": "strongpass1"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert "user_id" in body
    assert "token" in body
    assert "refresh_token" in body


async def test_register_duplicate_email(client: AsyncClient):
    await client.post(
        "/auth/register",
        json={"email": "dup@example.com", "password": "strongpass1"},
    )
    resp = await client.post(
        "/auth/register",
        json={"email": "dup@example.com", "password": "otherpass1"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "VALIDATION_ERROR"


async def test_register_short_password(client: AsyncClient):
    resp = await client.post(
        "/auth/register",
        json={"email": "short@example.com", "password": "abc"},
    )
    assert resp.status_code == 422


async def test_register_missing_email(client: AsyncClient):
    resp = await client.post("/auth/register", json={"password": "strongpass1"})
    assert resp.status_code == 422


# ── Login ───────────────────────────────────────────────────────────────────


async def test_login_success(client: AsyncClient):
    await client.post(
        "/auth/register",
        json={"email": "login@example.com", "password": "strongpass1"},
    )
    resp = await client.post(
        "/auth/login",
        json={"email": "login@example.com", "password": "strongpass1"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "token" in body
    assert "refresh_token" in body


async def test_login_wrong_password(client: AsyncClient):
    await client.post(
        "/auth/register",
        json={"email": "login2@example.com", "password": "strongpass1"},
    )
    resp = await client.post(
        "/auth/login",
        json={"email": "login2@example.com", "password": "wrongpassword"},
    )
    assert resp.status_code == 401
    assert resp.json()["code"] == "UNAUTHORIZED"


async def test_login_nonexistent_email(client: AsyncClient):
    resp = await client.post(
        "/auth/login",
        json={"email": "nobody@example.com", "password": "strongpass1"},
    )
    assert resp.status_code == 401


# ── Token refresh ───────────────────────────────────────────────────────────


async def test_refresh_success(client: AsyncClient):
    reg = await client.post(
        "/auth/register",
        json={"email": "refresh@example.com", "password": "strongpass1"},
    )
    refresh_token = reg.json()["refresh_token"]

    resp = await client.post(
        "/auth/refresh", json={"refresh_token": refresh_token}
    )
    assert resp.status_code == 200
    assert "token" in resp.json()


async def test_refresh_invalid_token(client: AsyncClient):
    resp = await client.post(
        "/auth/refresh", json={"refresh_token": "garbage.token.value"}
    )
    assert resp.status_code == 401


# ── Profile ─────────────────────────────────────────────────────────────────


async def test_get_profile(client: AsyncClient, user):
    resp = await client.get("/auth/me")
    assert resp.status_code == 200
    body = resp.json()
    assert body["user_id"] == str(USER_ID)
    assert body["email"] == "rider@example.com"
    assert body["skill_level"] == "novice"
    assert body["rider_type"] == "street"
    assert body["units"] == "metric"


async def test_update_profile(client: AsyncClient, user):
    resp = await client.patch(
        "/auth/me",
        json={"skill_level": "expert", "rider_type": "competitive"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["skill_level"] == "expert"
    assert body["rider_type"] == "competitive"


async def test_update_profile_display_name(client: AsyncClient, user):
    resp = await client.patch("/auth/me", json={"display_name": "Speed Racer"})
    assert resp.status_code == 200
    assert resp.json()["display_name"] == "Speed Racer"


# ── API Keys ────────────────────────────────────────────────────────────────


async def test_create_api_key(client: AsyncClient, user):
    resp = await client.put(
        "/auth/me/api-keys", json={"name": "Paddock laptop"}
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Paddock laptop"
    assert body["key"].startswith("dk_")
    assert "id" in body
    assert "created_at" in body


async def test_list_api_keys(client: AsyncClient, user):
    await client.put("/auth/me/api-keys", json={"name": "Key A"})
    await client.put("/auth/me/api-keys", json={"name": "Key B"})

    resp = await client.get("/auth/me/api-keys")
    assert resp.status_code == 200
    keys = resp.json()
    assert isinstance(keys, list)
    assert len(keys) == 2
    # Raw key must never appear in list
    for k in keys:
        assert "key" not in k
        assert "name" in k
        assert "id" in k


async def test_delete_api_key(client: AsyncClient, user):
    create_resp = await client.put(
        "/auth/me/api-keys", json={"name": "Disposable"}
    )
    key_id = create_resp.json()["id"]

    resp = await client.delete(f"/auth/me/api-keys/{key_id}")
    assert resp.status_code == 204

    # Confirm deleted
    list_resp = await client.get("/auth/me/api-keys")
    assert len(list_resp.json()) == 0


async def test_delete_api_key_not_found(client: AsyncClient, user):
    resp = await client.delete(f"/auth/me/api-keys/{uuid.uuid4()}")
    assert resp.status_code == 404
