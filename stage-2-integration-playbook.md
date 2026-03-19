# Dialed App — Stage 2 Integration Playbook

> **Purpose:** Step-by-step prompts for Claude Code to merge all four feature branches, boot the full stack, and debug until everything works end-to-end.
> **Prerequisites:** Stage 0 and Stage 1 are complete. All four feature branches exist. Infrastructure containers (Postgres, TimescaleDB, Redis) can boot.
> **Agent setup:** All seven subagents are in `.claude/agents/`. Set `export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` before starting Claude Code.

### Progress Tracker
| Step | Status | Notes |
|------|--------|-------|
| Step 0 — Pre-merge infra validation | **DONE** | Postgres, TimescaleDB, Redis healthy. Schemas created. All 4 branches present. |
| Step 1 — Merge Core API | **DONE** | 110/110 tests pass. 16 tables created. /health 200. Fixes: email-validator dep, alembic sys.path, test deps in Dockerfile. |
| Step 2 — Merge Telemetry/Ingestion | **DONE** | 95/95 tests pass. Tables: ingestion_jobs, lap_segments (Postgres) + telemetry_points hypertable (TimescaleDB). Inter-service to core-api OK. Fixes: python-multipart dep, dual-DB migration split, enum creation fix. |
| Step 3 — Merge AI | **DONE** | 121/121 tests pass (all Claude API mocked). Tables: suggestions, suggestion_changes, generation_jobs. Inter-service to core-api + telemetry OK. Redis OK. Fixes: alembic sys.path, respx dep, test deps in Dockerfile. |
| Step 4 — Merge Frontend + Gateway | **DONE** | All 8 containers healthy. Gateway proxying correctly (401s not 502s). Frontend serving on :5173. Fixes: implemented gateway proxy, npm --legacy-peer-deps for vite-plugin-pwa compat. |
| Step 5 — End-to-end user flow | Not started | |
| Step 6 — Final tests + tag | Not started | |

-----

## Before you begin

```bash
# Terminal setup — run these yourself before opening Claude Code
cd dialed-app
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
export ANTHROPIC_API_KEY=sk-ant-...  # needed for AI service in production, tests mock it

# Verify branches exist
git branch -a | grep feature/

# You should see:
#   feature/core-api
#   feature/telemetry-ingestion
#   feature/ai
#   feature/frontend

# Open Claude Code
claude
```

-----

## Step 0 — Pre-merge infrastructure validation

**Goal:** Verify infrastructure boots cleanly before any application code is merged.

### Prompt

```
Read CLAUDE.md and docs/dialed-app-v1-final-plan.md for full project context.

Before we start merging feature branches, let's verify the infrastructure is ready.

1. Start only the infrastructure containers:
   docker compose up -d postgres timescale redis

2. Wait for all three to report healthy:
   docker compose ps
   (retry up to 30 seconds if any show "starting")

3. Create the three application schemas in Postgres:
   docker compose exec postgres psql -U postgres -d dialed -c "CREATE SCHEMA IF NOT EXISTS core; CREATE SCHEMA IF NOT EXISTS telemetry; CREATE SCHEMA IF NOT EXISTS ai;"

4. Enable TimescaleDB extension and create the telemetry schema:
   docker compose exec timescale psql -U postgres -d dialed_telemetry -c "CREATE EXTENSION IF NOT EXISTS timescaledb; CREATE SCHEMA IF NOT EXISTS telemetry;"

5. Verify Redis is reachable:
   docker compose exec redis redis-cli ping

6. List available feature branches:
   git branch -a

Report the status of each check. If anything fails, use @agent-infra-fixer to diagnose and fix before proceeding. Do not move to Step 1 until all five checks pass.
```

### Expected outcome
- Postgres healthy with schemas `core`, `telemetry`, `ai`
- TimescaleDB healthy with extension enabled and `telemetry` schema
- Redis responding to PING
- All four feature branches listed

-----

## Step 1 — Merge Core API

**Goal:** Merge `feature/core-api` into main. Core API boots, responds to /health, passes all tests.

### Prompt

```
Use @agent-integration-lead to orchestrate this step.

MERGE CORE API INTO MAIN.

1. Merge the branch:
   git merge feature/core-api --no-edit

2. If there are merge conflicts:
   - For files in services/core-api/: keep the feature branch version
   - For files in shared/, infra/, contracts/: keep main (Stage 0) version
   - After resolving: git add -A && git commit --no-edit

3. Rebuild and start core-api with its dependencies:
   docker compose up --build -d postgres redis core-api

4. Wait for core-api to be healthy (docker compose ps).
   If it fails to start, read the logs:
   docker compose logs core-api --tail 50
   
   Delegate fixes:
   - Python import errors, missing modules, FastAPI startup errors → @agent-core-api
   - Dockerfile build failures, missing system packages → @agent-infra-fixer
   - Shared package issues → @agent-core-api (they can edit shared/)
   
   After each fix, rebuild: docker compose up --build -d core-api
   Repeat until healthy.

5. Run Alembic migrations for the core schema:
   docker compose exec core-api alembic upgrade head
   
   If migrations fail:
   - Schema already exists errors → ignore (we created schemas in Step 0)
   - Column/table errors → @agent-core-api to fix the migration
   - Connection errors → @agent-infra-fixer

6. Verify tables were created:
   docker compose exec postgres psql -U postgres -d dialed -c "\dt core.*"
   
   Expected: users, auth_tokens, bikes, maintenance_logs, tire_pressure_logs, modifications, ownership_history, tracks, events, sessions, setup_snapshots, change_log, efficacy_stats, channel_aliases, user_api_keys

7. Run the Core API test suite:
   docker compose exec core-api pytest -v --tb=short
   
   If tests fail:
   - Assertion errors where test expectations are wrong → @agent-test-fixer
   - Code bugs where endpoints return wrong data → @agent-core-api
   - Database/fixture issues → @agent-test-fixer
   
   Iterate until all tests pass.

8. Smoke test the API:
   curl -f http://localhost:8001/health
   curl -s http://localhost:8001/auth/me | head -20
   (expect 401 unauthorized — that's correct, it means the endpoint exists and auth is enforced)

9. Commit the integrated state:
   git add -A && git commit -m "stage 2: core-api merged and passing" --allow-empty

REPORT when complete:
- Number of merge conflicts resolved
- Number of tests passing / failing / skipped
- List of tables created in core schema
- Health endpoint response
- Any issues that required fixes and what was changed
```

### Expected outcome
- Core API container healthy
- All `core.*` tables created
- Test suite passing
- `/health` returns 200

-----

## Step 2 — Merge Telemetry/Ingestion

**Goal:** Merge `feature/telemetry-ingestion` into main. Service boots, connects to both databases, passes tests.

### Prompt

```
Use @agent-integration-lead to orchestrate this step.

MERGE TELEMETRY/INGESTION INTO MAIN.

1. Merge the branch:
   git merge feature/telemetry-ingestion --no-edit

2. Resolve conflicts (same strategy: feature branch for service code, main for shared infra).

3. Rebuild and start telemetry-ingestion:
   docker compose up --build -d timescale telemetry-ingestion

4. Wait for healthy status. If it fails, read logs:
   docker compose logs telemetry-ingestion --tail 50
   
   Common issues and delegation:
   - TimescaleDB connection refused or wrong URL → @agent-infra-fixer
   - Import errors, missing Python packages → @agent-telemetry-ingestion
   - Shared package version mismatch → @agent-telemetry-ingestion
   - Dual database config issues (DATABASE_URL vs TIMESCALE_URL) → @agent-infra-fixer
   
   Rebuild after each fix until healthy.

5. Run Alembic migrations for the telemetry schema:
   docker compose exec telemetry-ingestion alembic upgrade head

6. Verify telemetry tables and hypertable:
   docker compose exec postgres psql -U postgres -d dialed -c "\dt telemetry.*"
   docker compose exec timescale psql -U postgres -d dialed_telemetry -c "\dt telemetry.*"
   docker compose exec timescale psql -U postgres -d dialed_telemetry -c "SELECT hypertable_name FROM timescaledb_information.hypertables;"
   
   Expected: ingestion_jobs and lap_segments in Postgres, telemetry_points hypertable in TimescaleDB.
   
   If the hypertable wasn't created → @agent-telemetry-ingestion to fix the migration.

7. Run the test suite:
   docker compose exec telemetry-ingestion pytest -v --tb=short
   
   Delegate failures to @agent-test-fixer (test issues) or @agent-telemetry-ingestion (code bugs).

8. Verify inter-service connectivity (telemetry-ingestion must be able to call core-api):
   docker compose exec telemetry-ingestion curl -f http://core-api:8001/health
   
   If this fails → @agent-infra-fixer (Docker networking issue).

9. Smoke test:
   curl -f http://localhost:8002/health

10. Commit:
    git add -A && git commit -m "stage 2: telemetry-ingestion merged and passing" --allow-empty

REPORT when complete:
- Merge conflicts resolved
- Tests passing / failing / skipped
- Tables created (Postgres + TimescaleDB)
- Hypertable confirmation
- Inter-service connectivity to core-api: working / not working
- Any fixes applied
```

### Expected outcome
- Telemetry/Ingestion container healthy
- `telemetry.*` tables in both databases
- Hypertable created for `telemetry_points`
- Can reach core-api over Docker network
- Tests passing

-----

## Step 3 — Merge AI

**Goal:** Merge `feature/ai` into main. Service boots, connects to Postgres, passes tests (with mocked Claude API).

### Prompt

```
Use @agent-integration-lead to orchestrate this step.

MERGE AI SERVICE INTO MAIN.

1. Merge the branch:
   git merge feature/ai --no-edit

2. Resolve conflicts.

3. Rebuild and start the AI service:
   docker compose up --build -d ai

4. Wait for healthy status. If it fails, read logs:
   docker compose logs ai --tail 50
   
   Common issues and delegation:
   - ANTHROPIC_API_KEY not passed through → @agent-infra-fixer (check docker-compose.yml env passthrough: ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY})
   - Import errors, missing anthropic SDK → @agent-ai-service
   - Redis connection issues → @agent-infra-fixer
   - ai schema doesn't exist → should have been created in Step 0, verify with: docker compose exec postgres psql -U postgres -d dialed -c "\dn"
   
   Rebuild after each fix until healthy.

5. Run Alembic migrations for the ai schema:
   docker compose exec ai alembic upgrade head

6. Verify AI tables:
   docker compose exec postgres psql -U postgres -d dialed -c "\dt ai.*"
   
   Expected: suggestions, suggestion_changes, generation_jobs

7. Run the AI test suite:
   docker compose exec ai pytest -v --tb=short
   
   IMPORTANT: All tests should mock the Claude API and Whisper API. If any test tries to make real API calls, that's a test bug → @agent-test-fixer.
   
   For code bugs → @agent-ai-service.

8. Verify inter-service connectivity:
   docker compose exec ai curl -f http://core-api:8001/health
   docker compose exec ai curl -f http://telemetry-ingestion:8002/health
   
   Both must succeed. If either fails → @agent-infra-fixer.

9. Verify the Redis queue is accessible:
   docker compose exec ai python -c "import redis; r = redis.from_url('redis://redis:6379'); print(r.ping())"
   
   If this fails → @agent-infra-fixer.

10. Smoke test:
    curl -f http://localhost:8003/health

11. Commit:
    git add -A && git commit -m "stage 2: ai service merged and passing" --allow-empty

REPORT when complete:
- Merge conflicts resolved
- Tests passing / failing / skipped (note: how many tests mock Claude API vs skip it)
- Tables created in ai schema
- Inter-service connectivity: core-api and telemetry-ingestion reachable
- Redis connectivity confirmed
- Any fixes applied
```

### Expected outcome
- AI container healthy
- `ai.*` tables created
- Tests passing (all Claude/Whisper API calls mocked)
- Can reach both core-api and telemetry-ingestion
- Redis accessible

-----

## Step 4 — Merge Frontend and start gateway

**Goal:** Merge `feature/frontend` into main. Gateway routes correctly. Frontend builds and serves.

### Prompt

```
Use @agent-integration-lead to orchestrate this step.

MERGE FRONTEND AND START GATEWAY.

Part A — Gateway:

1. Build and start the gateway:
   docker compose up --build -d gateway

2. Verify the gateway can reach all three backends:
   curl -f http://localhost:8000/health

3. Test gateway routing — each should proxy to the correct backend (we expect auth errors or 404s, NOT 502):
   
   Core API routes:
   curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/auth/me
   (expect 401, not 502)
   
   curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/garage/bikes
   (expect 401, not 502)
   
   Telemetry routes:
   curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/ingest/jobs/fake-id
   (expect 401 or 404, not 502)
   
   AI routes:
   curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/suggest/fake-id
   (expect 401 or 404, not 502)
   
   If ANY route returns 502 Bad Gateway → @agent-infra-fixer (Nginx config is routing to wrong upstream or upstream is unreachable).
   If routes return 404 when they should exist → @agent-infra-fixer (Nginx location blocks are wrong).

Part B — Frontend:

4. Merge the branch:
   git merge feature/frontend --no-edit

5. Resolve conflicts.

6. Build and start the frontend:
   docker compose up --build -d frontend

7. If the frontend container fails to start:
   docker compose logs frontend --tail 50
   
   - npm install failures → @agent-frontend
   - TypeScript compilation errors → @agent-frontend
   - Vite build errors → @agent-frontend
   - Dockerfile issues → @agent-infra-fixer

8. Verify the frontend serves:
   curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
   (expect 200)

9. Check that all containers are running:
   docker compose ps
   
   All 8 containers should show healthy or running:
   postgres, timescale, redis, gateway, core-api, telemetry-ingestion, ai, frontend

10. Commit:
    git add -A && git commit -m "stage 2: frontend merged, gateway routing verified" --allow-empty

REPORT when complete:
- Gateway health status
- Routing test results (status code for each route tested)
- Frontend build status (success / fail)
- Frontend serving on localhost:5173 (yes / no)
- All 8 containers status
- Any fixes applied
```

### Expected outcome
- All 8 containers running
- Gateway health returns 200
- All proxy routes return non-502 responses
- Frontend serves on localhost:5173

-----

## Step 5 — End-to-end user flow verification

**Goal:** Walk through the complete user journey via API calls through the gateway. Every step must succeed.

### Prompt

```
Use @agent-integration-lead to orchestrate this step.

FULL END-TO-END VERIFICATION.

All services should be running. Verify first:
docker compose ps

Now test the complete user flow through the gateway. Execute each step, capture the response, and use the returned IDs in subsequent steps.

--- 1. REGISTER A USER ---

curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "rider@dialed.test", "password": "trackday2026"}'

Expected: 201 with { user_id, token, refresh_token }
Save the TOKEN for all subsequent requests.
If 500 → @agent-core-api (auth_service bug)
If 502 → @agent-infra-fixer (gateway routing)

--- 2. GET PROFILE ---

curl -X GET http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer TOKEN"

Expected: 200 with { user_id, email, display_name, skill_level, rider_type, units }
If 401 → @agent-core-api (token verification issue)

--- 3. CREATE A BIKE ---

curl -X POST http://localhost:8000/api/v1/garage/bikes \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "make": "Yamaha",
    "model": "YZF-R6",
    "year": 2023,
    "mileage_km": 15000,
    "status": "owned",
    "suspension_spec": {
      "schema_version": 1,
      "front": {"compression": 12, "rebound": 10, "preload": 5.0},
      "rear": {"compression": 8, "rebound": 7, "preload": 4.0}
    }
  }'

Expected: 201 with bike object including id
Save BIKE_ID.
If 422 → @agent-core-api (suspension_spec validation too strict or schema mismatch)
If 500 → @agent-core-api (model/service bug)

--- 4. LOG MAINTENANCE ---

curl -X POST http://localhost:8000/api/v1/garage/bikes/BIKE_ID/maintenance \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "oil_change",
    "description": "Yamalube 10W-40 full synthetic",
    "performed_at": "2026-03-15",
    "mileage_km": 15000,
    "cost": 45.00,
    "performed_by": "self",
    "next_due_km": 20000,
    "next_due_date": "2026-09-15"
  }'

Expected: 201 with maintenance log entry
If 500 → @agent-core-api

--- 5. LOG TIRE PRESSURE ---

curl -X POST http://localhost:8000/api/v1/garage/bikes/BIKE_ID/tire-pressure \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "front_psi": 33.0,
    "rear_psi": 30.0,
    "context": "pre_ride"
  }'

Expected: 201
If 422 → @agent-core-api (context enum mismatch)

--- 6. LOG A MODIFICATION ---

curl -X POST http://localhost:8000/api/v1/garage/bikes/BIKE_ID/mods \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "installed",
    "category": "suspension",
    "part_name": "Ohlins TTX GP rear shock",
    "brand": "Ohlins",
    "cost": 2800.00,
    "installed_at": "2026-02-01"
  }'

Expected: 201

--- 7. GET BIKE DETAIL WITH SUMMARY ---

curl -X GET http://localhost:8000/api/v1/garage/bikes/BIKE_ID \
  -H "Authorization: Bearer TOKEN"

Expected: 200 with bike object that includes computed summary:
  total_maintenance >= 1, last_maintenance_date, active_mods_count >= 1, tire_pressure_last_checked
If summary fields are missing → @agent-core-api (bikes GET endpoint not computing summary)

--- 8. CREATE A TRACK ---

curl -X POST http://localhost:8000/api/v1/garage/tracks \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Buttonwillow Raceway", "config": "13CW"}'

Expected: 201. Save TRACK_ID.

--- 9. CREATE AN EVENT ---

curl -X POST http://localhost:8000/api/v1/garage/events \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bike_id": "BIKE_ID",
    "track_id": "TRACK_ID",
    "date": "2026-03-20",
    "conditions": {
      "temp_c": 22,
      "humidity_pct": 45,
      "condition": "dry",
      "notes": "Clear skies, light wind"
    }
  }'

Expected: 201. Save EVENT_ID.
If 422 → @agent-core-api (conditions JSONB validation)

--- 10. CREATE A SESSION ---

curl -X POST http://localhost:8000/api/v1/sessions \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "EVENT_ID",
    "session_type": "practice",
    "manual_best_lap_ms": 98500,
    "rider_feedback": "Front end pushes in turn 5, rear feels unstable under braking into turn 8",
    "tire_front": {"compound": "Pirelli SC1", "pressure_psi": 33.0},
    "tire_rear": {"compound": "Pirelli SC2", "pressure_psi": 30.0}
  }'

Expected: 201. Save SESSION_ID.

--- 11. CREATE A SETUP SNAPSHOT ---

curl -X POST http://localhost:8000/api/v1/sessions/SESSION_ID/snapshot \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "schema_version": 1,
      "front": {"compression": 12, "rebound": 10, "preload": 5.0, "oil_level": 130},
      "rear": {"compression": 8, "rebound": 7, "preload": 4.0, "ride_height": 5}
    }
  }'

Expected: 201

--- 12. LOG A SETTING CHANGE ---

curl -X POST http://localhost:8000/api/v1/sessions/SESSION_ID/changes \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parameter": "front_rebound",
    "from_value": "10",
    "to_value": "12",
    "rationale": "Slowing rebound to reduce front push mid-corner"
  }'

Expected: 201

--- 13. REQUEST AN AI SUGGESTION ---

curl -X POST http://localhost:8000/api/v1/suggest \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "SESSION_ID"}'

Expected: 201 or 202 with { job_id }
Save JOB_ID.
If 502 → @agent-infra-fixer (gateway not routing /suggest to AI service)
If 500 → @agent-ai-service (job creation bug)

--- 14. CHECK SUGGESTION JOB STATUS ---

curl -X GET http://localhost:8000/api/v1/suggest/JOB_ID/stream \
  -H "Authorization: Bearer TOKEN"

If no ANTHROPIC_API_KEY is set: the job should be created but the worker will fail with an API key error. That's expected. Verify:
  - The generation_jobs row was created (status should be 'pending' or 'failed')
  - The Redis queue received the job
  
  docker compose exec postgres psql -U postgres -d dialed -c "SELECT id, status, error_message FROM ai.generation_jobs ORDER BY created_at DESC LIMIT 1;"

If ANTHROPIC_API_KEY IS set: the suggestion should stream. Wait for the complete event.

--- 15. CHECK PROGRESS ---

curl -X GET http://localhost:8000/api/v1/progress \
  -H "Authorization: Bearer TOKEN"

Expected: 200 with lap trend data (at least one session)

--- 16. CHECK UPCOMING MAINTENANCE ---

curl -X GET http://localhost:8000/api/v1/garage/bikes/BIKE_ID/maintenance/upcoming \
  -H "Authorization: Bearer TOKEN"

Expected: 200 (may be empty if mileage is far from next_due_km — that's fine, verify it doesn't 500)

---

FOR EACH STEP, REPORT:
- HTTP status code received
- Whether response shape matches the OpenAPI contract
- Any errors encountered and which agent fixed them

If any step returns 500:
1. Read the service logs: docker compose logs <service> --tail 20
2. Identify whether it's a code bug or infrastructure issue
3. Delegate to the appropriate agent
4. After the fix, re-run the failing step and all subsequent steps

Do not proceed past a 500 error — fix it first, then continue.
```

### Expected outcome
- Steps 1–12 all return 201
- Step 13 returns 201/202 with a job_id
- Step 14: job exists in database (pending or failed if no API key)
- Step 15 returns 200
- Step 16 returns 200

-----

## Step 6 — Run all test suites and finalize

**Goal:** All tests pass. Tag the release.

### Prompt

```
Use @agent-integration-lead to orchestrate this final step.

FINAL VERIFICATION AND TAG.

1. Run all three backend test suites:
   docker compose exec core-api pytest -v --tb=short 2>&1 | tail -20
   docker compose exec telemetry-ingestion pytest -v --tb=short 2>&1 | tail -20
   docker compose exec ai pytest -v --tb=short 2>&1 | tail -20

2. For any failures:
   - Read the error carefully
   - If the test expectation is wrong (doesn't match OpenAPI contract) → @agent-test-fixer
   - If the production code is wrong → appropriate service expert agent
   - Iterate until all tests pass

3. Run a frontend build check:
   docker compose exec frontend npm run build
   
   If it fails → @agent-frontend

4. Verify the full stack is still healthy after all fixes:
   docker compose ps
   (all 8 containers should be healthy/running)

5. Run one final smoke test through the gateway:
   curl -f http://localhost:8000/health
   curl -f http://localhost:8001/health
   curl -f http://localhost:8002/health
   curl -f http://localhost:8003/health

6. Commit and tag:
   git add -A
   git commit -m "stage 2 complete: all services integrated, tests passing, e2e verified"
   git tag v1.0.0-alpha

7. Generate the integration report. Include:

   ## Stage 2 Integration Report
   
   ### Test Results
   - Core API: X passed, Y failed, Z skipped
   - Telemetry/Ingestion: X passed, Y failed, Z skipped
   - AI: X passed, Y failed, Z skipped
   - Frontend build: pass/fail
   
   ### Infrastructure
   - All 8 containers: healthy/issues
   - Gateway routing: all routes verified
   - Inter-service connectivity: confirmed
   - Database schemas: core (X tables), telemetry (X tables + hypertable), ai (X tables)
   
   ### End-to-End Flow
   - User registration: ✓/✗
   - Bike CRUD + garage features: ✓/✗
   - Session creation + snapshots: ✓/✗
   - AI suggestion job creation: ✓/✗
   - Progress endpoint: ✓/✗
   
   ### Issues Fixed During Integration
   - [list each issue, which agent fixed it, and what was changed]
   
   ### Known Limitations
   - [list anything deferred or not yet working]
   
   ### Next Steps
   - Stage 3: seed with real CRA 2026 data
   - Deploy to mini PC via Cloudflare Tunnel
   - Share PWA URL with team for testing

Print the full report.
```

### Expected outcome
- All tests passing across all three services
- Frontend builds successfully
- All 8 containers healthy
- Tagged as `v1.0.0-alpha`
- Integration report generated

-----

## Quick reference — Agent delegation cheat sheet

| Problem | Agent to call |
|---------|---------------|
| Core API Python error (models, routers, services, auth, garage logic) | `@agent-core-api` |
| Telemetry Python error (CSV parser, pipelines, analysers, worker) | `@agent-telemetry-ingestion` |
| AI service Python error (rules engine, prompt builder, Claude streaming) | `@agent-ai-service` |
| Frontend error (React, TypeScript, Vite, Tailwind, MSW) | `@agent-frontend` |
| Docker build/compose failure | `@agent-infra-fixer` |
| Nginx routing (502, wrong upstream) | `@agent-infra-fixer` |
| Database connection failure | `@agent-infra-fixer` |
| Inter-service networking | `@agent-infra-fixer` |
| Environment variable missing/wrong | `@agent-infra-fixer` |
| Test assertion wrong (test doesn't match contract) | `@agent-test-fixer` |
| Test fixture/mock broken | `@agent-test-fixer` |
| Test fails because CODE is wrong | Service expert agent (not test-fixer) |

-----

*Run steps 0–6 sequentially. Do not skip steps. Fix all errors before proceeding to the next step. The integration-lead orchestrates — let it delegate to specialists.*
