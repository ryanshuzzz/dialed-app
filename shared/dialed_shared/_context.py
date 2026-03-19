"""
Contextvars shared between middleware, logging, and error handling.

These variables are set per-request by ``RequestIdMiddleware`` and read
by the log formatter and error response builder.
"""

from __future__ import annotations

from contextvars import ContextVar

request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)
"""Current request's X-Request-ID (or auto-generated UUID)."""

user_id_var: ContextVar[str | None] = ContextVar("user_id", default=None)
"""Current request's authenticated user_id (set after token verification)."""
