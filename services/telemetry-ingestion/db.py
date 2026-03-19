"""Async database session factories for the telemetry service.

Two engines:
- DATABASE_URL  → shared Postgres (ingestion_jobs, lap_segments)
- TIMESCALE_URL → TimescaleDB instance (telemetry_points hypertable)
"""

import os
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:devpassword@postgres/dialed",
)
TIMESCALE_URL = os.environ.get(
    "TIMESCALE_URL",
    "postgresql+asyncpg://postgres:devpassword@timescale/dialed_telemetry",
)

_db_engine = create_async_engine(DATABASE_URL, echo=False)
_ts_engine = create_async_engine(TIMESCALE_URL, echo=False)

_DbSession = async_sessionmaker(_db_engine, class_=AsyncSession, expire_on_commit=False)
_TsSession = async_sessionmaker(_ts_engine, class_=AsyncSession, expire_on_commit=False)


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    """Yield an async session against the shared Postgres (ingestion_jobs, lap_segments)."""
    async with _DbSession() as session:
        yield session


async def get_timescale_session() -> AsyncGenerator[AsyncSession]:
    """Yield an async session against TimescaleDB (telemetry_points)."""
    async with _TsSession() as session:
        yield session
