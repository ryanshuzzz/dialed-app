"""
Internal token creation and verification for inter-service auth.

The gateway validates the Supabase JWT from the client, then signs a
lightweight internal token (HS256) containing ``user_id`` and ``exp``.
Downstream services verify this token cheaply using the shared secret
from the ``INTERNAL_SECRET`` environment variable.
"""

from __future__ import annotations

import os
import time
from typing import Any

from fastapi import Request
from jose import JWTError, jwt

from dialed_shared.errors import UnauthorizedException

_ALGORITHM = "HS256"


def create_internal_token(
    user_id: str,
    secret: str,
    ttl_seconds: int = 300,
) -> str:
    """Create an HS256 JWT for internal service-to-service auth.

    Called by the gateway after validating the upstream Supabase JWT.

    Args:
        user_id: The authenticated user's UUID.
        secret: Shared secret (``INTERNAL_SECRET`` env var).
        ttl_seconds: Token lifetime in seconds. Defaults to 5 minutes.

    Returns:
        Encoded JWT string.
    """
    now = int(time.time())
    payload: dict[str, Any] = {
        "user_id": user_id,
        "exp": now + ttl_seconds,
        "iat": now,
    }
    return jwt.encode(payload, secret, algorithm=_ALGORITHM)


def verify_internal_token(token: str, secret: str) -> dict[str, Any]:
    """Decode and verify an internal JWT.

    Args:
        token: The raw JWT string from the ``X-Internal-Token`` header.
        secret: Shared secret (``INTERNAL_SECRET`` env var).

    Returns:
        Decoded payload dict containing at least ``user_id`` and ``exp``.

    Raises:
        UnauthorizedException: If the token is missing, malformed, or expired.
    """
    try:
        payload = jwt.decode(token, secret, algorithms=[_ALGORITHM])
    except JWTError:
        raise UnauthorizedException("Invalid or expired token")
    except Exception:
        raise UnauthorizedException("Invalid or expired token")

    if "user_id" not in payload:
        raise UnauthorizedException("Internal token missing user_id claim")

    return payload


async def get_current_user(request: Request) -> dict[str, Any]:
    """FastAPI dependency that extracts and verifies the internal token.

    Reads the ``X-Internal-Token`` header, verifies it against
    ``INTERNAL_SECRET``, and returns the decoded payload.

    The returned dict always contains ``user_id`` (str).

    Usage::

        @router.get("/example")
        async def example(user: dict = Depends(get_current_user)):
            user_id = user["user_id"]

    Raises:
        UnauthorizedException: If the header is missing or the token is invalid.
    """
    token = request.headers.get("X-Internal-Token")
    if not token:
        raise UnauthorizedException("Missing X-Internal-Token header")

    secret = os.environ.get("INTERNAL_SECRET", "")
    if not secret:
        raise UnauthorizedException("INTERNAL_SECRET not configured")

    return verify_internal_token(token, secret)
