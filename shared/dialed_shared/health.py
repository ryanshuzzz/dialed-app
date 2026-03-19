"""
Standard health check endpoint shared by all Dialed services.

Usage in each service's ``main.py``::

    from dialed_shared.health import create_health_router

    app = FastAPI()
    app.include_router(create_health_router("core-api"))
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter


def create_health_router(service_name: str) -> APIRouter:
    """Create a FastAPI router with a ``GET /health`` endpoint.

    The endpoint returns a simple JSON object that load balancers and
    Docker healthchecks can use to verify the service is alive::

        {
            "status": "ok",
            "service": "core-api",
            "timestamp": "2026-03-18T12:00:00Z"
        }

    Args:
        service_name: The name of the service (e.g. ``"core-api"``).

    Returns:
        A FastAPI ``APIRouter`` ready to be included on the app.
    """
    router = APIRouter(tags=["Health"])

    @router.get("/health")
    async def health_check() -> dict[str, str]:
        return {
            "status": "ok",
            "service": service_name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    return router
