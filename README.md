# Dialed

**A motorcycle management and tuning platform for every rider.**

Dialed helps you take care of your bike and get faster on track. Whether you're a street rider tracking oil changes or a competitive racer dialing in suspension between qualifying sessions, Dialed gives you the tools to stay on top of your machine.

-----

## What Dialed does

### For every rider — the Garage

Your bikes live in the Garage. Track maintenance schedules, log tire pressures, record every modification you make, and keep a full ownership timeline. Know when your next oil change is due, see your tire pressure trends over time, and have a complete history of every part you've installed or removed.

### For track riders — Sessions and Telemetry

Log your track sessions with setup snapshots, rider feedback, and change history. Upload AiM telemetry CSVs and Dialed parses the 20Hz data, detects lap boundaries, and stores everything for analysis. View braking zones, fork rebound patterns, and traction control events across laps.

### For competitive riders — AI Suggestions

Describe what the bike is doing and Dialed generates suspension change recommendations powered by a rules engine and Claude AI. Watch the suggestion stream in real-time as the AI reasons through your setup. Track which changes you apply, which you skip, and how each one affects your lap times. Over time, the system learns what works.

-----

## Architecture

Dialed uses a hybrid backend with three services, chosen to balance clean domain separation with operational simplicity.

```
         Clients (PWA)
              │
         API Gateway
         (auth, routing, rate limiting)
              │
    ┌─────────┼─────────┐
    │         │         │
 Core API  Telemetry   AI
 (port 8001) /Ingestion (port 8003)
    │      (port 8002)  │
    │         │         │
    └────┬────┘         │
         │              │
   Postgres          Postgres
  (core + ai       (TimescaleDB)
   schemas)
         │
       Redis
    (task queue)
```

**Core API** — users, bikes, maintenance, tracks, sessions, progress. The biggest service — handles all CRUD and the Garage feature set.

**Telemetry/Ingestion** — async data pipelines (CSV parsing, OCR, voice transcription) and 20Hz telemetry storage in TimescaleDB. Processes jobs from a Redis queue and notifies clients via Server-Sent Events.

**AI** — rules engine + Claude API for suspension suggestions. Streams suggestions to clients in real-time via SSE. Tracks per-change application status and outcome deltas for efficacy analysis.

### Key technical decisions

- **Single Postgres** with per-service schemas (`core`, `telemetry`, `ai`) — one backup, one connection pool, cross-schema foreign keys where needed
- **TimescaleDB** for 20Hz telemetry data — hypertable partitioning, continuous aggregates, native downsampling
- **Redis as task queue only** — not a full event bus. Two queues (`dialed:ingestion`, `dialed:ai`) for genuinely async work
- **SSE streaming** — ingestion job completion and AI suggestion generation stream results to the client in real-time
- **JSON Schema contracts** — single source of truth generating both Pydantic models (Python) and TypeScript types
- **Gateway + shared internal secret** — Supabase JWT validated at the gateway, internal token signed and forwarded to services

-----

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0 async, Alembic |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, Zustand |
| Databases | PostgreSQL 16, TimescaleDB |
| Task queue | Redis 7 (Lists, AOF persistence) |
| AI | Claude API (claude-sonnet-4-6), Anthropic SDK |
| OCR | Claude Vision |
| Voice | OpenAI Whisper API |
| PWA | vite-plugin-pwa, Workbox, IndexedDB offline queue |
| Contracts | JSON Schema → Pydantic + TypeScript generation |
| Testing | pytest, pytest-asyncio, MSW (Mock Service Worker) |
| Infrastructure | Docker Compose, Nginx, Cloudflare Pages + Tunnel |

-----

## Getting started

### Prerequisites

- Docker and Docker Compose
- Node.js 20+
- Python 3.12+
- An Anthropic API key (for AI suggestions)

### Run the full stack locally

```bash
# Clone the repo
git clone <repo-url> && cd dialed-app

# Set your API key
export ANTHROPIC_API_KEY=sk-ant-...

# Start all services
make dev-build

# Run database migrations
make migrate

# Seed with sample data (optional)
make seed
```

The app is available at:
- **Frontend:** http://localhost:5173
- **API Gateway:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

### Frontend development (no backend needed)

```bash
cd frontend
npm install
npm run dev
```

MSW intercepts all API calls with mock data generated from the OpenAPI specs.

-----

## Project structure

```
dialed-app/
├── contracts/              ← JSON Schema + OpenAPI specs (source of truth)
│   ├── json-schema/        ← data shapes
│   ├── openapi/            ← API contracts per service
│   └── generated/          ← auto-generated Pydantic + TS types
├── shared/                 ← shared Python package (auth, errors, logging)
├── services/
│   ├── gateway/            ← API gateway (auth, routing, rate limiting)
│   ├── core-api/           ← users, bikes, garage, sessions, progress
│   ├── telemetry-ingestion/← CSV/OCR/voice pipelines + TimescaleDB
│   └── ai/                 ← rules engine + Claude API suggestions
├── frontend/               ← React 19 PWA
├── agents/                 ← per-agent CLAUDE.md context files
├── infra/                  ← Docker Compose, Nginx, scripts
├── CLAUDE.md               ← master agent context
├── Makefile
└── README.md
```

-----

## Implementation stages

### Stage 0 — Contracts and shared infrastructure (Days 1–2)

Establish the foundation that all parallel work builds on.

| Deliverable | Description |
|-------------|-------------|
| JSON Schema contracts | All data shapes: auth, garage (bikes, maintenance, tire pressure, mods, ownership), sessions, telemetry, AI, progress, conditions, suspension_spec, task payloads |
| OpenAPI specs | `core-api.yaml`, `telemetry-ingestion.yaml`, `ai.yaml` — every endpoint, field, status code, error shape |
| Generated types | Run `make generate-types` to produce Pydantic models and TypeScript types from JSON Schema |
| Shared Python package | `dialed_shared/` — internal token auth, error envelope, logging formatter, healthcheck endpoint, Redis task queue helpers, common middleware |
| Docker Compose | Full local stack with healthchecks, `depends_on` conditions, restart policies, memory limits, persistent volumes for Postgres, TimescaleDB, and Redis |
| Dockerfile template | Standard multi-stage build used by all three services |
| Nginx config | Gateway reverse proxy configuration |
| CLAUDE.md files | Master context + four agent-specific files |
| Git worktrees | One branch per agent: `feature/core-api`, `feature/telemetry-ingestion`, `feature/ai`, `feature/frontend` |

**Exit criteria:** `docker compose up` starts all infrastructure containers (Postgres, TimescaleDB, Redis) healthy. Generated types compile without errors. All contracts pass linting.

### Stage 1 — Parallel service development (Days 3–7)

Four agents build simultaneously, each in their own worktree.

| Agent | Service | Key deliverables | Est. time |
|-------|---------|-------------------|-----------|
| Core API | `services/core-api/` | Auth flow, full Garage CRUD (bikes + maintenance + tire pressure + mods + ownership), tracks, events, sessions, setup snapshots, change log, progress endpoints, admin channel aliases, Alembic migrations for `core` schema | 6–9 hrs |
| Telemetry/Ingestion | `services/telemetry-ingestion/` | CSV parser with channel aliasing, OCR pipeline (Claude Vision), voice pipeline (Whisper), Redis queue consumer, SSE completion endpoint, TimescaleDB hypertable setup, lap segment detection, downsampling, analysis endpoints, Alembic migrations for `telemetry` schema | 5–7 hrs |
| AI | `services/ai/` | Rules engine (suspension tree, geometry correlator, telemetry patterns), prompt builder, Claude API streaming, SSE streaming endpoint, suggestion + change storage, context gatherer (HTTP calls to Core API), token budget management, Alembic migrations for `ai` schema | 5–7 hrs |
| Frontend | `frontend/` | All screens (Garage, BikeDetail, MaintenanceLog, SessionLogger, SessionDetail, Progress, Admin, Settings), TanStack Query hooks, SSE integration (ingestion + AI streaming), offline mutation queue with IndexedDB, PWA config (manifest, service worker, Workbox), MSW mock handlers, responsive mobile-first design | 8–12 hrs |

**Exit criteria:** Each service passes its own test suite. Each service starts in Docker and responds to `/health`. Frontend renders all screens with MSW mocks.

### Stage 2 — Integration and merge (Days 8–10)

Sequential merge with testing between each branch.

| Day | Merge | Verification |
|-----|-------|-------------|
| Day 8 | Core API → main | Full stack up. Verify: user registration, bike CRUD, maintenance CRUD, tire pressure logging, modification tracking, session creation, setup snapshots. Run `make test-core`. |
| Day 8 | Telemetry/Ingestion → main | Verify: CSV upload triggers Redis job → worker processes → SSE fires completion event. Verify: telemetry data queryable, downsampling works, analysis endpoint returns metrics. Run `make test-telemetry`. |
| Day 9 | AI → main | Verify: suggestion request triggers Redis job → worker gathers context from Core API → rules engine runs → Claude streams via SSE → suggestion + changes stored. Run `make test-ai`. |
| Day 9 | Frontend → main | Verify: full user flow end-to-end. Create bike → log maintenance → create event → create session → upload CSV → request suggestion → apply changes. Offline queue test. |
| Day 10 | Integration fixes | Fix cross-service issues discovered during merge. Run `make test-all`. |

**Exit criteria:** Full stack runs via `docker compose up`. A user can complete the entire flow from registration through suggestion application. All three service test suites pass.

### Stage 3 — Real data and team testing (Days 11–17)

| Day | Activity |
|-----|----------|
| Day 11 | Seed the database with real data — bikes from the team, actual AiM CSV files from CRA 2026, real setup sheets |
| Day 12 | Deploy to mini PC via Cloudflare Tunnel. Share PWA URL with the team. |
| Days 13–14 | Team uses the app at a track day or during prep. Collect feedback on Garage workflows, session logging UX, suggestion quality. |
| Days 15–17 | Prioritize and fix top issues from feedback. Polish mobile UX. Address any data quality issues (channel aliasing gaps, OCR accuracy, etc.). |

**Exit criteria:** Team has used the app with real data. Top 5 issues from feedback are resolved. PWA installs and works offline on iOS and Android.

-----

## Development commands

```bash
make dev              # Start all services
make dev-build        # Rebuild and start
make migrate          # Run all Alembic migrations
make test-all         # Run all service test suites
make test-core        # Run Core API tests only
make test-telemetry   # Run Telemetry/Ingestion tests only
make test-ai          # Run AI tests only
make generate-types   # Regenerate Pydantic + TS types from JSON Schema
make seed             # Seed database with sample data
make clean            # Stop everything and remove volumes
```

-----

## Agent development

This repo is built using parallel agent development with Claude Code. Each agent gets:

1. **Master context** — `CLAUDE.md` in the repo root (architecture, conventions, shared package)
2. **Service-specific context** — `agents/CLAUDE-[service].md` (your tables, your endpoints, your testing priorities)
3. **Contracts** — `contracts/openapi/[service].yaml` + `contracts/json-schema/*.schema.json` (the law)
4. **Shared package** — `shared/dialed_shared/` (auth, errors, logging — use it, don't reimplement it)

Agents work in git worktrees and merge sequentially during Stage 2.

-----

## License

Private. Not open source.
