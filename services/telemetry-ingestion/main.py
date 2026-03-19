"""
Dialed Telemetry/Ingestion service.

Handles data pipelines (CSV parsing, OCR extraction, voice transcription)
and owns all telemetry storage in TimescaleDB. Processes ingestion jobs
asynchronously via Redis task queue and notifies clients via SSE.
"""

from fastapi import FastAPI

from dialed_shared import (
    create_health_router,
    install_exception_handlers,
    install_middleware,
    setup_logger,
)

from routers import ingest, telemetry

logger = setup_logger("telemetry-ingestion")


def create_app() -> FastAPI:
    app = FastAPI(
        title="Dialed Telemetry/Ingestion API",
        description="Data ingestion pipelines and telemetry storage",
        version="1.0.0",
    )

    install_middleware(app)
    install_exception_handlers(app)
    app.include_router(create_health_router("telemetry-ingestion"))

    app.include_router(ingest.router)
    app.include_router(telemetry.router)

    logger.info("Telemetry/Ingestion service ready on port 8002")
    return app


app = create_app()
