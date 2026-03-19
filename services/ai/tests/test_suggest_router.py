"""Tests for the suggest router endpoints."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from models import Base, GenerationJob, Suggestion, SuggestionChange


# ── Fixtures ──

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


def _register_sqlite_functions(dbapi_conn, connection_record):
    import uuid as _uuid
    dbapi_conn.create_function("gen_random_uuid", 0, lambda: str(_uuid.uuid4()))


@pytest_asyncio.fixture
async def setup():
    """Create test DB, app, and client."""
    from sqlalchemy import event as sa_event

    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    sa_event.listen(engine.sync_engine, "connect", _register_sqlite_functions)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    from main import create_app
    app = create_app()

    user_id = uuid.uuid4()

    async def _override_get_session():
        async with session_factory() as session:
            yield session

    async def _override_get_current_user():
        return {"user_id": str(user_id), "email": "test@dialed.cc"}

    from db import get_session
    from dialed_shared import get_current_user

    app.dependency_overrides[get_session] = _override_get_session
    app.dependency_overrides[get_current_user] = _override_get_current_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client, session_factory, user_id

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


# ── POST /suggest ──


@pytest.mark.asyncio
async def test_post_suggest_creates_job(setup):
    client, session_factory, _ = setup
    session_id = uuid.uuid4()
    fake_job_id = uuid.uuid4()

    with patch(
        "routers.suggest.create_generation_job",
        new_callable=AsyncMock,
        return_value=fake_job_id,
    ):
        resp = await client.post("/suggest", json={"session_id": str(session_id)})

    assert resp.status_code == 202
    data = resp.json()
    assert data["job_id"] == str(fake_job_id)


# ── GET /suggest/session/{session_id} ──


@pytest.mark.asyncio
async def test_list_session_suggestions(setup):
    client, session_factory, user_id = setup
    session_id = uuid.uuid4()

    # Insert test data
    async with session_factory() as db:
        suggestion = Suggestion(
            id=uuid.uuid4(),
            session_id=session_id,
            user_id=user_id,
            suggestion_text="Adjust front compression",
        )
        db.add(suggestion)
        change = SuggestionChange(
            id=uuid.uuid4(),
            suggestion_id=suggestion.id,
            parameter="front.compression",
            suggested_value="+2 clicks",
            applied_status="not_applied",
        )
        db.add(change)
        await db.commit()

    resp = await client.get(f"/suggest/session/{session_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["session_id"] == str(session_id)
    assert data[0]["change_count"] == 1


@pytest.mark.asyncio
async def test_list_session_suggestions_empty(setup):
    client, _, _ = setup
    resp = await client.get(f"/suggest/session/{uuid.uuid4()}")
    assert resp.status_code == 200
    assert resp.json() == []


# ── GET /suggest/{suggestion_id} ──


@pytest.mark.asyncio
async def test_get_suggestion_detail(setup):
    client, session_factory, user_id = setup
    suggestion_id = uuid.uuid4()

    async with session_factory() as db:
        suggestion = Suggestion(
            id=suggestion_id,
            session_id=uuid.uuid4(),
            user_id=user_id,
            suggestion_text="Test suggestion",
        )
        db.add(suggestion)
        change = SuggestionChange(
            id=uuid.uuid4(),
            suggestion_id=suggestion_id,
            parameter="rear.rebound",
            suggested_value="+1 click",
            applied_status="not_applied",
        )
        db.add(change)
        await db.commit()

    resp = await client.get(f"/suggest/{suggestion_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(suggestion_id)
    assert len(data["changes"]) == 1
    assert data["changes"][0]["parameter"] == "rear.rebound"


@pytest.mark.asyncio
async def test_get_suggestion_not_found(setup):
    client, _, _ = setup
    resp = await client.get(f"/suggest/{uuid.uuid4()}")
    assert resp.status_code == 404


# ── PATCH /suggest/{suggestion_id}/changes/{change_id} ──


@pytest.mark.asyncio
async def test_update_change_status(setup):
    client, session_factory, user_id = setup
    suggestion_id = uuid.uuid4()
    change_id = uuid.uuid4()

    async with session_factory() as db:
        suggestion = Suggestion(
            id=suggestion_id,
            session_id=uuid.uuid4(),
            user_id=user_id,
            suggestion_text="Test",
        )
        db.add(suggestion)
        change = SuggestionChange(
            id=change_id,
            suggestion_id=suggestion_id,
            parameter="front.compression",
            suggested_value="+2 clicks",
            applied_status="not_applied",
        )
        db.add(change)
        await db.commit()

    resp = await client.patch(
        f"/suggest/{suggestion_id}/changes/{change_id}",
        json={"applied_status": "applied"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["applied_status"] == "applied"
    assert data["applied_at"] is not None


@pytest.mark.asyncio
async def test_invalid_transition(setup):
    client, session_factory, user_id = setup
    suggestion_id = uuid.uuid4()
    change_id = uuid.uuid4()

    async with session_factory() as db:
        suggestion = Suggestion(
            id=suggestion_id,
            session_id=uuid.uuid4(),
            user_id=user_id,
            suggestion_text="Test",
        )
        db.add(suggestion)
        change = SuggestionChange(
            id=change_id,
            suggestion_id=suggestion_id,
            parameter="front.compression",
            suggested_value="+2 clicks",
            applied_status="applied",
        )
        db.add(change)
        await db.commit()

    # applied → not_applied is not allowed
    resp = await client.patch(
        f"/suggest/{suggestion_id}/changes/{change_id}",
        json={"applied_status": "not_applied"},
    )
    assert resp.status_code == 422


# ── PATCH /suggest/{suggestion_id}/changes/{change_id}/outcome ──


@pytest.mark.asyncio
async def test_record_outcome(setup):
    client, session_factory, user_id = setup
    suggestion_id = uuid.uuid4()
    change_id = uuid.uuid4()

    async with session_factory() as db:
        suggestion = Suggestion(
            id=suggestion_id,
            session_id=uuid.uuid4(),
            user_id=user_id,
            suggestion_text="Test",
        )
        db.add(suggestion)
        change = SuggestionChange(
            id=change_id,
            suggestion_id=suggestion_id,
            parameter="front.compression",
            suggested_value="+2 clicks",
            applied_status="applied",
        )
        db.add(change)
        await db.commit()

    resp = await client.patch(
        f"/suggest/{suggestion_id}/changes/{change_id}/outcome",
        json={"outcome_lap_delta_ms": -500},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["outcome_lap_delta_ms"] == -500


@pytest.mark.asyncio
async def test_record_outcome_change_not_found(setup):
    client, _, _ = setup
    resp = await client.patch(
        f"/suggest/{uuid.uuid4()}/changes/{uuid.uuid4()}/outcome",
        json={"outcome_lap_delta_ms": -200},
    )
    assert resp.status_code == 404
