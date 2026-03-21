"""
Dialed AI service.

Runs the rules engine, builds prompts, calls Claude API, and owns
suggestion storage. Generates suggestions asynchronously via Redis
task queue and streams results to clients via SSE.
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

from routers import suggest

logger = setup_logger("ai")

# Absolute path to alembic.ini so the programmatic call works regardless of cwd.
_ALEMBIC_INI = str(Path(__file__).resolve().parent / "alembic.ini")


def _run_migrations() -> None:
    """Run ``alembic upgrade head`` synchronously inside a thread."""
    from alembic import command
    from alembic.config import Config

    cfg = Config(_ALEMBIC_INI)
    cfg.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])
    command.upgrade(cfg, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run Alembic migrations on startup, then yield."""
    # Warn early if the Anthropic API key is missing — suggestions will fail
    # at job-processing time without it.
    if not os.environ.get("ANTHROPIC_API_KEY"):
        logger.warning(
            "ANTHROPIC_API_KEY is not set — Claude API calls will fail unless "
            "every user supplies a BYOK key. Set ANTHROPIC_API_KEY in the "
            "environment or in infra/.env before starting the stack."
        )

    if os.environ.get("DATABASE_URL"):
        try:
            logger.info("Running Alembic migrations for ai schema…")
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
        title="Dialed AI API",
        description="AI suggestion generation with rules engine and Claude",
        version="1.0.0",
        lifespan=lifespan,
    )

    install_middleware(app)
    install_exception_handlers(app)
    app.include_router(create_health_router("ai"))

    app.include_router(suggest.router)

    logger.info("AI service ready on port 8003")
    return app


app = create_app()
