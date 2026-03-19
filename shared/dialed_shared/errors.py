"""
Standardised error envelope and exception hierarchy for all Dialed services.

Every error response follows the same shape::

    {
        "error": "Human readable message",
        "code": "MACHINE_READABLE_CODE",
        "request_id": "uuid from X-Request-ID header"
    }

Standard codes: ``VALIDATION_ERROR``, ``NOT_FOUND``, ``UNAUTHORIZED``,
``FORBIDDEN``, ``RATE_LIMITED``, ``INTERNAL_ERROR``, ``SERVICE_UNAVAILABLE``.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from dialed_shared._context import request_id_var

logger = logging.getLogger("dialed_shared.errors")


# ── Error response model ────────────────────────────────────────────────────


class ErrorResponse(BaseModel):
    """The standard Dialed error envelope returned by all services."""

    error: str
    """Human-readable error description."""

    code: str
    """Machine-readable error code (e.g. ``NOT_FOUND``, ``VALIDATION_ERROR``)."""

    request_id: Optional[str] = None
    """Request ID from the ``X-Request-ID`` header, for log correlation."""


# ── Exception hierarchy ─────────────────────────────────────────────────────


class DialedException(Exception):
    """Base exception for all Dialed application errors.

    Subclass this for domain-specific errors. The installed exception
    handler converts these into ``ErrorResponse`` JSON automatically.

    Args:
        error: Human-readable message.
        code: Machine-readable code.
        status_code: HTTP status code to return.
    """

    def __init__(
        self,
        error: str = "An error occurred",
        code: str = "INTERNAL_ERROR",
        status_code: int = 500,
    ) -> None:
        self.error = error
        self.code = code
        self.status_code = status_code
        super().__init__(error)


class NotFoundException(DialedException):
    """Raised when a requested resource does not exist (404)."""

    def __init__(self, error: str = "Resource not found") -> None:
        super().__init__(error=error, code="NOT_FOUND", status_code=404)


class UnauthorizedException(DialedException):
    """Raised for missing or invalid authentication (401)."""

    def __init__(self, error: str = "Unauthorized") -> None:
        super().__init__(error=error, code="UNAUTHORIZED", status_code=401)


class ForbiddenException(DialedException):
    """Raised when the user is authenticated but lacks permission (403)."""

    def __init__(self, error: str = "Forbidden") -> None:
        super().__init__(error=error, code="FORBIDDEN", status_code=403)


class ValidationException(DialedException):
    """Raised for business-logic validation failures (422)."""

    def __init__(self, error: str = "Validation error") -> None:
        super().__init__(error=error, code="VALIDATION_ERROR", status_code=422)


class RateLimitedException(DialedException):
    """Raised when a rate limit is exceeded (429)."""

    def __init__(self, error: str = "Rate limit exceeded") -> None:
        super().__init__(error=error, code="RATE_LIMITED", status_code=429)


# ── Exception handlers ──────────────────────────────────────────────────────


def _get_request_id() -> str | None:
    """Read the current request ID from the contextvar set by middleware."""
    return request_id_var.get(None)


def _build_error_response(
    status_code: int,
    error: str,
    code: str,
) -> JSONResponse:
    body = ErrorResponse(
        error=error,
        code=code,
        request_id=_get_request_id(),
    )
    return JSONResponse(
        status_code=status_code,
        content=body.model_dump(),
    )


async def _handle_dialed_exception(
    request: Request,
    exc: DialedException,
) -> JSONResponse:
    """Handle DialedException subclasses → standard error envelope."""
    return _build_error_response(exc.status_code, exc.error, exc.code)


async def _handle_request_validation_error(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """Handle FastAPI/Pydantic validation errors → VALIDATION_ERROR envelope."""
    details = exc.errors()
    # Build a human-readable summary from the first error
    if details:
        first = details[0]
        loc = " → ".join(str(part) for part in first.get("loc", []))
        msg = first.get("msg", "Invalid value")
        error_msg = f"{loc}: {msg}" if loc else msg
    else:
        error_msg = "Request validation failed"

    return _build_error_response(422, error_msg, "VALIDATION_ERROR")


async def _handle_unhandled_exception(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """Catch-all for unexpected exceptions → INTERNAL_ERROR envelope."""
    logger.exception("Unhandled exception: %s", exc)
    return _build_error_response(500, "An unexpected error occurred", "INTERNAL_ERROR")


def install_exception_handlers(app: FastAPI) -> None:
    """Register all Dialed exception handlers on a FastAPI application.

    Call this once in each service's app factory::

        app = FastAPI()
        install_exception_handlers(app)

    Handles:
        - ``DialedException`` (and subclasses) → appropriate status + error envelope
        - ``RequestValidationError`` → 422 VALIDATION_ERROR envelope
        - ``Exception`` → 500 INTERNAL_ERROR envelope (with logging)
    """
    app.add_exception_handler(DialedException, _handle_dialed_exception)
    app.add_exception_handler(RequestValidationError, _handle_request_validation_error)
    app.add_exception_handler(Exception, _handle_unhandled_exception)
