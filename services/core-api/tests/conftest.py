"""Shared fixtures for core-api tests.

Requires a running PostgreSQL instance.  Set TEST_DATABASE_URL or accept the
default ``postgresql+asyncpg://<user>@localhost:5432/dialed_test``.
Create the database once before running the suite::

    createdb dialed_test
"""

from __future__ import annotations

import asyncio
import os
import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:devpassword@localhost:5432/dialed_test",
)

# Deterministic user IDs for test isolation
USER_ID = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
OTHER_USER_ID = uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")


# ── Database lifecycle ──────────────────────────────────────────────────────


@pytest.fixture(scope="session", autouse=True)
def _create_tables():
    """Create the core schema and all tables once per test session."""
    from models import Base

    async def _up():
        engine = create_async_engine(TEST_DATABASE_URL)
        async with engine.begin() as conn:
            await conn.execute(text("CREATE SCHEMA IF NOT EXISTS core"))
            await conn.run_sync(Base.metadata.create_all)
        await engine.dispose()

    async def _down():
        engine = create_async_engine(TEST_DATABASE_URL)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()

    asyncio.run(_up())
    yield
    asyncio.run(_down())


@pytest_asyncio.fixture(autouse=True)
async def _clean_tables():
    """Truncate every table after each test for full isolation."""
    yield
    from models import Base

    engine = create_async_engine(TEST_DATABASE_URL)
    try:
        async with engine.begin() as conn:
            for table in reversed(Base.metadata.sorted_tables):
                await conn.execute(text(f"TRUNCATE {table.fullname} CASCADE"))
    finally:
        await engine.dispose()


# ── Database session for factory helpers ────────────────────────────────────


@pytest_asyncio.fixture()
async def db_session():
    """Provide an async session for factory fixtures and direct DB assertions."""
    engine = create_async_engine(TEST_DATABASE_URL)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


# ── FastAPI test client ─────────────────────────────────────────────────────


def _make_client_fixture(user_id: uuid.UUID):
    """Factory for creating authenticated test client fixtures."""

    @pytest_asyncio.fixture()
    async def _client():
        from db import get_session
        from dialed_shared.auth import get_current_user
        from main import app

        engine = create_async_engine(TEST_DATABASE_URL)
        factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        async def _override_session():
            async with factory() as session:
                yield session

        async def _override_user():
            return {"user_id": str(user_id)}

        app.dependency_overrides[get_session] = _override_session
        app.dependency_overrides[get_current_user] = _override_user

        transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac

        app.dependency_overrides.clear()
        await engine.dispose()

    return _client


client = _make_client_fixture(USER_ID)
other_client = _make_client_fixture(OTHER_USER_ID)


# ── Factory fixtures ────────────────────────────────────────────────────────


@pytest_asyncio.fixture()
async def user(db_session: AsyncSession):
    """Create the standard test user (USER_ID)."""
    from models.user import User

    u = User(id=USER_ID, email="rider@example.com")
    db_session.add(u)
    await db_session.commit()
    await db_session.refresh(u)
    return u


@pytest_asyncio.fixture()
async def other_user(db_session: AsyncSession):
    """Create a second test user (OTHER_USER_ID)."""
    from models.user import User

    u = User(id=OTHER_USER_ID, email="other@example.com")
    db_session.add(u)
    await db_session.commit()
    await db_session.refresh(u)
    return u


@pytest_asyncio.fixture()
async def bike(db_session: AsyncSession, user):
    """Create a default bike owned by USER_ID."""
    from models.bike import Bike

    b = Bike(
        user_id=user.id,
        make="Yamaha",
        model="YZF-R1",
        year=2024,
        mileage_km=5000,
        suspension_spec={"schema_version": 1},
    )
    db_session.add(b)
    await db_session.commit()
    await db_session.refresh(b)
    return b


@pytest_asyncio.fixture()
async def other_bike(db_session: AsyncSession, other_user):
    """Create a bike owned by OTHER_USER_ID."""
    from models.bike import Bike

    b = Bike(
        user_id=other_user.id,
        make="Ducati",
        model="Panigale V4",
        suspension_spec={"schema_version": 1},
    )
    db_session.add(b)
    await db_session.commit()
    await db_session.refresh(b)
    return b


@pytest_asyncio.fixture()
async def track(db_session: AsyncSession):
    """Create a test track."""
    from models.track import Track

    t = Track(name="Laguna Seca", config="Full")
    db_session.add(t)
    await db_session.commit()
    await db_session.refresh(t)
    return t


@pytest_asyncio.fixture()
async def event(db_session: AsyncSession, user, bike, track):
    """Create a test event owned by USER_ID."""
    from models.event import Event

    e = Event(
        user_id=user.id,
        bike_id=bike.id,
        track_id=track.id,
        date=date.today(),
        conditions={"temp_c": 25, "condition": "dry"},
    )
    db_session.add(e)
    await db_session.commit()
    await db_session.refresh(e)
    return e


@pytest_asyncio.fixture()
async def session_record(db_session: AsyncSession, user, event):
    """Create a test session linked to the test event."""
    from models.session import Session

    s = Session(
        event_id=event.id,
        user_id=user.id,
        session_type="practice",
        manual_best_lap_ms=95000,
    )
    db_session.add(s)
    await db_session.commit()
    await db_session.refresh(s)
    return s
