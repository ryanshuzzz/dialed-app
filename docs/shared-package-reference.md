# Shared Package Reference — `dialed_shared`

> **Location:** `shared/dialed_shared/`
> **Install:** `-e ../../shared` in each service's `requirements.txt`
> **Rule:** Services use this package — they do NOT reimplement any of these modules.

---

## Table of contents

1. [Package structure](#package-structure)
2. [Module reference](#module-reference)
3. [Design decisions](#design-decisions)
4. [Usage patterns](#usage-patterns)

---

## Package structure

```
shared/
  setup.py                          # pip-installable as "dialed_shared"
  requirements.txt                  # fastapi, python-jose, redis, pydantic
  dialed_shared/
    __init__.py                     # Re-exports all public symbols
    _context.py                     # Contextvars (request_id, user_id) shared across modules
    auth.py                         # Internal token creation + verification + FastAPI dependency
    errors.py                       # Error envelope model, exception hierarchy, exception handlers
    health.py                       # Standard GET /health router factory
    logging.py                      # stdlib logger with per-request context formatter
    middleware.py                   # Request ID + timing middleware, install helper
    redis_tasks.py                  # Async Redis LPUSH/BRPOP task queue helpers
```

---

## Module reference

### `_context.py` (private)

Two `ContextVar` instances shared across middleware, logging, and error handling:

| Variable | Type | Set by | Read by |
|----------|------|--------|---------|
| `request_id_var` | `ContextVar[str \| None]` | `RequestIdMiddleware` | `DialedFormatter`, `ErrorResponse` builder |
| `user_id_var` | `ContextVar[str \| None]` | Auth dependency / middleware | `DialedFormatter` |

### `auth.py`

| Function | Signature | Description |
|----------|-----------|-------------|
| `create_internal_token` | `(user_id: str, secret: str, ttl_seconds: int = 300) → str` | Gateway signs HS256 JWT with `user_id` + `exp` claims |
| `verify_internal_token` | `(token: str, secret: str) → dict` | Decode + verify JWT; raises `UnauthorizedException` if invalid/expired |
| `get_current_user` | `async (request: Request) → dict` | FastAPI `Depends()` — reads `X-Internal-Token` header, verifies against `INTERNAL_SECRET` env var |

### `errors.py`

**Error envelope model:**

```python
class ErrorResponse(BaseModel):
    error: str           # Human-readable message
    code: str            # Machine-readable code (e.g. NOT_FOUND)
    request_id: str      # From X-Request-ID header
```

**Exception hierarchy:**

| Exception | Status | Code |
|-----------|--------|------|
| `DialedException` (base) | 500 | `INTERNAL_ERROR` |
| `NotFoundException` | 404 | `NOT_FOUND` |
| `UnauthorizedException` | 401 | `UNAUTHORIZED` |
| `ForbiddenException` | 403 | `FORBIDDEN` |
| `ValidationException` | 422 | `VALIDATION_ERROR` |
| `RateLimitedException` | 429 | `RATE_LIMITED` |

**`install_exception_handlers(app)`** registers three handlers:
1. `DialedException` subclasses → appropriate status + error envelope
2. FastAPI `RequestValidationError` → 422 `VALIDATION_ERROR` envelope
3. Catch-all `Exception` → 500 `INTERNAL_ERROR` envelope (with traceback logging)

### `logging.py`

| Function | Signature | Description |
|----------|-----------|-------------|
| `setup_logger` | `(service_name: str, level: int = INFO) → Logger` | Configures root logger with `DialedFormatter` on stderr |

**Log format:**
```
2026-03-18T12:00:00 [core-api] [req:abc123] [user:def456] INFO  message
```

- `service_name` — passed at setup, baked into the formatter
- `request_id` — from `request_id_var` contextvar (set by `RequestIdMiddleware`)
- `user_id` — from `user_id_var` contextvar (set after auth verification)
- Falls back to `-` when either contextvar is unset (e.g. during startup)

### `health.py`

| Function | Signature | Description |
|----------|-----------|-------------|
| `create_health_router` | `(service_name: str) → APIRouter` | Returns router with `GET /health` endpoint |

**Response shape:**
```json
{
  "status": "ok",
  "service": "core-api",
  "timestamp": "2026-03-18T12:00:00+00:00"
}
```

### `redis_tasks.py`

| Function | Signature | Description |
|----------|-----------|-------------|
| `push_job` | `async (redis_url: str, queue_name: str, payload: dict) → None` | LPUSH JSON payload onto a Redis List |
| `consume_jobs` | `async (redis_url: str, queue_name: str, handler: Callable, timeout: int = 0) → None` | BRPOP loop that deserialises JSON and calls handler |

**Queues:**
- `dialed:ingestion` — CSV, OCR, voice jobs
- `dialed:ai` — AI suggestion generation jobs

Both use Redis Lists (`LPUSH` to enqueue, `BRPOP` to dequeue) for FIFO ordering.

### `middleware.py`

| Class / Function | Description |
|------------------|-------------|
| `RequestIdMiddleware` | Reads `X-Request-ID` header (or generates UUID4), stores in contextvar, echoes on response |
| `TimingMiddleware` | Logs `METHOD /path → STATUS (Xms)` at INFO level |
| `install_middleware(app)` | Registers both middleware in correct order |

---

## Design decisions

### 1. Contextvars for per-request state (`_context.py`)

A private module holds two `ContextVar` instances (`request_id_var`, `user_id_var`) that are the shared backbone for per-request context. The middleware sets them, the log formatter and error response builder read them.

**Why a separate module:** Middleware, logging, and errors all need these vars. Putting them in any one of those modules would create circular imports. A dedicated `_context.py` with no internal imports breaks the cycle cleanly.

### 2. Auth: gateway signs, services verify

`create_internal_token()` is called once by the gateway after validating the upstream Supabase JWT. It creates a short-lived (5 min default) HS256 JWT containing only `user_id` and `exp`. Downstream services call `verify_internal_token()` or use the `Depends(get_current_user)` FastAPI dependency.

**Why HS256:** Symmetric signing is fast and the secret is already shared across all services via the `INTERNAL_SECRET` env var. No need for RS256 key distribution in a 3-service deployment.

**Why short TTL:** The internal token only needs to live for the duration of a single request chain. 5 minutes allows for slow inter-service calls without creating a long-lived credential.

### 3. Error envelope: exceptions, not return values

Services raise `NotFoundException`, `ValidationException`, etc. instead of manually constructing error responses. The `install_exception_handlers()` function registers handlers that catch these and serialize them into the standard `{ error, code, request_id }` envelope.

**Why a catch-all `Exception` handler:** Prevents FastAPI's default HTML error page from leaking in production. Unhandled exceptions get logged with a full traceback and return a clean JSON envelope.

**Why `RequestValidationError` is handled separately:** FastAPI raises this for Pydantic validation failures on request bodies. The handler extracts the first error's location and message into a human-readable string instead of returning Pydantic's raw error list.

### 4. Logging: stdlib only, no structlog

The project spec explicitly requires Python stdlib logging — no structlog, no loguru. The `DialedFormatter` injects `service_name`, `request_id`, and `user_id` from contextvars into every log line. This is sufficient for 3 services and avoids adding dependencies.

**Why stderr:** Docker captures stderr by default. Services running under Docker Compose or on the mini PC get logs collected without any extra configuration.

### 5. Redis tasks: LPUSH/BRPOP, not Streams

Redis is used only as a task queue. `push_job()` LPUSHes to the left, `consume_jobs()` BRPOPs from the right, giving FIFO ordering. No consumer groups, no Redis Streams.

**Why no persistent connections in `push_job`:** Each call opens a connection, pushes, and closes. In a FastAPI request handler this is fine — the overhead is negligible compared to the HTTP request itself, and it avoids managing a global Redis connection pool in the shared package.

**Why `consume_jobs` runs forever:** It's designed as the main entry point of a worker process (`python -m worker`). If the handler raises, the error is logged but the loop continues. The handler is responsible for marking the job as failed in the database.

### 6. Middleware ordering: LIFO registration

Starlette processes middleware in LIFO order (last added = outermost). `install_middleware()` adds `TimingMiddleware` first, then `RequestIdMiddleware` second, so that `RequestIdMiddleware` runs outermost. This ensures the request ID contextvar is set before the timing middleware logs the request duration.

---

## Usage patterns

### Service app factory

Every service's `main.py` follows the same pattern:

```python
from fastapi import FastAPI
from dialed_shared import (
    create_health_router,
    install_exception_handlers,
    install_middleware,
    setup_logger,
)

def create_app() -> FastAPI:
    logger = setup_logger("core-api")
    app = FastAPI(title="Dialed Core API")

    install_middleware(app)
    install_exception_handlers(app)
    app.include_router(create_health_router("core-api"))

    # ... include service-specific routers ...

    logger.info("core-api ready")
    return app
```

### Protected endpoint

```python
from fastapi import APIRouter, Depends
from dialed_shared import get_current_user

router = APIRouter()

@router.get("/example")
async def example(user: dict = Depends(get_current_user)):
    user_id = user["user_id"]
    # ... business logic ...
```

### Raising errors

```python
from dialed_shared import NotFoundException, ValidationException

async def get_bike(bike_id: str):
    bike = await db.get(bike_id)
    if not bike:
        raise NotFoundException(f"Bike {bike_id} not found")
    if bike.deleted_at:
        raise NotFoundException(f"Bike {bike_id} has been deleted")
```

### Publishing a task queue job

```python
from dialed_shared import push_job

await push_job(
    redis_url=settings.redis_url,
    queue_name="dialed:ingestion",
    payload={
        "job_id": str(job.id),
        "session_id": str(session_id),
        "user_id": user["user_id"],
        "source": "csv",
        "file_path": stored_path,
        "created_at": datetime.now(timezone.utc).isoformat(),
    },
)
```

### Worker process

```python
# services/telemetry-ingestion/worker.py
import asyncio
from dialed_shared import consume_jobs, setup_logger

logger = setup_logger("telemetry-worker")

async def handle_ingestion(payload: dict) -> None:
    source = payload["source"]
    # ... run the appropriate pipeline ...

if __name__ == "__main__":
    asyncio.run(consume_jobs(
        redis_url="redis://redis:6379",
        queue_name="dialed:ingestion",
        handler=handle_ingestion,
    ))
```
