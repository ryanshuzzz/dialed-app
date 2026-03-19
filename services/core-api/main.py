"""
Dialed Core API — main application backend.

Owns users, auth tokens, bikes (garage), maintenance, tire pressure,
modifications, ownership, tracks, events, sessions, setup snapshots,
change logs, progress/efficacy analytics, and channel aliases.
"""

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


def create_app() -> FastAPI:
    app = FastAPI(
        title="Dialed Core API",
        description="Auth, garage, sessions, progress, and admin endpoints",
        version="1.0.0",
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
