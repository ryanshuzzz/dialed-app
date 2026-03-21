"""
Dialed Core API — main application backend.

Owns users, auth tokens, bikes (garage), maintenance, tire pressure,
modifications, ownership, tracks, events, sessions, setup snapshots,
change logs, progress/efficacy analytics, and channel aliases.
"""

import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI

from dialed_shared import (
    create_health_router,
    install_exception_handlers,
    install_middleware,
    setup_logger,
)

from routers import (
    admin,
    auth,
    bikes,
    events,
    maintenance,
    modifications,
    ownership,
    progress,
    sessions,
    tire_pressure,
    tracks,
)

logger = setup_logger("core-api")

# Absolute path to alembic.ini so the programmatic call works regardless of cwd.
_ALEMBIC_INI = str(Path(__file__).resolve().parent / "alembic.ini")


def _run_migrations() -> None:
    """Run ``alembic upgrade head`` synchronously.

    Intended to be called inside a thread (via asyncio.to_thread) so that
    Alembic's own asyncio.run() call does not conflict with the running event
    loop in the main thread.
    """
    from alembic import command
    from alembic.config import Config

    cfg = Config(_ALEMBIC_INI)
    # Honour the runtime DATABASE_URL over whatever is baked into alembic.ini.
    cfg.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])
    command.upgrade(cfg, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run Alembic migrations on startup, then yield."""
    if os.environ.get("DATABASE_URL"):
        try:
            logger.info("Running Alembic migrations for core schema…")
            await asyncio.to_thread(_run_migrations)
            logger.info("Alembic migrations complete")
        except Exception:
            logger.exception(
                "Alembic migration failed — service will start anyway, "
                "but the schema may be out of date"
            )
    else:
        logger.warning("DATABASE_URL not set — skipping Alembic migrations")
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="Dialed Core API",
        description="Auth, garage, sessions, progress, and admin endpoints",
        version="1.0.0",
        lifespan=lifespan,
    )

    install_middleware(app)
    install_exception_handlers(app)
    app.include_router(create_health_router("core-api"))

    # Auth
    app.include_router(auth.router)

    # Garage
    app.include_router(bikes.router)
    app.include_router(maintenance.router)
    app.include_router(tire_pressure.router)
    app.include_router(modifications.router)
    app.include_router(ownership.router)
    app.include_router(tracks.router)
    app.include_router(events.router)

    # Sessions
    app.include_router(sessions.router)

    # Progress
    app.include_router(progress.router)

    # Admin
    app.include_router(admin.router)

    logger.info("Core API ready on port 8001")
    return app


app = create_app()
