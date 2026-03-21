"""
Dialed Telemetry/Ingestion service.

Handles data pipelines (CSV parsing, OCR extraction, voice transcription)
and owns all telemetry storage in TimescaleDB. Processes ingestion jobs
asynchronously via Redis task queue and notifies clients via SSE.
"""

import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from sqlalchemy import text

from db import _db_engine, _ts_engine
from dialed_shared import (
    create_health_router,
    install_exception_handlers,
    install_middleware,
    setup_logger,
)

from routers import ingest, telemetry

logger = setup_logger("telemetry-ingestion")

# Absolute path to alembic.ini so the programmatic call works regardless of cwd.
_ALEMBIC_INI = str(Path(__file__).resolve().parent / "alembic.ini")


def _run_migrations() -> None:
    """Run ``alembic upgrade head`` synchronously inside a thread."""
    from alembic import command
    from alembic.config import Config

    cfg = Config(_ALEMBIC_INI)
    cfg.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])
    command.upgrade(cfg, "head")


_CREATE_TELEMETRY_POINTS_SQL = """
CREATE TABLE IF NOT EXISTS telemetry.telemetry_points (
    time            TIMESTAMPTZ     NOT NULL,
    session_id      UUID            NOT NULL,
    gps_speed       DOUBLE PRECISION,
    throttle_pos    DOUBLE PRECISION,
    rpm             DOUBLE PRECISION,
    gear            SMALLINT,
    lean_angle      DOUBLE PRECISION,
    front_brake_psi DOUBLE PRECISION,
    rear_brake_psi  DOUBLE PRECISION,
    fork_position   DOUBLE PRECISION,
    shock_position  DOUBLE PRECISION,
    coolant_temp    DOUBLE PRECISION,
    oil_temp        DOUBLE PRECISION,
    lat             DOUBLE PRECISION,
    lon             DOUBLE PRECISION,
    extra_channels  JSONB           NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (time, session_id)
);
"""

_CREATE_HYPERTABLE_SQL = """
SELECT create_hypertable(
    'telemetry.telemetry_points',
    'time',
    if_not_exists => TRUE
);
"""

_CREATE_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS ix_telemetry_points_session_time
    ON telemetry.telemetry_points (session_id, time);
"""


async def ensure_timescale_schema() -> None:
    """Create the telemetry_points hypertable on TimescaleDB if it does not exist.

    This runs at startup against TIMESCALE_URL.  Regular Postgres migrations
    (Alembic / DATABASE_URL) do not touch this table because create_hypertable()
    is a TimescaleDB-only function.
    """
    async with _ts_engine.begin() as conn:
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS telemetry"))
        await conn.execute(text(_CREATE_TELEMETRY_POINTS_SQL))
        await conn.execute(text(_CREATE_HYPERTABLE_SQL))
        await conn.execute(text(_CREATE_INDEX_SQL))
    logger.info("TimescaleDB schema verified: telemetry.telemetry_points ready")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run Alembic migrations and TimescaleDB schema setup on startup."""
    logger.info("Telemetry/Ingestion service starting on port 8002")

    if os.environ.get("DATABASE_URL"):
        try:
            logger.info("Running Alembic migrations for telemetry schema…")
            await asyncio.to_thread(_run_migrations)
            logger.info("Alembic migrations complete")
        except Exception:
            logger.exception(
                "Alembic migration failed — service will start anyway, "
                "but the schema may be out of date"
            )
    else:
        logger.warning("DATABASE_URL not set — skipping Alembic migrations")

    await ensure_timescale_schema()
    yield
    # Dispose both async engines on shutdown.
    await _db_engine.dispose()
    await _ts_engine.dispose()
    logger.info("Telemetry/Ingestion service shut down")


def create_app() -> FastAPI:
    app = FastAPI(
        title="Dialed Telemetry/Ingestion API",
        description="Data ingestion pipelines and telemetry storage",
        version="1.0.0",
        lifespan=lifespan,
    )

    install_middleware(app)
    install_exception_handlers(app)
    app.include_router(create_health_router("telemetry-ingestion"))

    app.include_router(ingest.router)
    app.include_router(telemetry.router)

    return app


app = create_app()
