"""
Dialed API Gateway — stateless reverse proxy.

In production this role is handled by nginx (see infra/nginx/nginx.conf).
This Python gateway exists for local development without nginx, providing
JWT validation, internal token signing, rate limiting, and request routing.

For now this is a minimal skeleton that responds to /health and returns
501 for all proxied routes.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from dialed_shared import (
    create_health_router,
    install_exception_handlers,
    install_middleware,
    setup_logger,
)

logger = setup_logger("gateway")


def create_app() -> FastAPI:
    app = FastAPI(
        title="Dialed API Gateway",
        description="Stateless proxy — JWT validation, internal token signing, routing",
        version="1.0.0",
    )

    # CORS — allow the frontend dev server
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )

    install_middleware(app)
    install_exception_handlers(app)
    app.include_router(create_health_router("gateway"))

    # Placeholder catch-all for proxied routes
    @app.api_route(
        "/api/v1/{path:path}",
        methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    )
    async def proxy_placeholder(request: Request, path: str) -> JSONResponse:
        return JSONResponse(
            status_code=501,
            content={
                "error": "Gateway proxy not yet implemented",
                "code": "NOT_IMPLEMENTED",
                "path": f"/api/v1/{path}",
            },
        )

    logger.info("Gateway ready on port 8000")
    return app


app = create_app()
