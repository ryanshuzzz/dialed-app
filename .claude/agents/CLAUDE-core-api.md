---
name: core-api
description: Agent for the Dialed Core API service — auth, garage (bikes, maintenance, tires, mods, ownership), tracks, events, sessions, setup snapshots, change log, progress, and admin.
allowedTools:
  - Edit(file_path="services/core-api/**")
  - Write(file_path="services/core-api/**")
---

# Agent: Core API

> Read `CLAUDE.md` (master context) first. This file has your service-specific instructions.

## Your scope

You own the `core-api` service. This is the largest service — it covers:

- **Auth** — user registration, login, JWT refresh, profile management
- **Garage — Bikes** — CRUD for bikes with validated `suspension_spec` JSONB
- **Garage — Maintenance** — maintenance log entries (oil, chain, brakes, etc.) with next-due tracking
- **Garage — Tire Pressure** — timestamped pressure readings with context (cold, pre-ride, pit stop, etc.)
- **Garage — Modifications** — parts installed/removed/swapped with cost and date tracking
- **Garage — Ownership** — purchased/sold/traded timeline with price and mileage
- **Tracks** — track CRUD
- **Events** — track day events with structured weather/conditions JSONB
- **Sessions** — track session logs with dual lap times (`manual_best_lap_ms` + `csv_best_lap_ms`)
- **Setup Snapshots** — append-only suspension state snapshots per session
- **Change Log** — individual setting changes with from/to values and rationale
- **Progress** — lap time trends, efficacy stats (reads from `ai` schema via suggestion_id)
- **Admin** — channel alias management (AiM CSV column name mappings)

## Your contract

```
contracts/openapi/core-api.yaml
```

Read it before writing any code. Every endpoint, field name, status code, and error shape must match exactly.

## Database

Schema: `core`

You own every table in the `core` schema. Refer to the data model in the implementation plan for the complete SQL. Key points:

- `bikes.suspension_spec` — validated JSONB with versioned Pydantic model. Must contain `schema_version`. Validate on every write (POST and PATCH).
- `bikes.deleted_at` — soft delete. All bike queries must filter `WHERE deleted_at IS NULL` unless explicitly requesting archived bikes.
- `bikes.status` — `owned`, `sold`, `stored`, `in_repair`. Independent of soft delete.
- `events.conditions` — validated JSONB: `{ temp_c, humidity_pct, track_temp_c, wind_kph, condition, notes }`. Validate on write.
- `sessions` — has both `manual_best_lap_ms` and `csv_best_lap_ms`. Display logic: show CSV when available, fall back to manual.
- `sessions.tire_front` / `tire_rear` — JSONB: `{ compound, size, pressure_psi, laps_on }`.
- `setup_snapshots` — **append only**. Never UPDATE or DELETE. Only INSERT.
- `change_log.from_value` — nullable. Null means first-time setting (document this in schema description).
- `maintenance_logs.next_due_km` / `next_due_date` — used by the `/maintenance/upcoming` endpoint.
- `tire_pressure_logs.session_id` — optional FK to `core.sessions`. Links pressure readings to track sessions when applicable.
- `tire_pressure_logs.context` — enum: `cold`, `pre_ride`, `post_ride`, `pit_stop`, `pre_session`, `post_session`.
- `modifications.removed_at` — null means still installed. Filter on this for "active mods" queries.
- `channel_aliases` — lookup table with unique constraint on `(raw_name, logger_model)`.
- `efficacy_stats.suggestion_id` — references `ai.suggestions` cross-schema. Not enforced as FK (cross-schema). Validate via application logic.

## Business logic notes

### Users
- `rider_type` field: `street`, `casual_track`, `competitive`. Used by the frontend to tailor the UI (street riders see Garage-first, competitive riders see Sessions-first). The API treats all users identically — `rider_type` is a UI hint only, not an access control mechanism.

### Bikes summary endpoint
- `GET /garage/bikes/:id` should return a summary block alongside bike detail: total maintenance entries, last maintenance date, current active mods count, total mileage, tire pressure last checked date. This is a computed response, not a stored field.

### Maintenance upcoming
- `GET /garage/bikes/:bike_id/maintenance/upcoming` returns maintenance items where `next_due_km` is within 500km of current `bike.mileage_km` OR `next_due_date` is within 30 days of today. Sort by urgency (closest due first).

### Task queue interaction
- Core API does NOT consume from Redis queues. It only pushes jobs when the gateway forwards ingestion uploads or AI suggestion requests. The actual pushing is done via `dialed_shared.redis_tasks.push_job(queue_name, payload)`.

## File structure

```
services/core-api/
  main.py
  models/
    user.py
    auth_token.py
    bike.py
    maintenance_log.py
    tire_pressure_log.py
    modification.py
    ownership.py
    track.py
    event.py
    session.py
    setup_snapshot.py
    change_log.py
    efficacy.py
    channel_alias.py
  schemas/
    auth.py
    bikes.py
    maintenance.py
    tire_pressure.py
    modifications.py
    ownership.py
    tracks.py
    events.py
    sessions.py
    progress.py
    admin.py
  routers/
    auth.py
    bikes.py
    maintenance.py
    tire_pressure.py
    modifications.py
    ownership.py
    tracks.py
    events.py
    sessions.py
    progress.py
    admin.py
  services/
    auth_service.py
    garage_service.py
    session_service.py
    progress_service.py
  alembic/
  tests/
  Dockerfile
  requirements.txt
```

## Testing priorities

1. Suspension spec validation (malformed JSONB, missing schema_version, valid specs)
2. Soft delete filtering (bikes with deleted_at should not appear in list queries)
3. Maintenance upcoming logic (boundary conditions on km and date thresholds)
4. Conditions JSONB validation on events
5. Setup snapshot append-only enforcement
6. Auth flow (register, login, refresh, token expiry)
7. CRUD happy paths for all 11 resource types
