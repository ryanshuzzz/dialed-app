"""
Dialed Telemetry/Ingestion service.

Handles data pipelines (CSV parsing, OCR extraction, voice transcription)
and owns all telemetry storage in TimescaleDB. Processes ingestion jobs
asynchronously via Redis task queue and notifies clients via SSE.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from db import _db_engine, _ts_engine
from dialed_shared import (
    create_health_router,
    install_exception_handlers,
    install_middleware,
    setup_logger,
)

from routers import ingest, telemetry

logger = setup_logger("telemetry-ingestion")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage database engine lifecycle."""
    logger.info("Telemetry/Ingestion service starting on port 8002")
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
