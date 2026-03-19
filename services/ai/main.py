"""
Dialed AI service.

Runs the rules engine, builds prompts, calls Claude API, and owns
suggestion storage. Generates suggestions asynchronously via Redis
task queue and streams results to clients via SSE.
"""

from fastapi import FastAPI

from dialed_shared import (
    create_health_router,
    install_exception_handlers,
    install_middleware,
    setup_logger,
)

from routers import suggest
from sse import router as sse_router

logger = setup_logger("ai")


def create_app() -> FastAPI:
    app = FastAPI(
        title="Dialed AI API",
        description="AI suggestion generation with rules engine and Claude",
        version="1.0.0",
    )

    install_middleware(app)
    install_exception_handlers(app)
    app.include_router(create_health_router("ai"))

    app.include_router(suggest.router)
    app.include_router(sse_router)

    logger.info("AI service ready on port 8003")
    return app


app = create_app()
