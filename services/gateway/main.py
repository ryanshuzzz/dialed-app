"""
Dialed API Gateway — stateless reverse proxy.

Routes incoming requests to the appropriate backend service based on path prefix.
For authenticated requests, validates the Bearer token by calling core-api's
auth endpoint, then signs an internal token for downstream services.
"""

import os

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse

from dialed_shared import (
    create_health_router,
    install_exception_handlers,
    install_middleware,
    setup_logger,
)
from dialed_shared.auth import create_internal_token

logger = setup_logger("gateway")

CORE_API_URL = os.environ.get("CORE_API_URL", "http://core-api:8001")
TELEMETRY_URL = os.environ.get("TELEMETRY_URL", "http://telemetry-ingestion:8002")
AI_URL = os.environ.get("AI_URL", "http://ai:8003")
INTERNAL_SECRET = os.environ.get("INTERNAL_SECRET", "dev-internal-secret")

# Path prefix → backend URL mapping
ROUTE_MAP = {
    "auth": CORE_API_URL,
    "garage": CORE_API_URL,
    "sessions": CORE_API_URL,
    "progress": CORE_API_URL,
    "admin": CORE_API_URL,
    "ingest": TELEMETRY_URL,
    "telemetry": TELEMETRY_URL,
    "suggest": AI_URL,
}


def _resolve_backend(path: str) -> tuple[str, str] | None:
    """Return (backend_url, backend_path) for a given API path."""
    # path is everything after /api/v1/
    prefix = path.split("/")[0] if path else ""
    backend = ROUTE_MAP.get(prefix)
    if backend:
        return backend, f"/{path}"
    return None


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

    @app.api_route(
        "/api/v1/{path:path}",
        methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    )
    async def proxy(request: Request, path: str) -> Response:
        resolved = _resolve_backend(path)
        if resolved is None:
            return Response(
                status_code=404,
                content=b'{"error":"Unknown route","code":"NOT_FOUND"}',
                media_type="application/json",
            )

        backend_url, backend_path = resolved

        # Build headers to forward
        headers = dict(request.headers)
        # Remove hop-by-hop headers
        for h in ("host", "connection", "transfer-encoding"):
            headers.pop(h, None)

        # If client sends a Bearer token, create an internal token
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            bearer_token = auth_header[7:]
            # For auth routes (register/login), pass through directly
            # For other routes, we sign an internal token
            prefix = path.split("/")[0]
            if prefix != "auth":
                # Validate the bearer token by decoding it (core-api issued it)
                # For dev: trust the token and extract user_id via core-api
                # Create internal token with the bearer token as user context
                try:
                    from jose import jwt as jose_jwt

                    # Core-api signs tokens with INTERNAL_SECRET
                    payload = jose_jwt.decode(
                        bearer_token, INTERNAL_SECRET, algorithms=["HS256"]
                    )
                    user_id = payload.get("user_id", "")
                    internal_token = create_internal_token(user_id, INTERNAL_SECRET)
                    headers["x-internal-token"] = internal_token
                except Exception:
                    # If token decode fails, still forward — let the service reject it
                    headers["x-internal-token"] = bearer_token
            else:
                # Auth routes: forward bearer as internal token too
                headers["x-internal-token"] = bearer_token

        body = await request.body()

        # Proxy the request
        async with httpx.AsyncClient(timeout=30.0) as client:
            backend_resp = await client.request(
                method=request.method,
                url=f"{backend_url}{backend_path}",
                headers=headers,
                content=body,
                params=dict(request.query_params),
            )

        # Check if this is an SSE stream
        content_type = backend_resp.headers.get("content-type", "")
        if "text/event-stream" in content_type:
            # Stream SSE responses
            async def stream_sse():
                async with httpx.AsyncClient(timeout=300.0) as stream_client:
                    async with stream_client.stream(
                        method=request.method,
                        url=f"{backend_url}{backend_path}",
                        headers=headers,
                        content=body,
                        params=dict(request.query_params),
                    ) as resp:
                        async for chunk in resp.aiter_bytes():
                            yield chunk

            return StreamingResponse(
                stream_sse(),
                status_code=backend_resp.status_code,
                media_type="text/event-stream",
            )

        # Return proxied response
        resp_headers = {}
        for k, v in backend_resp.headers.items():
            if k.lower() not in (
                "content-encoding",
                "content-length",
                "transfer-encoding",
                "connection",
            ):
                resp_headers[k] = v

        return Response(
            content=backend_resp.content,
            status_code=backend_resp.status_code,
            headers=resp_headers,
            media_type=backend_resp.headers.get("content-type"),
        )

    logger.info("Gateway ready on port 8000")
    return app


app = create_app()
