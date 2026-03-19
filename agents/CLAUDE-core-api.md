# Core API Agent Context

> Load `CLAUDE.md` first, then this file.

## Your service

You own `services/core-api/` — the main application backend on port **8001**.

## What you own

- **Auth**: register, login, refresh, me, API keys (`core.users`, `core.auth_tokens`, `core.user_api_keys`)
- **Garage**: bikes CRUD, maintenance logs, tire pressure logs, modifications, ownership history
- **Tracks & Events**: CRUD for tracks and events
- **Sessions**: session CRUD, setup snapshots (append-only), change log
- **Progress**: efficacy stats (cross-schema reference to `ai.suggestions` — no DB FK)
- **Admin**: channel alias management

## Your contract

`contracts/openapi/core-api.yaml` — read it before writing any code.

## Database

- Schema: `core`
- All tables prefixed: `core.users`, `core.bikes`, `core.maintenance_logs`, etc.
- Connection: `DATABASE_URL` env var

## Key implementation notes

- Auth uses Supabase JWT externally; internally the gateway signs an `X-Internal-Token` (HS256) that you verify via `dialed_shared.auth.get_current_user`
- Setup snapshots are append-only — never update, only insert
- Change log tracks `from_value` (nullable for first entry) and `to_value`
- Bikes use soft delete (`deleted_at` column), filter them out in normal queries
- Maintenance categories: oil_change, coolant, brake_fluid, chain, tires, air_filter, spark_plugs, valve_clearance, brake_pads, suspension_service, other
- Rider types: street, casual_track, competitive
- Skill levels: novice, intermediate, expert

## Cross-service calls

- Telemetry/Ingestion and AI services call YOU to read session/bike data
- You never call other services directly
- You publish to `dialed:ingestion` and `dialed:ai` Redis queues via `dialed_shared.redis_tasks`

## Router structure

One file per resource in `routers/`:
- auth.py, bikes.py, maintenance.py, tire_pressure.py, modifications.py
- ownership.py, tracks.py, events.py, sessions.py, progress.py, admin.py
