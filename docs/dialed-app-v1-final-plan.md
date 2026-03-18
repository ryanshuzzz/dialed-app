# Dialed App v1 — Final Implementation Plan

> **Status:** Decisions finalized — ready for contract writing and agent delegation  
> **Last updated:** March 2026  
> **Purpose:** Definitive architecture and implementation plan for the first public release of Dialed

-----

## Table of contents

1. [Decision log](#decision-log)
2. [Overview](#overview)
3. [Tech stack](#tech-stack)
4. [Service boundaries](#service-boundaries)
5. [Repo structure](#repo-structure)
6. [Data model](#data-model)
7. [Task queue schema](#task-queue-schema)
8. [API contracts (summary)](#api-contracts-summary)
9. [Agent delegation plan](#agent-delegation-plan)
10. [Infrastructure](#infrastructure)
11. [Cost breakdown](#cost-breakdown)
12. [Open questions (remaining)](#open-questions-remaining)
13. [Out of scope for v1](#out-of-scope-for-v1)

-----

## Decision log

Every architectural decision made during review, recorded for future reference.

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Architecture | Hybrid: 3 services (Core API + Telemetry/Ingestion + AI) | Meaningful separation where it matters without 7-container overhead on a mini PC |
| 2 | Database | Single Postgres, per-service schemas (`core`, `telemetry`, `ai`) | Real isolation for parallel development, single backup target, cross-schema FKs available |
| 3 | Service auth | Gateway + shared internal secret | Gateway validates JWT, signs an internal token with a shared secret, services verify cheaply |
| 4 | Event bus | Redis as task queue only (ingestion jobs + AI generation) | Async where it genuinely matters, HTTP for everything else — no full event bus overhead |
| 5 | Telemetry storage | TimescaleDB from day one | Continuous aggregates for lap metrics, hypertable partitioning for 20Hz data |
| 6 | Agent strategy | Parallel with shared infra layer written first | Docker Compose, shared utils, Dockerfile template established before agents launch |
| 7 | Schema language | JSON Schema as canonical source → generate Pydantic models + TypeScript types | Single source of truth, both backend and frontend stay in sync |
| 8 | suspension_spec | Validated JSONB with versioned Pydantic model (`schema_version` field inside) | Flexible enough for different bikes, structured enough for AI reasoning |
| 9 | Telemetry data shape | Hybrid wide table: real columns for core channels + JSONB overflow for extras | Fast cross-channel correlation queries, no schema migration for rare channels |
| 10 | Naming | Auth sessions renamed to `auth_tokens`, `sessions` reserved for track sessions | Eliminates confusion across code, logs, and conversations |
| 11 | Ingestion API | Async with SSE notification when job completes | Consistent pattern across CSV/OCR/voice, no polling, best UX |
| 12 | AI suggestion API | Async with SSE streaming (suggestion text streams as Claude generates it) | Rider reads reasoning incrementally instead of waiting behind a spinner |
| 13 | Suggestion tracking | Junction table: each individual change tracked separately | Richest feedback signal for AI tuning — knows which changes riders apply, skip, or adjust |
| 14 | Conditions | Structured JSONB for key metrics + free text notes field | Enables analytical correlation with lap times while preserving rider's natural descriptions |
| 15 | AiM channel aliasing | Database lookup table for channel name mappings | New aliases added via admin UI without redeployment |
| 16 | Lap time source | Keep both: `manual_best_lap_ms` and `csv_best_lap_ms`, display CSV when available | No data loss, logger is more accurate, manual entry preserved as fallback |
| 17 | Logging | Python stdlib logging with a shared formatter (service_name, request_id, user_id) | Sufficient for 3 services, minimal setup overhead |
| 18 | Missing endpoints | Add full CRUD (PATCH + DELETE) for tracks, events, and sessions | Riders need to fix mistakes — create-only is too restrictive |
| 19 | Garage scope | Expand Garage beyond track-only to include maintenance tracking, ownership timeline, and general bike management | Makes the app useful for all riders — street, casual, and competitive — not just track racers |

-----

## Overview

Dialed is a motorcycle management and tuning platform. At its core, it helps riders take care of their bikes and get faster on track — whether that means tracking oil changes on a street bike or dialing in fork rebound between qualifying sessions.

The v1 architecture uses three independently deployable services that split along natural scaling and responsibility boundaries. Each service owns its own database schema within a shared Postgres instance, exposes a versioned REST API, and uses Redis solely as a task queue for genuinely asynchronous work (data ingestion and AI generation). A single API gateway handles routing, auth, and rate limiting.

### Who Dialed is for

**Every rider**, not just competitive racers. The Garage feature is the universal entry point — any rider with a motorcycle can use Dialed to track their bike's maintenance, tire pressures, modifications, and ownership history. The track tuning, telemetry, and AI features layer on top for riders who take their bike to the track. This means a casual street rider and a competitive racer both find value from day one, and the street rider has a natural path into track features when they're ready.

### The three services

**Core API** — The main application backend. Owns users, auth tokens, bikes (including maintenance logs, tire pressure history, ownership records, and modification tracking), tracks, events, sessions, setup snapshots, change logs, and progress/efficacy analytics. This is where most CRUD operations live and where the frontend spends most of its time talking.

**Telemetry/Ingestion** — Handles data pipelines (CSV parsing, OCR extraction, voice transcription) and owns all telemetry storage in TimescaleDB. Processes ingestion jobs asynchronously via Redis task queue and notifies clients via SSE when jobs complete.

**AI** — Runs the rules engine, builds prompts, calls Claude API, and owns suggestion storage. Generates suggestions asynchronously via Redis task queue and streams results to clients via SSE as Claude generates them. Reads session and bike data from Core API via HTTP.

### Primary goals

- **Useful for all riders** — Garage maintenance tracking works standalone for street/casual riders; track features layer on for competitive riders
- **Clean domain separation** — each service owns its data and logic completely
- **Async where it matters** — ingestion and AI generation run in the background with SSE notifications
- **Offline-first PWA** — full offline capability with sync queue, installable on iOS/Android
- **Parallel development** — 3 agents (plus frontend) can build simultaneously against shared contracts
- **Operational simplicity** — 3 services on a mini PC, not 7; single Postgres instance; Redis does one job

### What's new in v1 (compared to prototype)

- API gateway with unified routing, rate limiting, and internal auth token
- Redis task queue for async ingestion and AI jobs (not a full event bus)
- TimescaleDB for 20Hz AiM telemetry data (replaces flat CSV storage)
- SSE streaming for AI suggestions and ingestion job completion
- Validated JSONB with versioned Pydantic models for suspension specs
- Hybrid wide-column telemetry table with JSONB overflow
- JSON Schema contracts as canonical source for both Pydantic and TypeScript types
- Database lookup table for AiM channel name aliasing
- **Garage expansion**: maintenance logs, tire pressure tracking, modification history, ownership timeline, mileage/hours tracking
- Git worktrees enabling parallel agent development
- MSW mocks generated from OpenAPI specs (frontend never blocked on backend)
- Docker Compose full local stack with healthchecks

-----

## Tech stack

### Backend services

| Layer            | Technology                        | Reason                                                |
|------------------|-----------------------------------|-------------------------------------------------------|
| Language         | Python 3.12                       | Rules engine already in Python; FastAPI ecosystem     |
| Framework        | FastAPI                           | Async-native, auto OpenAPI docs, Pydantic validation  |
| ORM              | SQLAlchemy 2.0 async              | Async queries, Alembic migrations                     |
| Migrations       | Alembic                           | Per-service schema, independent migration history     |
| Auth             | python-jose                       | Internal token verification (Supabase Auth for OAuth) |
| HTTP client      | httpx (async)                     | Gateway upstream calls, inter-service communication   |
| Task queue       | redis-py (async) via arq or rq    | Async job processing for ingestion and AI             |
| SSE              | sse-starlette                     | Server-sent events for streaming responses            |
| AI               | anthropic SDK                     | Claude API calls with streaming in AI service         |
| OCR              | Claude vision (claude-sonnet-4-6) | Setup sheet photo extraction                          |
| Voice            | OpenAI Whisper API                | Audio transcription (API, not local, for v1)          |
| Logging          | Python stdlib + shared formatter  | JSON-ish output with service_name, request_id, user_id|
| Testing          | pytest + pytest-asyncio           | Per-service test suites                               |
| Containers       | Docker + Docker Compose           | Local dev and mini PC deployment                      |
| Schema tooling   | JSON Schema + datamodel-code-generator + json-schema-to-typescript | Canonical contracts generating Pydantic + TS types |

### Frontend

| Layer         | Technology                | Reason                                          |
|---------------|---------------------------|-------------------------------------------------|
| Framework     | React 19 + TypeScript     | Latest stable, improved performance, `use` hook |
| Build         | Vite                      | Fast HMR, PWA plugin                            |
| Styling       | Tailwind CSS              | Utility-first, no CSS conflicts across services |
| Data fetching | TanStack Query            | Cache, background sync, offline state           |
| State         | Zustand                   | Lightweight, no boilerplate                     |
| PWA           | vite-plugin-pwa + Workbox | Service worker, offline caching                 |
| Offline queue | IndexedDB (via idb)       | Queue mutations when offline                    |
| Charts        | Recharts                  | Lap time trends, progress dashboard             |
| SSE client    | EventSource API           | Receive streaming suggestions + job completions |
| API mocks     | MSW (via openapi-msw)     | Frontend dev independent of live backend        |
| Type gen      | json-schema-to-typescript | Generated from canonical JSON Schema contracts  |

### Infrastructure

| Component     | Local dev          | Production                       |
|---------------|--------------------|----------------------------------|
| Database      | Docker Postgres 16 | Supabase (free → Pro)            |
| Telemetry DB  | Docker TimescaleDB | TimescaleDB on mini PC           |
| Task queue    | Docker Redis 7     | Docker Redis on mini PC (AOF persistence) |
| Blob storage  | Local filesystem   | Supabase Storage or S3           |
| Frontend      | localhost:5173     | Cloudflare Pages (free)          |
| Backend       | Docker Compose     | Mini PC via Cloudflare Tunnel    |
| Reverse proxy | Nginx (Docker)     | Nginx on mini PC                 |

-----

## Service boundaries

### Service map

```
┌─────────────────────────────────────────────────────┐
│                     Clients                          │
│            PWA / Mobile · External / Team            │
└────────────────────┬────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────────┐
│                  API Gateway                         │
│   JWT validation · Internal token signing            │
│   Rate limiting · CORS · Routing · Request tracing   │
└──────────┬─────────────┬────────────┬───────────────┘
           │             │            │
           ▼             ▼            ▼
      Core API    Telemetry/Ingest    AI
      (port 8001)  (port 8002)    (port 8003)
           │             │            │
           │         ┌───┘            │
           │         ▼                │
           │     TimescaleDB          │
           │                          │
           ├──────────────────────────┤
           │    Shared Postgres       │
           │  (core / ai schemas)     │
           └──────────┬───────────────┘
                      │
                   Redis
               (task queue only)
```

### Service responsibilities

| Service | Owns (DB schema) | Async work via Redis | Reads from (HTTP) |
|---------|------------------|---------------------|--------------------|
| **Gateway** | Nothing — stateless proxy | — | — |
| **Core API** | `core` schema: users, auth_tokens, bikes, maintenance_logs, tire_pressure_logs, modifications, ownership_history, tracks, events, sessions, setup_snapshots, change_log, progress, efficacy, channel_aliases | — | — |
| **Telemetry/Ingestion** | `telemetry` schema: telemetry_points (TimescaleDB hypertable), lap_segments. Ingestion job state. | CSV parsing, OCR extraction, voice transcription | Core API (session context for ingestion jobs) |
| **AI** | `ai` schema: suggestions, suggestion_changes (junction table) | Suggestion generation (rules engine + Claude API) | Core API (session, bike, setup, change history for prompt building) |

### Communication patterns

**Client → Gateway → Service (synchronous HTTP):** All CRUD operations. The gateway validates the Supabase JWT, signs an internal token with a shared secret containing `user_id` and `exp`, and forwards the request with the internal token in `X-Internal-Token`. Each service verifies the internal token cheaply using the shared secret.

**Client → Service (SSE streaming):** Two SSE endpoints exist. The Telemetry/Ingestion service exposes `GET /ingest/jobs/:id/stream` which sends a completion event when a job finishes. The AI service exposes `GET /suggest/:job_id/stream` which streams the suggestion text as Claude generates it.

**Service → Redis → Service (async task queue):** When Core API receives a CSV upload or suggestion request, it pushes a job to a Redis queue. The appropriate service picks it up, processes it, writes results to its own schema, and sends an SSE event to any listening clients.

**Service → Service (synchronous HTTP):** The AI service calls Core API endpoints to fetch session data, bike specs, setup snapshots, and change history when building a suggestion prompt. Telemetry/Ingestion calls Core API to fetch session context for ingestion jobs. These are internal HTTP calls using the internal token.

-----

## Repo structure

```
dialed-app/
│
├── contracts/                          ← written FIRST, before any service code
│   ├── json-schema/
│   │   ├── auth.schema.json
│   │   ├── garage.schema.json          ← bikes, maintenance, tires, mods, ownership
│   │   ├── session.schema.json
│   │   ├── ingestion.schema.json
│   │   ├── telemetry.schema.json
│   │   ├── ai.schema.json
│   │   ├── progress.schema.json
│   │   ├── suspension-spec.schema.json ← versioned suspension_spec shape
│   │   ├── conditions.schema.json      ← structured weather/track conditions
│   │   └── task-payloads.schema.json   ← Redis task queue job payloads
│   ├── openapi/
│   │   ├── core-api.yaml               ← auth + garage + session + progress
│   │   ├── telemetry-ingestion.yaml
│   │   └── ai.yaml
│   └── generated/                      ← auto-generated, do not edit
│       ├── python/                     ← Pydantic models from JSON Schema
│       └── typescript/                 ← TS types from JSON Schema
│
├── shared/                             ← shared Python package installed by all services
│   ├── dialed_shared/
│   │   ├── __init__.py
│   │   ├── auth.py                     ← internal token verification helper
│   │   ├── errors.py                   ← error envelope serialization
│   │   ├── logging.py                  ← shared log formatter (stdlib)
│   │   ├── health.py                   ← standard healthcheck endpoint
│   │   ├── redis_tasks.py              ← task queue publish/consume helpers
│   │   └── middleware.py               ← common FastAPI middleware
│   ├── setup.py
│   └── requirements.txt
│
├── services/
│   ├── gateway/
│   │   ├── main.py
│   │   ├── middleware/
│   │   │   ├── jwt_validation.py       ← validates Supabase JWT
│   │   │   ├── internal_token.py       ← signs internal token with shared secret
│   │   │   ├── rate_limit.py
│   │   │   ├── cors.py
│   │   │   └── tracing.py             ← assigns X-Request-ID
│   │   ├── routers/
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   │
│   ├── core-api/
│   │   ├── main.py
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── auth_token.py
│   │   │   ├── bike.py
│   │   │   ├── maintenance_log.py      ← oil changes, chain, coolant, etc.
│   │   │   ├── tire_pressure_log.py    ← timestamped pressure readings
│   │   │   ├── modification.py         ← parts added/removed/swapped
│   │   │   ├── ownership.py            ← bought/sold dates, price, mileage
│   │   │   ├── track.py
│   │   │   ├── event.py
│   │   │   ├── session.py
│   │   │   ├── setup_snapshot.py
│   │   │   ├── change_log.py
│   │   │   ├── efficacy.py
│   │   │   └── channel_alias.py
│   │   ├── schemas/
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── bikes.py
│   │   │   ├── maintenance.py          ← maintenance log CRUD
│   │   │   ├── tire_pressure.py        ← tire pressure log CRUD
│   │   │   ├── modifications.py        ← modification history CRUD
│   │   │   ├── ownership.py            ← ownership timeline CRUD
│   │   │   ├── tracks.py
│   │   │   ├── events.py
│   │   │   ├── sessions.py
│   │   │   ├── progress.py
│   │   │   └── admin.py
│   │   ├── services/
│   │   ├── alembic/
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   │
│   ├── telemetry-ingestion/
│   │   ├── main.py
│   │   ├── models/
│   │   │   ├── telemetry_point.py
│   │   │   ├── lap_segment.py
│   │   │   └── ingestion_job.py
│   │   ├── pipelines/
│   │   │   ├── csv_parser.py
│   │   │   ├── ocr_pipeline.py
│   │   │   └── voice_pipeline.py
│   │   ├── analysers/
│   │   │   ├── braking_zones.py
│   │   │   ├── fork_rebound.py
│   │   │   └── tcs_detector.py
│   │   ├── worker.py
│   │   ├── sse.py
│   │   ├── alembic/
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   │
│   └── ai/
│       ├── main.py
│       ├── models/
│       │   ├── suggestion.py
│       │   └── suggestion_change.py
│       ├── rules_engine/
│       │   ├── suspension_tree.py
│       │   ├── geometry_correlator.py
│       │   └── telemetry_patterns.py
│       ├── llm/
│       │   ├── prompt_builder.py
│       │   └── skill_adapter.py
│       ├── worker.py
│       ├── sse.py
│       ├── alembic/
│       ├── tests/
│       ├── Dockerfile
│       └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── screens/
│   │   │   ├── Garage.tsx              ← bike list + maintenance dashboard
│   │   │   ├── BikeDetail.tsx          ← single bike: specs, maintenance, mods, tires
│   │   │   ├── MaintenanceLog.tsx      ← add/view maintenance entries
│   │   │   ├── SessionLogger.tsx
│   │   │   ├── SessionDetail.tsx
│   │   │   ├── Progress.tsx
│   │   │   ├── Admin.tsx
│   │   │   └── Settings.tsx
│   │   ├── stores/
│   │   ├── hooks/
│   │   ├── sw/
│   │   └── mocks/
│   ├── public/
│   │   └── manifest.json
│   ├── vite.config.ts
│   └── package.json
│
├── infra/
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml
│   ├── nginx/
│   │   └── nginx.conf
│   └── scripts/
│       ├── generate-types.sh
│       ├── seed.py
│       └── migrate-all.sh
│
├── CLAUDE.md                           ← master context loaded by all agents
├── agents/                             ← per-agent context files
│   ├── CLAUDE-core-api.md
│   ├── CLAUDE-telemetry-ingestion.md
│   ├── CLAUDE-ai.md
│   └── CLAUDE-frontend.md
├── Makefile
└── README.md
```

-----

## Data model

Three schemas in a single Postgres instance. TimescaleDB extension enabled for the telemetry schema.

### `core` schema

```sql
-- ============ AUTH ============

CREATE TABLE core.users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  display_name  text,
  skill_level   text NOT NULL DEFAULT 'novice'
                CHECK (skill_level IN ('novice', 'intermediate', 'expert')),
  rider_type    text NOT NULL DEFAULT 'street'
                CHECK (rider_type IN ('street', 'casual_track', 'competitive')),
  units         text NOT NULL DEFAULT 'metric'
                CHECK (units IN ('metric', 'imperial')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE core.auth_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES core.users(id),
  token_hash    text NOT NULL,
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============ GARAGE — BIKES ============

CREATE TABLE core.bikes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES core.users(id),
  make             text NOT NULL,
  model            text NOT NULL,
  year             int,
  vin              text,
  color            text,
  mileage_km       int,                          -- current odometer reading
  engine_hours     double precision,              -- for track bikes with hour meters
  exhaust          text,
  ecu              text,
  gearing_front    int,
  gearing_rear     int,
  suspension_spec  jsonb NOT NULL DEFAULT '{}',
  -- suspension_spec validated by Pydantic on write
  -- contains: { "schema_version": 1, "front": {...}, "rear": {...} }
  notes            text,
  status           text NOT NULL DEFAULT 'owned'
                   CHECK (status IN ('owned', 'sold', 'stored', 'in_repair')),
  deleted_at       timestamptz,                  -- soft delete
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bikes_user_id ON core.bikes(user_id) WHERE deleted_at IS NULL;

-- ============ GARAGE — MAINTENANCE ============

CREATE TABLE core.maintenance_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bike_id          uuid NOT NULL REFERENCES core.bikes(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES core.users(id),
  category         text NOT NULL
                   CHECK (category IN (
                     'oil_change', 'coolant', 'brake_fluid', 'chain',
                     'air_filter', 'spark_plugs', 'valve_check',
                     'brake_pads', 'battery', 'general_service', 'other'
                   )),
  description      text,                         -- what was done
  mileage_km       int,                          -- odometer at time of service
  engine_hours     double precision,              -- hour meter at time of service
  cost             decimal(10,2),                 -- cost of service
  currency         text DEFAULT 'USD',
  performed_by     text,                         -- self, shop name, mechanic name
  performed_at     date NOT NULL,                -- when the work was done
  next_due_km      int,                          -- mileage for next service
  next_due_date    date,                         -- date for next service
  notes            text,
  receipt_url      text,                         -- photo of receipt in blob storage
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_maintenance_bike ON core.maintenance_logs(bike_id, performed_at DESC);
CREATE INDEX idx_maintenance_user ON core.maintenance_logs(user_id);
CREATE INDEX idx_maintenance_category ON core.maintenance_logs(bike_id, category);

-- ============ GARAGE — TIRE PRESSURE ============

CREATE TABLE core.tire_pressure_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bike_id          uuid NOT NULL REFERENCES core.bikes(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES core.users(id),
  front_psi        double precision,
  rear_psi         double precision,
  front_temp_c     double precision,             -- tire temp at reading (track use)
  rear_temp_c      double precision,
  context          text DEFAULT 'pre_ride'
                   CHECK (context IN (
                     'cold', 'pre_ride', 'post_ride', 'pit_stop',
                     'pre_session', 'post_session'
                   )),
  session_id       uuid,                         -- optional link to track session
  notes            text,
  recorded_at      timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tire_pressure_bike ON core.tire_pressure_logs(bike_id, recorded_at DESC);

-- ============ GARAGE — MODIFICATIONS ============

CREATE TABLE core.modifications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bike_id          uuid NOT NULL REFERENCES core.bikes(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES core.users(id),
  action           text NOT NULL
                   CHECK (action IN ('installed', 'removed', 'swapped', 'upgraded', 'repaired')),
  category         text NOT NULL
                   CHECK (category IN (
                     'exhaust', 'ecu', 'suspension', 'brakes', 'wheels_tires',
                     'bodywork', 'controls', 'lighting', 'engine', 'drivetrain',
                     'electronics', 'ergonomics', 'other'
                   )),
  part_name        text NOT NULL,                -- e.g. "Ohlins TTX GP rear shock"
  brand            text,
  part_number      text,
  cost             decimal(10,2),
  currency         text DEFAULT 'USD',
  installed_at     date NOT NULL,
  removed_at       date,                         -- null if still installed
  mileage_km       int,                          -- odometer at install
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mods_bike ON core.modifications(bike_id, installed_at DESC);
CREATE INDEX idx_mods_category ON core.modifications(bike_id, category);

-- ============ GARAGE — OWNERSHIP ============

CREATE TABLE core.ownership_history (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bike_id          uuid NOT NULL REFERENCES core.bikes(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES core.users(id),
  event_type       text NOT NULL
                   CHECK (event_type IN ('purchased', 'sold', 'traded', 'gifted', 'transferred')),
  date             date NOT NULL,
  price            decimal(10,2),
  currency         text DEFAULT 'USD',
  mileage_km       int,                          -- odometer at transaction
  counterparty     text,                         -- dealer name, private seller, etc.
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ownership_bike ON core.ownership_history(bike_id, date DESC);

-- ============ GARAGE — TRACKS ============

CREATE TABLE core.tracks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  config           text,
  surface_notes    text,
  gps_bounds       jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ============ GARAGE — EVENTS ============

CREATE TABLE core.events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES core.users(id),
  bike_id          uuid NOT NULL REFERENCES core.bikes(id),
  track_id         uuid NOT NULL REFERENCES core.tracks(id),
  date             date NOT NULL,
  conditions       jsonb NOT NULL DEFAULT '{}',
  -- conditions schema: {
  --   "temp_c": number|null,
  --   "humidity_pct": number|null,
  --   "track_temp_c": number|null,
  --   "wind_kph": number|null,
  --   "condition": "dry"|"damp"|"wet"|"mixed"|null,
  --   "notes": "string"
  -- }
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_user_bike_track
  ON core.events(user_id, bike_id, track_id);
CREATE INDEX idx_events_date ON core.events(date);

-- ============ SESSIONS ============

CREATE TABLE core.sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid NOT NULL REFERENCES core.events(id),
  user_id          uuid NOT NULL REFERENCES core.users(id),
  session_type     text NOT NULL
                   CHECK (session_type IN ('practice','qualifying','race','trackday')),
  manual_best_lap_ms  int,
  csv_best_lap_ms     int,
  tire_front       jsonb,
  tire_rear        jsonb,
  rider_feedback   text,
  voice_note_url   text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_event ON core.sessions(event_id);
CREATE INDEX idx_sessions_user ON core.sessions(user_id);

CREATE TABLE core.setup_snapshots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid NOT NULL REFERENCES core.sessions(id),
  settings         jsonb NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
  -- APPEND ONLY — never UPDATE
);
CREATE INDEX idx_snapshots_session ON core.setup_snapshots(session_id);

CREATE TABLE core.change_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid NOT NULL REFERENCES core.sessions(id),
  parameter        text NOT NULL,
  from_value       text,
  to_value         text NOT NULL,
  rationale        text,
  applied_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_changelog_session ON core.change_log(session_id);

-- ============ PROGRESS / EFFICACY ============

CREATE TABLE core.efficacy_stats (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES core.users(id),
  suggestion_id    uuid NOT NULL,
  lap_delta_ms     int,
  recorded_at      timestamptz NOT NULL DEFAULT now()
);

-- ============ CHANNEL ALIASING ============

CREATE TABLE core.channel_aliases (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_name         text NOT NULL,
  canonical_name   text NOT NULL,
  logger_model     text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (raw_name, logger_model)
);
```

### `telemetry` schema (TimescaleDB)

```sql
CREATE TABLE telemetry.telemetry_points (
  time               timestamptz NOT NULL,
  session_id         uuid NOT NULL,
  gps_speed          double precision,
  throttle_pos       double precision,
  rpm                double precision,
  gear               smallint,
  lean_angle         double precision,
  front_brake_psi    double precision,
  rear_brake_psi     double precision,
  fork_position      double precision,
  shock_position     double precision,
  coolant_temp       double precision,
  oil_temp           double precision,
  lat                double precision,
  lon                double precision,
  extra_channels     jsonb DEFAULT '{}'
);

SELECT create_hypertable('telemetry.telemetry_points', 'time');
CREATE INDEX idx_telemetry_session_time
  ON telemetry.telemetry_points(session_id, time);

CREATE TABLE telemetry.lap_segments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid NOT NULL,
  lap_number       int NOT NULL,
  start_time_ms    bigint NOT NULL,
  end_time_ms      bigint NOT NULL,
  lap_time_ms      int NOT NULL,
  beacon_start_s   double precision,
  beacon_end_s     double precision,
  UNIQUE (session_id, lap_number)
);

CREATE TABLE telemetry.ingestion_jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid NOT NULL,
  source           text NOT NULL CHECK (source IN ('csv', 'ocr', 'voice')),
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  result           jsonb,
  error_message    text,
  confidence       double precision,
  created_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz
);
```

### `ai` schema

```sql
CREATE TABLE ai.suggestions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid NOT NULL,
  user_id          uuid NOT NULL,
  suggestion_text  text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_suggestions_session ON ai.suggestions(session_id);

CREATE TABLE ai.suggestion_changes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id    uuid NOT NULL REFERENCES ai.suggestions(id) ON DELETE CASCADE,
  parameter        text NOT NULL,
  suggested_value  text NOT NULL,
  symptom          text,
  confidence       double precision,
  applied_status   text NOT NULL DEFAULT 'not_applied'
                   CHECK (applied_status IN ('not_applied', 'applied', 'applied_modified', 'skipped')),
  actual_value     text,
  outcome_lap_delta_ms int,
  applied_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_suggestion_changes_suggestion
  ON ai.suggestion_changes(suggestion_id);

CREATE TABLE ai.generation_jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid NOT NULL,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'processing', 'streaming', 'complete', 'failed')),
  error_message    text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz
);
```

-----

## Task queue schema

Redis is used only as a task queue. Two queue names, simple JSON payloads.

### Queue: `dialed:ingestion`

```json
{
  "job_id": "uuid",
  "session_id": "uuid",
  "user_id": "uuid",
  "source": "csv | ocr | voice",
  "file_path": "/storage/uploads/abc123.csv",
  "created_at": "ISO 8601"
}
```

### Queue: `dialed:ai`

```json
{
  "job_id": "uuid",
  "session_id": "uuid",
  "user_id": "uuid",
  "created_at": "ISO 8601"
}
```

Both queues use Redis Lists (`LPUSH` / `BRPOP`) for simplicity. No consumer groups, no streams. If a worker crashes mid-job, the job row in the database stays in `processing` status and can be retried by a periodic sweep or manual intervention.

-----

## API contracts (summary)

Full specs live in `contracts/openapi/`. Gateway routes all requests under `/api/v1/`.

### Gateway (port 8000)

```
GET  /health                 → per-service status with overall health
GET  /docs                   → unified OpenAPI UI
```

### Core API (port 8001) — routed via `/api/v1/`

**Auth:**
```
POST /auth/register          → { user_id, token, refresh_token }
POST /auth/login             → { token, refresh_token }
POST /auth/refresh           → { token }
GET  /auth/me                → { user_id, email, display_name, skill_level, rider_type, units }
PATCH /auth/me               → update profile fields
```

**Garage — Bikes:**
```
GET    /garage/bikes         → list user's bikes (excludes soft-deleted)
POST   /garage/bikes         → create bike (validates suspension_spec)
GET    /garage/bikes/:id     → bike detail + suspension_spec + summary stats
PATCH  /garage/bikes/:id     → update bike
DELETE /garage/bikes/:id     → soft delete (sets deleted_at)
```

**Garage — Maintenance:**
```
GET    /garage/bikes/:bike_id/maintenance           → list maintenance logs (filter: category, date range)
POST   /garage/bikes/:bike_id/maintenance           → log maintenance entry
GET    /garage/bikes/:bike_id/maintenance/:id       → maintenance detail
PATCH  /garage/bikes/:bike_id/maintenance/:id       → update entry
DELETE /garage/bikes/:bike_id/maintenance/:id       → delete entry
GET    /garage/bikes/:bike_id/maintenance/upcoming  → next-due items (by km or date)
```

**Garage — Tire Pressure:**
```
GET    /garage/bikes/:bike_id/tire-pressure         → list tire pressure readings (filter: context, date range)
POST   /garage/bikes/:bike_id/tire-pressure         → log pressure reading
GET    /garage/bikes/:bike_id/tire-pressure/:id     → reading detail
DELETE /garage/bikes/:bike_id/tire-pressure/:id     → delete reading
```

**Garage — Modifications:**
```
GET    /garage/bikes/:bike_id/mods                  → list modifications (filter: category, active/removed)
POST   /garage/bikes/:bike_id/mods                  → log modification
GET    /garage/bikes/:bike_id/mods/:id              → modification detail
PATCH  /garage/bikes/:bike_id/mods/:id              → update mod (e.g. set removed_at)
DELETE /garage/bikes/:bike_id/mods/:id              → delete mod record
```

**Garage — Ownership:**
```
GET    /garage/bikes/:bike_id/ownership             → ownership timeline
POST   /garage/bikes/:bike_id/ownership             → log ownership event
DELETE /garage/bikes/:bike_id/ownership/:id          → delete ownership event
```

**Garage — Tracks:**
```
GET    /garage/tracks        → list tracks
POST   /garage/tracks        → create track
GET    /garage/tracks/:id    → track detail
PATCH  /garage/tracks/:id    → update track
DELETE /garage/tracks/:id    → delete track
```

**Garage — Events:**
```
GET    /garage/events        → list events (filter: bike_id, track_id, date range)
POST   /garage/events        → create event (validates conditions JSONB)
GET    /garage/events/:id    → event detail
PATCH  /garage/events/:id    → update event
DELETE /garage/events/:id    → delete event
```

**Sessions:**
```
POST /sessions                       → create session
GET  /sessions                       → list (filter: event_id, date range)
GET  /sessions/:id                   → full session detail (includes snapshots + changes)
PATCH /sessions/:id                  → update session fields
POST /sessions/:id/snapshot          → append setup snapshot
POST /sessions/:id/changes           → log a setting change
GET  /sessions/:id/changes           → full change log for session
```

**Progress:**
```
GET /progress                        → lap time trend, best laps per track, total time found
GET /progress/efficacy               → suggestion adoption rate, avg delta by applied_status
GET /progress/sessions               → session history with time deltas
```

**Admin:**
```
GET    /admin/channel-aliases        → list all aliases
POST   /admin/channel-aliases        → add alias mapping
PATCH  /admin/channel-aliases/:id    → update alias
DELETE /admin/channel-aliases/:id    → remove alias
```

### Telemetry/Ingestion service (port 8002)

```
POST /ingest/csv             → multipart upload → { job_id } (async)
POST /ingest/ocr             → image upload → { job_id } (async)
POST /ingest/voice           → audio upload → { job_id } (async)
GET  /ingest/jobs/:id        → job status
GET  /ingest/jobs/:id/stream → SSE: completion event with parsed results
POST /ingest/jobs/:id/confirm → user confirms extracted data

POST /telemetry/upload                          → bulk insert channel data
GET  /telemetry/:session_id/channels            → available channels + ranges
GET  /telemetry/:session_id/lap/:n              → full channel data for lap n
GET  /telemetry/:session_id/lap/:n?hz=10        → downsampled
GET  /telemetry/:session_id/lap/:n?channels=gps_speed,fork_position → filtered
GET  /telemetry/:session_id/analysis            → computed metrics
```

### AI service (port 8003)

```
POST   /suggest                          → { session_id } → { job_id } (async)
GET    /suggest/:job_id/stream           → SSE: streams suggestion text
GET    /suggest/session/:session_id      → all suggestions for session
GET    /suggest/:suggestion_id           → suggestion detail with per-change tracking
PATCH  /suggest/:suggestion_id/changes/:change_id → update applied_status, actual_value
PATCH  /suggest/:suggestion_id/changes/:change_id/outcome → record lap delta
```

### Error envelope (all services)

```json
{
  "error": "Human readable message",
  "code": "MACHINE_READABLE_CODE",
  "request_id": "uuid from X-Request-ID header"
}
```

Standard codes: `VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `RATE_LIMITED`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`.

-----

## Agent delegation plan

### Phase 0 — Shared infrastructure (before launching agents)

**Duration:** 1–2 days

```bash
# 1. Init repo
git init dialed-app && cd dialed-app

# 2. Write contracts (JSON Schema + OpenAPI)
# 3. Write shared Python package (dialed_shared)
# 4. Write infrastructure (Docker Compose, Dockerfiles, nginx, CLAUDE.md files)
# 5. Create worktrees

git commit --allow-empty -m "init: contracts + shared infra"

git worktree add ../agent-core      -b feature/core-api
git worktree add ../agent-telemetry -b feature/telemetry-ingestion
git worktree add ../agent-ai        -b feature/ai
git worktree add ../agent-frontend  -b feature/frontend
```

### Phase 1 — Parallel service development (3–5 days)

| Agent | Worktree | Service | Estimated time | Dependencies |
|-------|----------|---------|----------------|--------------|
| 1 — Core API | agent-core | core-api/ | 6–9 hrs | Shared infra + contracts |
| 2 — Telemetry/Ingestion | agent-telemetry | telemetry-ingestion/ | 5–7 hrs | Shared infra + contracts |
| 3 — AI | agent-ai | ai/ | 5–7 hrs | Shared infra + contracts |
| 4 — Frontend | agent-frontend | frontend/ | 8–12 hrs | Contracts only (uses MSW mocks) |

Note: Core API and Frontend estimates increased due to garage expansion (maintenance, tire pressure, mods, ownership screens and endpoints).

### Phase 2 — Sequential merge and integration (2–3 days)

```
Day 1:  Merge Core API → main, run full stack, verify all CRUD endpoints
        (garage maintenance/tire/mods/ownership + sessions + progress)
Day 1:  Merge Telemetry/Ingestion → main, test CSV upload → SSE completion
Day 2:  Merge AI → main, test suggestion request → SSE streaming
Day 2:  Merge Frontend → main, test full user flows end-to-end
Day 3:  Fix integration issues, seed with real data
```

### Phase 3 — Team testing (1 week)

```
Day 1–2:  Share PWA URL with team, collect feedback
Day 3–5:  Prioritize and fix top issues
```

-----

## Infrastructure

### docker-compose.yml

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: devpassword
      POSTGRES_DB: dialed
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped

  timescale:
    image: timescale/timescaledb:latest-pg16
    environment:
      POSTGRES_PASSWORD: devpassword
      POSTGRES_DB: dialed_telemetry
    ports: ["5433:5432"]
    volumes: ["tsdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    ports: ["6379:6379"]
    volumes: ["redisdata:/data"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped

  gateway:
    build: ./services/gateway
    ports: ["8000:8000"]
    depends_on:
      core-api:
        condition: service_healthy
      telemetry-ingestion:
        condition: service_healthy
      ai:
        condition: service_healthy
    environment:
      CORE_API_URL: http://core-api:8001
      TELEMETRY_URL: http://telemetry-ingestion:8002
      AI_URL: http://ai:8003
      REDIS_URL: redis://redis:6379
      INTERNAL_SECRET: dev-internal-secret
    restart: unless-stopped
    mem_limit: 256m

  core-api:
    build: ./services/core-api
    ports: ["8001:8001"]
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:devpassword@postgres/dialed
      REDIS_URL: redis://redis:6379
      INTERNAL_SECRET: dev-internal-secret
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    restart: unless-stopped
    mem_limit: 512m

  telemetry-ingestion:
    build: ./services/telemetry-ingestion
    ports: ["8002:8002"]
    depends_on:
      postgres:
        condition: service_healthy
      timescale:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:devpassword@postgres/dialed
      TIMESCALE_URL: postgresql+asyncpg://postgres:devpassword@timescale/dialed_telemetry
      REDIS_URL: redis://redis:6379
      CORE_API_URL: http://core-api:8001
      INTERNAL_SECRET: dev-internal-secret
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8002/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    restart: unless-stopped
    mem_limit: 512m

  ai:
    build: ./services/ai
    ports: ["8003:8003"]
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:devpassword@postgres/dialed
      REDIS_URL: redis://redis:6379
      CORE_API_URL: http://core-api:8001
      TELEMETRY_URL: http://telemetry-ingestion:8002
      INTERNAL_SECRET: dev-internal-secret
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8003/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    restart: unless-stopped
    mem_limit: 1g

  frontend:
    build: ./frontend
    ports: ["5173:5173"]
    environment:
      VITE_GATEWAY_URL: http://localhost:8000
    restart: unless-stopped
    mem_limit: 256m

volumes:
  pgdata:
  tsdata:
  redisdata:
```

### Makefile

```makefile
dev:
	docker compose up

dev-build:
	docker compose up --build

migrate:
	./infra/scripts/migrate-all.sh

test-core:
	docker compose exec core-api pytest

test-telemetry:
	docker compose exec telemetry-ingestion pytest

test-ai:
	docker compose exec ai pytest

test-all:
	docker compose exec core-api pytest && \
	docker compose exec telemetry-ingestion pytest && \
	docker compose exec ai pytest

generate-types:
	./infra/scripts/generate-types.sh

seed:
	python infra/scripts/seed.py

clean:
	docker compose down -v
```

-----

## Cost breakdown

### Development (pre-release)

| Item                                   | Cost                    |
|----------------------------------------|-------------------------|
| Claude Pro (Claude Code)               | $20/mo                  |
| Supabase free tier                     | $0                      |
| Cloudflare Pages (frontend)            | $0                      |
| Cloudflare Tunnel (mini PC)            | $0                      |
| Redis (self-hosted on mini PC)         | $0                      |
| TimescaleDB (self-hosted on mini PC)   | $0                      |
| Claude API calls (AI suggestions, OCR) | ~$5–15/mo at team scale |
| OpenAI Whisper API (voice)             | ~$1–3/mo at team scale  |
| Electricity (mini PC)                  | ~$2/mo                  |
| **Total**                              | **~$28–40/mo**          |

### Upgrade path (when you go public)

| Item                                        | Cost             |
|---------------------------------------------|------------------|
| Claude Max (heavy dev usage)                | $100/mo          |
| Supabase Pro                                | $25/mo           |
| Fly.io (3 services + gateway)              | $30–60/mo        |
| TimescaleDB Cloud                           | $50/mo           |
| OpenAI Whisper API (scaled)                 | $5–10/mo         |
| Domain name                                 | ~$1/mo           |
| **Total**                                   | **~$211–246/mo** |

-----

## Open questions (remaining)

Product decisions that do not block implementation.

- [ ] **Multi-bike sessions** — can a single event have multiple bikes?
- [ ] **Team / paddock sharing** — should teammates view each other's sessions?
- [ ] **Suggestion approval workflow** — crew chief approve/reject before rider sees suggestions?
- [ ] **Historical setup import** — bulk-import past sessions from paper sheets or spreadsheets?
- [ ] **Push notifications** — notify rider when a suggestion is ready
- [ ] **Token budget for AI service** — truncation/summarisation strategy when sessions > 10
- [ ] **Data retention** — raw 20Hz telemetry retention policy (propose: 90 days raw, computed metrics forever)
- [ ] **Maintenance reminders** — should the app push notifications for upcoming maintenance based on next_due_km/next_due_date?
- [ ] **Garage-only onboarding** — should new users see a simplified UI that only shows Garage features until they create their first track event?

-----

## Out of scope for v1

Explicitly deferred to v2 or later.

- Live telemetry streaming (real-time data during a session via WebSocket)
- Native iOS/Android apps (Capacitor wrapper comes after PWA is stable)
- ML model trained on session outcomes (rules engine only for v1)
- Tyre compound temperature modelling
- Comparison between two riders on the same bike
- Public leaderboards or community features
- Multi-language support (English only for v1)
- Payment / subscription tiers (team uses it free)
- Marketplace / parts compatibility database
- Integration with OBD-II or ECU flash tools
- Social features (sharing setups, following riders)

**v1 consideration (decide during implementation):** Setup sheet PDF export — high demand, low complexity.

-----

*All architectural decisions are finalized. Write contracts, build the shared infra layer, then launch agents. Agent CLAUDE.md files in agents/ carry forward every decision made in this document.*
