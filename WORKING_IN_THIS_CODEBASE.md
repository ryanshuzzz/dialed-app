# Working in the Dialed Codebase — Complete Guide

> Read this before writing any code. It covers what the project is, how it's structured, the rules you must follow, and the workflows you'll use daily.

---

## What Dialed is

Dialed is a motorcycle management and tuning platform. It serves every rider — from street riders tracking oil changes to competitive racers dialing in suspension between qualifying sessions. The **Garage** is the universal entry point (maintenance, tire pressure, mods, ownership). Track features (sessions, telemetry, AI suggestions) layer on top for riders who go to the track.

Three feature sets:
- **Garage** — bikes, maintenance logs, tire pressure, modifications, ownership history
- **Sessions** — track day events, session logging, setup snapshots, change log
- **AI Suggestions** — rules engine + Claude streaming for suspension tuning recommendations

---

## Architecture at a glance

```
┌─────────────┐
│   Frontend   │  React 19 + TS + Vite (port 5173)
└──────┬───────┘
       │ Bearer token
┌──────▼───────┐
│   Gateway    │  Stateless proxy, JWT → internal token (port 8000)
└──┬───┬───┬───┘
   │   │   │
┌──▼┐ ┌▼──┐ ┌▼─┐
│Core│ │Tel│ │AI│   Three Python/FastAPI services
│API │ │em │ │  │   Ports: 8001, 8002, 8003
└─┬──┘ └┬──┘ └┬─┘
  │     │     │
┌─▼─────▼─────▼─┐  ┌────────────┐  ┌───────┐
│   PostgreSQL   │  │ TimescaleDB│  │ Redis │
│  (core, ai)    │  │ (telemetry)│  │(queue)│
│   port 5432    │  │  port 5433 │  │ 6379  │
└────────────────┘  └────────────┘  └───────┘
```

Single Postgres with per-service schemas (`core`, `telemetry`, `ai`). TimescaleDB as a separate instance for the 20Hz telemetry hypertable. Redis as a task queue only (two lists: `dialed:ingestion`, `dialed:ai`). SSE for real-time streaming of ingestion completion and AI suggestions.

---

## The contract-first rule

**This is the most important rule in the codebase.** The OpenAPI specs and JSON Schemas are the single source of truth. Everything — models, schemas, routers, tests, frontend types — must match them exactly.

Before writing any code:

1. Read `contracts/openapi/<your-service>.yaml` for endpoints, request/response shapes, and status codes
2. Read `contracts/json-schema/*.schema.json` for all data shapes
3. Match field names, status codes, and error shapes **exactly**
4. Do not invent endpoints not in the spec
5. Do not add database columns not in the spec

If you need a new field or endpoint, update the contract first, regenerate types (`make generate-types`), then implement.

### Contract file locations

```
contracts/
  openapi/
    core-api.yaml              ← Core API endpoints
    telemetry-ingestion.yaml   ← Telemetry & ingestion endpoints
    ai.yaml                    ← AI suggestion endpoints
  json-schema/
    auth.schema.json           ← Users, tokens, API keys
    garage.schema.json         ← Bikes, maintenance, tires, mods, ownership
    suspension-spec.schema.json← Versioned suspension settings (JSONB)
    conditions.schema.json     ← Weather/track conditions (JSONB)
    session.schema.json        ← Sessions, setup snapshots, change log
    telemetry.schema.json      ← Telemetry points, lap segments, ingestion jobs
    ai.schema.json             ← Suggestions, changes, generation jobs
    progress.schema.json       ← Efficacy stats
    task-payloads.schema.json  ← Redis queue message shapes
  generated/
    python/                    ← Auto-generated Pydantic models (11 files)
    typescript/                ← Auto-generated TS interfaces (11 files)
```

---

## Repository structure

```
dialed-app/
├── CLAUDE.md                  ← Master agent context (load first in every session)
├── .claude/agents/            ← Agent-specific context files (8 agents)
├── .claude/skills/            ← Reusable Claude skills (25+)
├── contracts/                 ← OpenAPI + JSON Schema (source of truth)
├── docs/                      ← Architecture docs, session state, references
├── frontend/                  ← React 19 + TypeScript PWA
├── infra/                     ← Docker Compose, Dockerfiles, Nginx, scripts
├── services/
│   ├── gateway/               ← Stateless reverse proxy (port 8000)
│   ├── core-api/              ← Garage, auth, sessions, progress (port 8001)
│   ├── telemetry-ingestion/   ← Pipelines, TimescaleDB, analysis (port 8002)
│   └── ai/                    ← Rules engine, Claude, suggestions (port 8003)
├── shared/                    ← dialed_shared Python package
├── Makefile                   ← Dev commands
├── docker-compose.yml         ← Root wrapper (includes infra/docker-compose.yml)
└── cursor.md                  ← Cursor IDE agent usage notes
```

### Standard per-service structure

Every Python service follows this layout:

```
services/<name>/
  main.py              ← FastAPI app factory (use dialed_shared for health/middleware/errors)
  db.py                ← SQLAlchemy async engine setup
  models/              ← SQLAlchemy models (one file per entity)
  schemas/             ← Pydantic request/response schemas
  routers/             ← One file per resource
  services/            ← Business logic (not in routers)
  worker.py            ← Redis queue consumer (telemetry + ai only)
  sse.py               ← Server-Sent Events (telemetry + ai only)
  alembic/             ← Database migrations (target your schema only)
  tests/               ← pytest suite
  Dockerfile           ← Multi-stage build
  requirements.txt     ← Includes -e ../../shared
```

---

## The shared package (`dialed_shared`)

Every service installs `dialed_shared` from `../shared/` via `-e ../../shared` in requirements.txt. **Do not reimplement any of its modules.** Use them directly.

| Module | What it provides |
|--------|-----------------|
| `auth` | `create_internal_token()`, `verify_internal_token()`, `get_current_user()` (FastAPI dependency) |
| `errors` | `ErrorResponse` model, exception classes (`NotFoundException`, `ValidationException`, etc.), `install_exception_handlers(app)` |
| `health` | `create_health_router(service_name)` — standard `GET /health` |
| `logging` | `setup_logger(service_name)` — stdlib formatter with `request_id` and `user_id` from contextvars |
| `middleware` | `RequestIdMiddleware`, `TimingMiddleware`, `install_middleware(app)` |
| `redis_tasks` | `push_job()` (LPUSH), `consume_jobs()` (BRPOP loop) |

### Standard app factory pattern

```python
from fastapi import FastAPI
from dialed_shared import (
    create_health_router, install_exception_handlers,
    install_middleware, setup_logger,
)

def create_app() -> FastAPI:
    logger = setup_logger("core-api")
    app = FastAPI(title="Dialed Core API")
    install_middleware(app)
    install_exception_handlers(app)
    app.include_router(create_health_router("core-api"))
    # ... include service routers ...
    return app
```

---

## Database rules

- Single Postgres instance, each service owns its schema only (`core`, `telemetry`, `ai`)
- Connection string: `DATABASE_URL` env var (telemetry also has `TIMESCALE_URL`)
- SQLAlchemy 2.0 async + Alembic
- All tables must be schema-qualified: `core.users`, `ai.suggestions`, `telemetry.telemetry_points`
- Primary keys: `gen_random_uuid()`
- Every table gets `created_at timestamptz NOT NULL DEFAULT now()`
- Mutable tables also get `updated_at timestamptz NOT NULL DEFAULT now()`
- Cross-schema references (e.g., `ai.suggestions.session_id` → `core.sessions.id`) are validated at the application layer, not with database FKs

---

## Authentication flow

```
Client → Bearer <Supabase JWT> → Gateway
  Gateway validates JWT, signs internal HS256 token (5 min TTL)
  Gateway forwards X-Internal-Token to upstream service
  Service uses Depends(get_current_user) to verify and extract user_id
```

Public endpoints (no token): `/auth/register`, `/auth/login`, `/auth/refresh`. Everything else requires auth.

---

## Error handling

All services use the standard error envelope:

```json
{
  "error": "Human readable message",
  "code": "MACHINE_READABLE_CODE",
  "request_id": "uuid from X-Request-ID header"
}
```

Standard codes: `VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `RATE_LIMITED`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`.

Raise exceptions — don't construct error responses manually:

```python
from dialed_shared import NotFoundException
raise NotFoundException(f"Bike {bike_id} not found")
```

---

## Cross-service communication

- **Never** import another service's code
- HTTP calls to other services go via `httpx` using env var URLs (`CORE_API_URL`, `TELEMETRY_URL`, `AI_URL`)
- Always forward the `X-Internal-Token` from the incoming request
- Async jobs go via `dialed_shared.redis_tasks` (push to Redis list, worker BRPOP)
- Read generated types from `contracts/generated/python/` or `contracts/generated/typescript/`

---

## Gateway routing

The gateway at port 8000 maps URL prefixes to backend services:

| Prefix | Routes to |
|--------|-----------|
| `auth`, `garage`, `sessions`, `progress`, `admin` | Core API (8001) |
| `ingest`, `telemetry` | Telemetry/Ingestion (8002) |
| `suggest` | AI (8003) |

SSE endpoints (`/ingest/jobs/{id}/stream`, `/suggest/{id}/stream`) get special handling: `proxy_buffering off`, 300s timeout, chunked transfer encoding.

---

## Logging

- Use `dialed_shared.logging.setup_logger(service_name)` — **stdlib only** (no structlog, no loguru)
- Every log line includes: `service_name`, `request_id` (from `X-Request-ID`), `user_id`
- Format: `2026-03-18T12:00:00 [core-api] [req:abc123] [user:def456] INFO  message`

---

## Environment variables

```
DATABASE_URL         postgresql+asyncpg://postgres:devpassword@postgres/dialed
TIMESCALE_URL        postgresql+asyncpg://postgres:devpassword@timescale/dialed_telemetry
REDIS_URL            redis://redis:6379
INTERNAL_SECRET      shared-secret-for-internal-tokens
CORE_API_URL         http://core-api:8001
TELEMETRY_URL        http://telemetry-ingestion:8002
AI_URL               http://ai:8003
ANTHROPIC_API_KEY    sk-ant-...  (AI service only, tests mock it)
VITE_GATEWAY_URL     http://localhost:8000  (frontend only)
```

---

## Development commands

```bash
# Start full stack (production-like)
make dev                    # or: docker compose up

# Start with live code reload
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up

# Rebuild everything
make dev-build              # or: docker compose up --build

# Run migrations
make migrate                # runs infra/scripts/migrate-all.sh

# Run tests
make test-core              # pytest in core-api container
make test-telemetry         # pytest in telemetry container
make test-ai                # pytest in ai container
make test-all               # all three sequentially

# Regenerate types from contracts
make generate-types         # bash on Unix, PowerShell on Windows

# Seed database
make seed                   # python infra/scripts/seed.py

# Tear down (removes volumes)
make clean                  # docker compose down -v
```

---

## Testing standards

- **Backend:** pytest + pytest-asyncio, httpx.AsyncClient for API tests, respx for HTTP mocking
- **Frontend:** Vitest (unit), Playwright (e2e), React Testing Library
- Target **80% coverage** per service
- Test against real Postgres (Docker in CI)
- **Mock all external services** (Claude API, Whisper API) in unit tests
- **Mock inter-service HTTP** calls with respx
- Contracts are the source of truth — if a test expectation doesn't match the OpenAPI spec, the test is wrong

---

## Agent system

The codebase uses a multi-agent development model. Each agent has a specific scope and responsibility.

### Loading context

Every agent session starts by loading:
1. `CLAUDE.md` — master architecture context (always)
2. `.claude/agents/<your-agent>.md` — service-specific domain context

### Available agents

| Agent | File | Scope |
|-------|------|-------|
| **core-api** | `.claude/agents/core-api.md` | Auth, garage, sessions, progress, admin. Schema: `core` |
| **telemetry-ingestion** | `.claude/agents/telemetry-ingestion.md` | Pipelines (CSV/OCR/voice), TimescaleDB, analysis. Schema: `telemetry` |
| **ai-service** | `.claude/agents/ai-service.md` | Rules engine, Claude streaming, suggestions. Schema: `ai` |
| **frontend** | `.claude/agents/frontend.md` | React screens, hooks, stores, SSE, PWA, MSW mocks |
| **integration-lead** | `.claude/agents/integration-lead.md` | Merges branches, boots Docker, delegates fixes. Uses Opus model |
| **infra-fixer** | `.claude/agents/infra-fixer.md` | Docker, Compose, Nginx, ports, env vars, healthchecks |
| **test-fixer** | `.claude/agents/test-fixer.md` | Fixes failing tests, writes missing coverage |

### Delegation rules

- Service-specific code bugs → that service's expert agent
- Docker, networking, env vars → infra-fixer
- Test assertion failures where the test is wrong → test-fixer
- Test failures where production code is wrong → service expert
- Cross-service issues → integration-lead coordinates

---

## Service-specific quick reference

### Core API (port 8001)

**Domain:** auth, bikes, maintenance, tire pressure, modifications, ownership, tracks, events, sessions, setup snapshots, change log, progress, admin (channel aliases).

**Key tables:** `core.users`, `core.bikes` (has `suspension_spec` JSONB), `core.events` (has `conditions` JSONB), `core.sessions` (dual lap times: `manual_best_lap_ms` + `csv_best_lap_ms`), `core.setup_snapshots` (append-only), `core.maintenance_logs` (has `next_due_km`/`next_due_date`), `core.modifications` (soft delete via `removed_at`), `core.channel_aliases`.

**Business logic to know:**
- `rider_type` is a UI hint only — it controls which nav items show on the frontend
- Maintenance "upcoming" logic: due within 500 km or 30 days
- Modifications use soft delete (filter `removed_at IS NULL` by default)
- Setup snapshots are immutable — append only, never update

### Telemetry/Ingestion (port 8002)

**Domain:** CSV/OCR/voice ingestion pipelines, 20Hz telemetry storage (TimescaleDB hypertable), lap segments, downsampling, analysis.

**Two database connections:** `DATABASE_URL` (Postgres for ingestion_jobs, lap_segments) and `TIMESCALE_URL` (TimescaleDB for telemetry_points).

**Pipeline flow:** Upload → create IngestionJob → push to `dialed:ingestion` Redis queue → worker runs pipeline → SSE completion event.

**Channel aliasing:** Before CSV processing, fetch aliases from Core API's `GET /admin/channel-aliases` to map logger-specific column names to canonical names.

### AI Service (port 8003)

**Domain:** suggestion generation, rules engine (suspension tree, geometry correlator, telemetry patterns), prompt building, Claude streaming, suggestion/change storage.

**Suggestion flow:** `POST /suggest` → create GenerationJob → push to `dialed:ai` queue → worker gathers context (HTTP to Core + Telemetry) → rules engine → build prompt (max 6000 tokens) → stream Claude (`claude-sonnet-4-6`) → parse + store → SSE stream to client.

**Inter-service calls:** Fetches session, changes, bike, maintenance, events from Core API. Optionally fetches telemetry (30s timeout, graceful degradation if unavailable).

**Job lifecycle:** `pending → processing → streaming → complete` (or `→ failed` from any stage).

### Frontend (port 5173)

**Stack:** React 19, TypeScript (strict), Vite, Tailwind, TanStack Query v5, Zustand, Recharts, EventSource API, IndexedDB (offline queue).

**Screens:** Garage, BikeDetail (tabbed), MaintenanceLog, SessionLogger (wizard), SessionDetail, Progress, Admin, Settings.

**SSE integration:** Two patterns — ingestion (POST → job_id → EventSource for completion) and AI (POST → job_id → EventSource for typewriter streaming).

**API calls:** All go through gateway at `VITE_GATEWAY_URL/api/v1/`, with `Authorization: Bearer <token>`.

**MSW mocks:** 15+ handler files in `src/mocks/handlers/` matching service routers. Generated from OpenAPI specs.

---

## Documentation map

| Document | Location | Purpose |
|----------|----------|---------|
| Master context | `CLAUDE.md` | Architecture, conventions, rules |
| This guide | `WORKING_IN_THIS_CODEBASE.md` | Complete onboarding reference |
| Final plan | `docs/dialed-app-v1-final-plan.md` | All architecture decisions with rationale |
| Session state | `docs/SESSION_STATE.md` | Living handoff document — what's done, what's next |
| API reference | `docs/api-reference.md` | Complete endpoint reference for all services |
| Infrastructure | `docs/infrastructure-reference.md` | Docker, Compose, Nginx, Dockerfiles |
| JSON Schema ref | `docs/json-schema-reference.md` | Narrative guide to all data shapes |
| Shared package ref | `docs/shared-package-reference.md` | Module-by-module dialed_shared docs |
| Feedback/mods | `docs/feedback-sessions-and-mods.md` | Recent session/mod feature traceability |
| Cursor tips | `cursor.md` | Token-efficient Cursor Agent usage |

---

## Current project state

As of **2026-03-19** (from `docs/SESSION_STATE.md`):

**Completed:**
- Stage 2 integration — all four services merged, gateway routing verified, e2e flow green
- Frontend auth (login, auth guard, logout)
- Session create/event fixes, mods category fixes, session notes + change log UI
- Dev ergonomics (Windows codegen, `.venv` setup, README agent path fix)

**Branch:** `alex-dev` (tracked: `origin/alex-dev`)

**Next up:**
1. Stage 3 kickoff — real/realistic seed data (bikes, AiM CSVs, setup sheets)
2. Deploy path — mini PC + Cloudflare Tunnel
3. Verify release tag (`v1.0.0-alpha`)

---

## Common workflows

### Adding a new endpoint

1. Update the OpenAPI spec in `contracts/openapi/<service>.yaml`
2. Update JSON schemas if new data shapes are needed
3. Run `make generate-types` to regenerate Python + TypeScript types
4. Implement the model, schema, router, and service logic
5. Add Alembic migration if schema changes
6. Write tests (match assertions to the contract)
7. Update MSW mock handlers in the frontend if the frontend will consume it

### Running the full e2e flow locally

```bash
make dev-build              # build and start everything
make migrate                # run all migrations
# Then in the browser at localhost:5173:
# Register → Create bike → Log maintenance → Create event → Create session → Upload CSV → Request AI suggestion
```

### Debugging a service

```bash
docker compose ps                                    # check container health
docker compose logs <service>                        # read logs
docker compose exec <service> env                    # verify env vars
docker compose exec postgres psql -U postgres -d dialed -c "\dn"  # list schemas
docker compose exec <service> curl -f http://<other>:<port>/health  # test connectivity
```

### After making contract changes

```bash
make generate-types         # regenerate Python + TypeScript types
# Then verify: models, schemas, routers, tests, and frontend types all match
```

---

## Things that will trip you up

1. **Two database connections in telemetry** — `DATABASE_URL` for Postgres tables, `TIMESCALE_URL` for the hypertable. Don't mix them up.
2. **Schema-qualified tables** — always use `core.bikes`, never just `bikes`. Set `__table_args__ = {"schema": "core"}` in SQLAlchemy models.
3. **Soft deletes on modifications** — filter `removed_at IS NULL` by default. Forgetting this returns "deleted" mods.
4. **Append-only snapshots** — `setup_snapshots` are immutable. Never add update endpoints.
5. **Suspension spec is JSONB** — validated at the application layer against `suspension-spec.schema.json`, not by database constraints.
6. **SSE needs proxy_buffering off** — if SSE stops working, check Nginx config first.
7. **Internal token, not Bearer token** — services read `X-Internal-Token`, not `Authorization`. The gateway handles the translation.
8. **Redis is queue-only** — no caching, no pub/sub, no sessions. Two lists: `dialed:ingestion` and `dialed:ai`.
9. **Agent context files are in `.claude/agents/`** — not in a root `agents/` folder (the root one is empty).
10. **`rider_type` is cosmetic** — it controls frontend nav visibility, not backend authorization. Don't gate API access on it.
