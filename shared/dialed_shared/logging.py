"""
Shared logging setup for all Dialed services.

Uses Python stdlib ``logging`` only — no structlog, no loguru.

Every log line includes ``service_name``, ``request_id``, and ``user_id``
pulled from contextvars set by the request middleware. This makes it
straightforward to correlate logs across services for a single request.

Usage::

    from dialed_shared.logging import setup_logger

    logger = setup_logger("core-api")
    logger.info("Server starting on port 8001")
"""

from __future__ import annotations

import logging
import sys

from dialed_shared._context import request_id_var, user_id_var


class DialedFormatter(logging.Formatter):
    """Log formatter that injects per-request context from contextvars.

    Output format::

        2026-03-18T12:00:00 [core-api] [req:abc123] [user:def456] INFO  message
    """

    def __init__(self, service_name: str) -> None:
        self.service_name = service_name
        super().__init__()

    def format(self, record: logging.LogRecord) -> str:
        request_id = request_id_var.get(None) or "-"
        user_id = user_id_var.get(None) or "-"

        timestamp = self.formatTime(record, "%Y-%m-%dT%H:%M:%S")
        level = record.levelname.ljust(5)
        message = record.getMessage()

        formatted = (
            f"{timestamp} [{self.service_name}] "
            f"[req:{request_id}] [user:{user_id}] "
            f"{level} {message}"
        )

        if record.exc_info and not record.exc_text:
            record.exc_text = self.formatException(record.exc_info)
        if record.exc_text:
            formatted += "\n" + record.exc_text

        return formatted


def setup_logger(service_name: str, level: int = logging.INFO) -> logging.Logger:
    """Configure and return the root logger for a Dialed service.

    Sets up a single ``StreamHandler`` writing to stderr with the
    ``DialedFormatter`` that includes service name, request ID, and
    user ID in every log line.

    Args:
        service_name: Name of the service (e.g. ``"core-api"``).
        level: Logging level. Defaults to ``INFO``.

    Returns:
        The configured root logger. Services can also call
        ``logging.getLogger(__name__)`` in individual modules — the
        formatter is set on the root so it applies everywhere.
    """
    root_logger = logging.getLogger()

    # Avoid adding duplicate handlers if called multiple times
    if root_logger.handlers:
        return root_logger

    root_logger.setLevel(level)

    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(DialedFormatter(service_name))
    root_logger.addHandler(handler)

    return root_logger
