"""Shared fixtures for AI service tests."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from models import Base, GenerationJob, Suggestion, SuggestionChange
from rules_engine import Flag
from services.context_gatherer import SessionContext


# ── Strip schema for SQLite ──
# SQLite doesn't support schemas. We strip them globally at import time
# so all ORM operations (CREATE, INSERT, SELECT) work without "ai." prefix.

_schema_stripped = False


def _strip_schemas():
    """Remove 'ai' schema from all model tables for SQLite compatibility."""
    global _schema_stripped
    if _schema_stripped:
        return
    for table in Base.metadata.sorted_tables:
        table.schema = None
        for fk in table.foreign_keys:
            if isinstance(fk._colspec, str) and fk._colspec.startswith("ai."):
                fk._colspec = fk._colspec[3:]
    _schema_stripped = True


_strip_schemas()


# ── Test database ──


TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


def _register_sqlite_functions(dbapi_conn, connection_record):
    """Register PostgreSQL-compatible functions for SQLite."""
    dbapi_conn.create_function("gen_random_uuid", 0, lambda: str(uuid.uuid4()))


@pytest_asyncio.fixture
async def db_engine():
    """Create a test database engine with all tables."""
    from sqlalchemy import event as sa_event

    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    sa_event.listen(engine.sync_engine, "connect", _register_sqlite_functions)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine):
    """Provide a transactional database session for tests."""
    session_factory = async_sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def db_session_factory(db_engine):
    """Provide a session factory for tests that need it."""
    return async_sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False
    )


# ── FastAPI test client ──


@pytest_asyncio.fixture
async def client(db_session_factory):
    """Async test client with mocked auth and DB session."""
    from main import create_app

    app = create_app()

    # Override DB dependency
    async def _override_get_session():
        async with db_session_factory() as session:
            yield session

    # Override auth dependency
    async def _override_get_current_user():
        return {"user_id": str(uuid.uuid4()), "email": "test@dialed.cc"}

    from db import get_session
    from dialed_shared import get_current_user

    app.dependency_overrides[get_session] = _override_get_session
    app.dependency_overrides[get_current_user] = _override_get_current_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ── Factory fixtures ──


@pytest.fixture
def make_suggestion():
    """Factory for creating Suggestion instances."""

    def _make(
        session_id: uuid.UUID | None = None,
        user_id: uuid.UUID | None = None,
        suggestion_text: str = "Test suggestion text",
    ) -> Suggestion:
        return Suggestion(
            id=uuid.uuid4(),
            session_id=session_id or uuid.uuid4(),
            user_id=user_id or uuid.uuid4(),
            suggestion_text=suggestion_text,
        )

    return _make


@pytest.fixture
def make_change():
    """Factory for creating SuggestionChange instances."""

    def _make(
        suggestion_id: uuid.UUID | None = None,
        parameter: str = "front.compression",
        suggested_value: str = "+2 clicks",
        symptom: str = "front push",
        confidence: float = 0.85,
        applied_status: str = "not_applied",
    ) -> SuggestionChange:
        return SuggestionChange(
            id=uuid.uuid4(),
            suggestion_id=suggestion_id or uuid.uuid4(),
            parameter=parameter,
            suggested_value=suggested_value,
            symptom=symptom,
            confidence=confidence,
            applied_status=applied_status,
        )

    return _make


@pytest.fixture
def make_generation_job():
    """Factory for creating GenerationJob instances."""

    def _make(
        session_id: uuid.UUID | None = None,
        status: str = "pending",
    ) -> GenerationJob:
        return GenerationJob(
            id=uuid.uuid4(),
            session_id=session_id or uuid.uuid4(),
            status=status,
        )

    return _make


@pytest.fixture
def make_flag():
    """Factory for creating Flag instances."""

    def _make(
        symptom: str = "test symptom",
        parameter: str = "front.compression",
        suggested_delta: str = "+2 clicks",
        confidence: float = 0.85,
        reasoning: str = "test reasoning",
    ) -> Flag:
        return Flag(
            symptom=symptom,
            parameter=parameter,
            suggested_delta=suggested_delta,
            confidence=confidence,
            reasoning=reasoning,
        )

    return _make


@pytest.fixture
def sample_context() -> SessionContext:
    """A realistic SessionContext for prompt builder tests."""
    return SessionContext(
        session={
            "id": str(uuid.uuid4()),
            "event_id": str(uuid.uuid4()),
            "session_type": "qualifying",
            "rider_feedback": "Front is pushing in turn 3",
            "csv_best_lap_ms": 98500,
            "tire_front": {"brand": "Pirelli", "compound": "SC1", "laps": 15},
            "tire_rear": {"brand": "Pirelli", "compound": "SC2", "laps": 15},
        },
        change_log=[
            {
                "parameter": "front.compression",
                "from_value": "10",
                "to_value": "12",
                "rationale": "reduce dive",
            },
        ],
        bike={
            "make": "Ducati",
            "model": "Panigale V4R",
            "year": 2024,
            "gearing_front": 15,
            "gearing_rear": 43,
            "exhaust": "Akrapovic",
            "ecu": "Race",
        },
        suspension_spec={
            "front": {
                "compression": 12,
                "rebound": 10,
                "preload": 5,
            },
            "rear": {
                "compression": 8,
                "rebound": 14,
                "preload": 7,
            },
        },
        maintenance=[
            {
                "category": "oil_change",
                "performed_at": "2024-03-01",
                "description": "Motul 300V",
            },
        ],
        event_sessions=[
            {
                "id": str(uuid.uuid4()),
                "session_type": "practice",
                "csv_best_lap_ms": 99200,
                "created_at": "2024-03-15T09:00:00Z",
            },
        ],
        track={
            "name": "Laguna Seca",
            "config": "Full",
            "track_type": "technical",
            "length_km": 3.6,
            "turns": 11,
        },
        conditions={
            "condition": "dry",
            "temp_c": 25,
            "track_temp_c": 35,
            "humidity_pct": 40,
        },
        telemetry_analysis={
            "braking_zones": [
                {"zone": "T1", "consistency": 0.85},
                {"zone": "T5", "consistency": 0.55},
            ],
            "fork_rebound": {"too_slow": True},
        },
        user_profile={
            "skill_level": "intermediate",
            "rider_type": "competitive",
        },
    )


# ── Mock helpers ──


@pytest.fixture
def mock_push_job():
    """Mock dialed_shared.push_job."""
    with patch("services.suggestion_service.push_job", new_callable=AsyncMock) as m:
        yield m
