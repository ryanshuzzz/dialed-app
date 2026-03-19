"""
Common FastAPI middleware for all Dialed services.

Provides two middleware classes and a convenience installer:

- **RequestIdMiddleware** — reads ``X-Request-ID`` from the incoming
  request (or generates a UUID4), stores it in a contextvar for the
  logger and error handler, and echoes it back on the response.

- **TimingMiddleware** — logs the wall-clock duration of each request
  at INFO level.

Usage::

    from dialed_shared.middleware import install_middleware

    app = FastAPI()
    install_middleware(app)
"""

from __future__ import annotations

import logging
import time
import uuid

from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from dialed_shared._context import request_id_var, user_id_var

logger = logging.getLogger(__name__)


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Propagate or generate a unique request ID for every request.

    Reads the ``X-Request-ID`` header from the incoming request. If
    absent, generates a UUID4. The value is:

    1. Stored in the ``request_id_var`` contextvar (read by the log
       formatter and error response builder).
    2. Set on the response as the ``X-Request-ID`` header.

    Also extracts ``user_id`` from the request state if the auth
    dependency has already run, storing it in ``user_id_var`` for
    the log formatter.
    """

    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        rid = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request_id_var.set(rid)

        # user_id is set later by the auth dependency; reset to None
        # at the start of each request to avoid leaking across requests.
        user_id_var.set(None)

        response = await call_next(request)
        response.headers["X-Request-ID"] = rid
        return response


class TimingMiddleware(BaseHTTPMiddleware):
    """Log the wall-clock duration of every HTTP request."""

    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000

        logger.info(
            "%s %s → %d (%.1fms)",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )
        return response


def install_middleware(app: FastAPI) -> None:
    """Register all standard Dialed middleware on a FastAPI application.

    Call this once in each service's app factory::

        app = FastAPI()
        install_middleware(app)

    Middleware is added in reverse order so that ``RequestIdMiddleware``
    runs first (outermost), ensuring the request ID is available for
    ``TimingMiddleware`` log lines.
    """
    # Added last → runs first (Starlette middleware is LIFO)
    app.add_middleware(TimingMiddleware)
    app.add_middleware(RequestIdMiddleware)
