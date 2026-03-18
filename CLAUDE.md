# Dialed App v1 — Master Agent Context

> Load this file at the start of every agent session.  
> Then load your service-specific file from `agents/CLAUDE-[your-service].md`.

## What this project is

Dialed is a motorcycle management and tuning platform. It serves all riders — from street riders tracking oil changes to competitive racers dialing in suspension between qualifying sessions. The Garage is the universal entry point (maintenance, tire pressure, mods, ownership). Track features (sessions, telemetry, AI suggestions) layer on top for riders who go to the track.

## Architecture

- **3 services:** Core API, Telemetry/Ingestion, AI
- **1 gateway:** stateless proxy handling JWT validation, internal token signing, rate limiting, CORS
- **Single Postgres** with per-service schemas: `core`, `telemetry`, `ai`
- **TimescaleDB** extension for the `telemetry` schema (20Hz hypertable)
- **Redis** as task queue only — two queues: `dialed:ingestion` and `dialed:ai`
- **SSE** for async job completion (ingestion) and streaming (AI suggestions)
- Gateway validates Supabase JWT, signs an internal token with a shared secret, forwards as `X-Internal-Token`

## Your contract is law

1. Read `contracts/openapi/[your-service].yaml` before writing any code
2. Read `contracts/json-schema/*.schema.json` for all data shapes
3. Match field names, status codes, and error shapes **exactly**
4. Do not invent endpoints not in the spec
5. Do not add database columns not in the spec

## Shared package

Install `dialed_shared` from `../shared/` in your `requirements.txt`:
```
-e ../../shared
```

Use its modules — do NOT reimplement:
- `dialed_shared.auth` — internal token verification
- `dialed_shared.errors` — error envelope serialization + exception handlers
- `dialed_shared.logging` — `setup_logger(service_name)` with stdlib formatter
- `dialed_shared.health` — standard `/health` endpoint
- `dialed_shared.redis_tasks` — task queue publish/consume helpers
- `dialed_shared.middleware` — common FastAPI middleware (request ID, timing)

## Cross-service communication rules

- **Never** import another service's code
- HTTP calls to other services go via `httpx` using env var URLs
- Always forward the `X-Internal-Token` from the incoming request
- Task queue jobs go via `dialed_shared.redis_tasks`
- Read generated types from `contracts/generated/python/`

## Standard per-service structure

```
services/[name]/
  main.py          FastAPI app factory (use dialed_shared.health for /health)
  models/          SQLAlchemy models (one file per entity)
  schemas/         Pydantic request/response schemas
  routers/         One file per resource
  services/        Business logic (not in routers)
  alembic/         Database migrations (target your schema only)
  tests/           pytest — target 80% coverage
  Dockerfile       Use the standard template from infra/
  requirements.txt Include dialed_shared
```

## Database rules

- Single Postgres instance, your service's schema only
- Connection string: `DATABASE_URL` env var
- Telemetry service also uses `TIMESCALE_URL`
- SQLAlchemy 2.0 async + Alembic
- All tables must be schema-qualified: `core.users`, `ai.suggestions`, `telemetry.telemetry_points`
- Use `gen_random_uuid()` for all primary keys
- Every table gets `created_at timestamptz NOT NULL DEFAULT now()`
- Mutable tables also get `updated_at timestamptz NOT NULL DEFAULT now()`

## Logging

- Use `dialed_shared.logging.setup_logger(service_name)`
- Every log entry includes: `service_name`, `request_id` (from `X-Request-ID`), `user_id`
- Python stdlib only — do not use structlog or loguru

## Environment variables

```
DATABASE_URL         postgresql+asyncpg://postgres:devpassword@postgres/dialed
TIMESCALE_URL        postgresql+asyncpg://postgres:devpassword@timescale/dialed_telemetry
REDIS_URL            redis://redis:6379
INTERNAL_SECRET      shared-secret-for-internal-tokens
CORE_API_URL         http://core-api:8001
TELEMETRY_URL        http://telemetry-ingestion:8002
AI_URL               http://ai:8003
ANTHROPIC_API_KEY    sk-ant-...
```

## Error envelope

All services use `dialed_shared.errors`:

```json
{
  "error": "Human readable message",
  "code": "MACHINE_READABLE_CODE",
  "request_id": "uuid from X-Request-ID header"
}
```

Standard codes: `VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `RATE_LIMITED`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`

## Port assignments

```
gateway:              8000
core-api:             8001
telemetry-ingestion:  8002
ai:                   8003
redis:                6379
postgres:             5432
timescale:            5433
frontend:             5173
```

## Testing

- pytest + pytest-asyncio
- Target 80% coverage minimum
- Test against a real Postgres instance (use Docker in CI)
- Mock external services (Claude API, Whisper API) in unit tests
- Mock inter-service HTTP calls with `respx` or `httpx` mocking
