"""Alembic environment for the telemetry service (async)."""

import asyncio
import os

from alembic import context
from sqlalchemy import pool, text
from sqlalchemy.ext.asyncio import create_async_engine

# Import all models so metadata is populated
from models.ingestion_job import Base as IngestionBase
from models.lap_segment import Base as LapBase
from models.telemetry_point import Base as TelemetryBase

# Combine metadata from all model bases
target_metadata = [IngestionBase.metadata, LapBase.metadata, TelemetryBase.metadata]

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:devpassword@postgres/dialed",
)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        version_table_schema="telemetry",
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        version_table_schema="telemetry",
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode with async engine."""
    engine = create_async_engine(DATABASE_URL, poolclass=pool.NullPool)

    async with engine.connect() as connection:
        await connection.execute(text("CREATE SCHEMA IF NOT EXISTS telemetry"))
        await connection.commit()
        await connection.run_sync(do_run_migrations)

    await engine.dispose()


def run_migrations_online() -> None:
    """Entry point for online migrations."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
