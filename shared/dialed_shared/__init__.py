"""
dialed_shared — Shared utilities for all Dialed backend services.

This package provides common infrastructure so that services do not
reimplement auth verification, error handling, logging, health checks,
task queue helpers, or request middleware.

Usage in each service's requirements.txt:
    -e ../../shared
"""

from dialed_shared.auth import (
    create_internal_token,
    get_current_user,
    verify_internal_token,
)
from dialed_shared.errors import (
    DialedException,
    ErrorResponse,
    ForbiddenException,
    NotFoundException,
    RateLimitedException,
    UnauthorizedException,
    ValidationException,
    install_exception_handlers,
)
from dialed_shared.health import create_health_router
from dialed_shared.logging import setup_logger
from dialed_shared.middleware import install_middleware
from dialed_shared.redis_tasks import consume_jobs, push_job

__all__ = [
    # auth
    "create_internal_token",
    "get_current_user",
    "verify_internal_token",
    # errors
    "DialedException",
    "ErrorResponse",
    "ForbiddenException",
    "NotFoundException",
    "RateLimitedException",
    "UnauthorizedException",
    "ValidationException",
    "install_exception_handlers",
    # health
    "create_health_router",
    # logging
    "setup_logger",
    # middleware
    "install_middleware",
    # redis_tasks
    "consume_jobs",
    "push_job",
]
