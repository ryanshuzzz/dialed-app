# Infrastructure Reference

> **Location:** `infra/`
> **Run from repo root:** `docker compose up` (uses root `docker-compose.yml` which includes `infra/docker-compose.yml`)
> **Dev mode with reload:** `docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up`

---

## Table of contents

1. [File layout](#file-layout)
2. [Service matrix](#service-matrix)
3. [Docker Compose configuration](#docker-compose-configuration)
4. [Nginx gateway routing](#nginx-gateway-routing)
5. [Dockerfile pattern](#dockerfile-pattern)
6. [Dev overrides](#dev-overrides)
7. [Design decisions](#design-decisions)

---

## File layout

```
dialed-app/
  docker-compose.yml                    # Root convenience wrapper (include: infra/docker-compose.yml)
  .dockerignore                         # Excludes .git, __pycache__, node_modules, .env, generated/
  infra/
    docker-compose.yml                  # Canonical compose config — all 8 services
    docker-compose.dev.yml              # Dev override — volume mounts, --reload, no .pyc
    Dockerfile.template                 # Reference multi-stage Dockerfile pattern
    nginx/
      nginx.conf                        # Reverse proxy routing, CORS, SSE config
    scripts/
      generate-types.sh                 # JSON Schema → Pydantic + TypeScript codegen
      requirements-codegen.txt          # Pinned codegen dependencies
  services/
    gateway/Dockerfile                  # Port 8000
    core-api/Dockerfile                 # Port 8001
    telemetry-ingestion/Dockerfile      # Port 8002
    ai/Dockerfile                       # Port 8003
```

---

## Service matrix

| Service | Image / Build | Port | Depends on (healthy) | Mem limit | Healthcheck | Volumes |
|---------|--------------|------|---------------------|-----------|-------------|---------|
| **postgres** | `postgres:16` | 5432 | — | 512m | `pg_isready -U postgres` (5s interval) | `pgdata:/var/lib/postgresql/data` |
| **timescale** | `timescale/timescaledb:latest-pg16` | 5433 | — | 512m | `pg_isready -U postgres` (5s interval) | `tsdata:/var/lib/postgresql/data` |
| **redis** | `redis:7-alpine` | 6379 | — | 128m | `redis-cli ping` (5s interval) | `redisdata:/data` |
| **gateway** | `services/gateway/Dockerfile` | 8000 | core-api, telemetry-ingestion, ai | 256m | `curl -f http://localhost:8000/health` (10s) | — |
| **core-api** | `services/core-api/Dockerfile` | 8001 | postgres, redis | 512m | `curl -f http://localhost:8001/health` (10s) | — |
| **telemetry-ingestion** | `services/telemetry-ingestion/Dockerfile` | 8002 | postgres, timescale, redis | 512m | `curl -f http://localhost:8002/health` (10s) | — |
| **ai** | `services/ai/Dockerfile` | 8003 | postgres, redis | 1g | `curl -f http://localhost:8003/health` (10s) | — |
| **frontend** | `frontend/` | 5173 | gateway | 256m | `curl -f http://localhost:5173/` (10s) | — |

All services use `restart: unless-stopped`.

### Environment variables

| Service | Variables |
|---------|-----------|
| **postgres** | `POSTGRES_PASSWORD=devpassword`, `POSTGRES_DB=dialed` |
| **timescale** | `POSTGRES_PASSWORD=devpassword`, `POSTGRES_DB=dialed_telemetry` |
| **redis** | `--appendonly yes` (AOF persistence) |
| **gateway** | `CORE_API_URL`, `TELEMETRY_URL`, `AI_URL`, `REDIS_URL`, `INTERNAL_SECRET` |
| **core-api** | `DATABASE_URL`, `REDIS_URL`, `INTERNAL_SECRET` |
| **telemetry-ingestion** | `DATABASE_URL`, `TIMESCALE_URL`, `REDIS_URL`, `CORE_API_URL`, `INTERNAL_SECRET` |
| **ai** | `DATABASE_URL`, `REDIS_URL`, `CORE_API_URL`, `TELEMETRY_URL`, `INTERNAL_SECRET`, `ANTHROPIC_API_KEY` |
| **frontend** | `VITE_GATEWAY_URL=http://localhost:8000` |

---

## Docker Compose configuration

### Root `docker-compose.yml`

A one-line convenience file that uses Compose's `include:` directive:

```yaml
include:
  - infra/docker-compose.yml
```

This means `docker compose up` from the repo root works without `-f` flags. The canonical configuration lives in `infra/docker-compose.yml`.

### Path resolution

Since `infra/docker-compose.yml` lives inside `infra/`, all relative paths resolve from there:

- Build contexts use `context: ..` (parent = repo root) so Dockerfiles can `COPY shared/` and `COPY services/<name>/`
- Dev override volume mounts use `../services/...` and `../shared/` for the same reason
- Frontend build context uses `../frontend`

---

## Nginx gateway routing

The nginx config at `infra/nginx/nginx.conf` listens on port 8000 and routes all `/api/v1/*` traffic to the appropriate backend service.

### Route table

| Path prefix | Upstream | Notes |
|-------------|----------|-------|
| `/api/v1/auth/*` | `core-api:8001` | Strips `/api/v1` prefix |
| `/api/v1/garage/*` | `core-api:8001` | Bikes, maintenance, tires, mods, ownership, tracks, events |
| `/api/v1/sessions/*` | `core-api:8001` | Sessions, snapshots, change log |
| `/api/v1/progress/*` | `core-api:8001` | Lap trends, efficacy, session history |
| `/api/v1/admin/*` | `core-api:8001` | Channel alias management |
| `/api/v1/ingest/*` | `telemetry-ingestion:8002` | CSV/OCR/voice upload, job status. `client_max_body_size 100m` |
| `/api/v1/telemetry/*` | `telemetry-ingestion:8002` | Channel data, lap data, analysis |
| `/api/v1/suggest/*` | `ai:8003` | Suggestion CRUD, change tracking |
| `/health` | `core-api:8001` | Proxied to core-api's `/health` endpoint |
| `/docs` | `core-api:8001` | OpenAPI UI |
| `/*` (fallback) | — | Returns 404 JSON error envelope |

### SSE endpoints

Two routes get special SSE-friendly configuration:

| Pattern | Upstream | Config |
|---------|----------|--------|
| `/api/v1/ingest/jobs/{id}/stream` | `telemetry-ingestion:8002` | `proxy_buffering off`, `chunked_transfer_encoding on`, 300s timeout |
| `/api/v1/suggest/{id}/stream` | `ai:8003` | `proxy_buffering off`, `chunked_transfer_encoding on`, 300s timeout |

Both SSE locations also set `proxy_http_version 1.1` and clear the `Connection` header to prevent premature connection closure.

### Proxy headers

Set on all proxied requests:

| Header | Value |
|--------|-------|
| `Host` | `$host` |
| `X-Real-IP` | `$remote_addr` |
| `X-Forwarded-For` | `$proxy_add_x_forwarded_for` |
| `X-Forwarded-Proto` | `$scheme` |
| `X-Request-ID` | `$http_x_request_id` (passed through from client) |

### CORS

CORS headers are set for all responses. Allowed origins are `localhost` and `127.0.0.1` on any port (matching the frontend dev server).

| Header | Value |
|--------|-------|
| `Access-Control-Allow-Origin` | Matched origin from `localhost:*` or `127.0.0.1:*` |
| `Access-Control-Allow-Methods` | `GET, POST, PUT, PATCH, DELETE, OPTIONS` |
| `Access-Control-Allow-Headers` | `Authorization, Content-Type, X-Request-ID, X-Internal-Token` |
| `Access-Control-Expose-Headers` | `X-Request-ID` |
| `Access-Control-Max-Age` | `86400` (1 day) |

Preflight `OPTIONS` requests return `204` with CORS headers and an empty body.

---

## Dockerfile pattern

All four backend services use the same two-stage Dockerfile pattern (documented in `infra/Dockerfile.template`):

### Stage 1 — Builder

```
FROM python:3.12-slim
├── apt-get install gcc, libpq-dev (build-time deps)
├── python -m venv /opt/venv
├── COPY shared/ → pip install (changes least often → best layer caching)
├── COPY requirements.txt → pip install
└── COPY service source code
```

### Stage 2 — Runtime

```
FROM python:3.12-slim
├── apt-get install libpq5, curl (runtime deps only)
├── COPY --from=builder /opt/venv (all installed packages)
├── COPY --from=builder service source code
├── useradd dialed (non-root)
├── EXPOSE $PORT
└── CMD uvicorn main:app --host 0.0.0.0 --port $PORT
```

### Build context

All Dockerfiles expect the **repo root** as the build context so they can `COPY shared/` and `COPY services/<name>/`. In `docker-compose.yml`, this is achieved with `context: ..` (since compose lives in `infra/`).

---

## Dev overrides

`infra/docker-compose.dev.yml` adds development-friendly configuration on top of the base compose file:

| Override | Purpose |
|----------|---------|
| **Volume mounts** | Service source code and `shared/` package mounted into containers — changes are reflected immediately |
| **`PYTHONDONTWRITEBYTECODE=1`** | Prevents `.pyc` files from being written into mounted host volumes |
| **`PYTHONPATH=/shared`** | Ensures the mounted shared package is importable |
| **`uvicorn --reload`** | Auto-restarts the server when Python files change |
| **Frontend volumes** | Mounts `frontend/` with anonymous volume for `node_modules` (prevents host/container mismatch) |

### Usage

```bash
# Production-like (built images, no reload)
docker compose up

# Dev mode (live reload, mounted source)
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up
```

---

## Design decisions

### 1. Single compose file with `include:` at root

The canonical `docker-compose.yml` lives in `infra/` to keep infrastructure config organized. A one-line root `docker-compose.yml` uses Compose's `include:` directive so that `docker compose up` works from the repo root without `-f` flags.

**Why not a symlink:** `include:` is a first-class Compose feature, more portable, and clearly documents the relationship.

### 2. Build context is always the repo root

Every service Dockerfile needs access to `shared/` for the `dialed_shared` package. Setting `context: ..` in compose (relative to `infra/`) makes the entire repo available as the build context. The `.dockerignore` at the repo root prevents `.git`, `node_modules`, and other large directories from being sent to the Docker daemon.

### 3. Healthcheck strategy

- **Datastores** (postgres, timescale, redis): Use native CLI tools (`pg_isready`, `redis-cli ping`) with 5s intervals and 5 retries. These start fast.
- **Backend services**: Use `curl -f http://localhost:$PORT/health` with 10s intervals and 3 retries. The longer interval accounts for Python/uvicorn startup time.
- **Frontend**: Uses `curl -f http://localhost:5173/` — Vite's dev server responds immediately when ready.

All `depends_on` relationships use `condition: service_healthy` so services don't start until their dependencies are actually ready, not just running.

### 4. Memory limits

Set per the plan to prevent any single service from consuming all available RAM on the mini PC:

| Service | Limit | Rationale |
|---------|-------|-----------|
| postgres, timescale | 512m | Moderate — shared_buffers tuning happens at the Postgres level |
| redis | 128m | Task queue only — no caching, tiny payloads |
| gateway | 256m | Stateless proxy — minimal memory footprint |
| core-api, telemetry | 512m | CRUD workloads with SQLAlchemy connection pools |
| ai | 1g | Claude API streaming + rules engine may hold larger payloads in memory |
| frontend | 256m | Vite dev server or static file serving |

### 5. SSE requires proxy_buffering off

Nginx buffers proxied responses by default, which breaks Server-Sent Events (the client won't receive events until the buffer fills or the connection closes). The SSE endpoint locations explicitly set `proxy_buffering off` and `chunked_transfer_encoding on`, with a 300s read timeout to keep long-lived connections alive.

### 6. CORS at the nginx layer

CORS headers are set in nginx rather than in each FastAPI service. This keeps CORS config centralized and means services don't need to handle OPTIONS preflight requests at all. The allowed origin is dynamically matched against `localhost:*` and `127.0.0.1:*` — in production this would be replaced with the actual domain.

### 7. Redis AOF persistence

Redis runs with `--appendonly yes` for crash recovery of the task queue. If Redis restarts, pending jobs in the `dialed:ingestion` and `dialed:ai` lists survive. The `redisdata` named volume persists the AOF file across container restarts.
