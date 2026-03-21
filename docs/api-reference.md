# Dialed API Reference

> Complete endpoint reference for all three backend services.
> All endpoints are accessed via the **Gateway** at `http://localhost:8000/api/v1/`.

## Table of Contents

- [Architecture](#architecture)
- [Authentication](#authentication)
- [Error Envelope](#error-envelope)
- [Core API — Auth](#core-api--auth)
- [Core API — API Keys](#core-api--api-keys)
- [Core API — Bikes](#core-api--bikes)
- [Core API — Maintenance](#core-api--maintenance)
- [Core API — Tire Pressure](#core-api--tire-pressure)
- [Core API — Modifications](#core-api--modifications)
- [Core API — Ownership](#core-api--ownership)
- [Core API — Tracks](#core-api--tracks)
- [Core API — Events](#core-api--events)
- [Core API — Sessions](#core-api--sessions)
- [Core API — Progress](#core-api--progress)
- [Core API — Admin](#core-api--admin)
- [Telemetry — Ingestion](#telemetry--ingestion)
- [Telemetry — Job Status & Streaming](#telemetry--job-status--streaming)
- [Telemetry — Data Queries](#telemetry--data-queries)
- [AI — Suggestions](#ai--suggestions)
- [AI — Change Tracking](#ai--change-tracking)
- [Data Schemas](#data-schemas)

---

## Architecture

| Service              | Internal Port | Gateway Prefix       |
|----------------------|---------------|----------------------|
| Gateway              | 8000          | —                    |
| Core API             | 8001          | `/api/v1/`           |
| Telemetry/Ingestion  | 8002          | `/api/v1/`           |
| AI                   | 8003          | `/api/v1/`           |
| Frontend             | 5173          | —                    |
| PostgreSQL           | 5432          | —                    |
| TimescaleDB          | 5433          | —                    |
| Redis                | 6379          | —                    |

The gateway is a stateless reverse proxy. It validates the Supabase JWT from the `Authorization: Bearer <token>` header, signs an internal token with a shared secret, and forwards it as `X-Internal-Token` to backend services.

---

## Authentication

**Public endpoints** (no token required): `/auth/register`, `/auth/login`, `/auth/refresh`

**All other endpoints** require `Authorization: Bearer <token>` header. The gateway translates this into an `X-Internal-Token` for backend services. The internal token contains `user_id` and `exp`.

---

## Error Envelope

All services return errors in a standard envelope:

```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE",
  "request_id": "uuid"
}
```

| Code                  | HTTP Status | Description                        |
|-----------------------|-------------|------------------------------------|
| `VALIDATION_ERROR`    | 400 / 422   | Invalid request body or parameters |
| `UNAUTHORIZED`        | 401         | Missing or invalid token           |
| `FORBIDDEN`           | 403         | Insufficient permissions           |
| `NOT_FOUND`           | 404         | Resource does not exist            |
| `RATE_LIMITED`        | 429         | Too many requests                  |
| `INTERNAL_ERROR`      | 500         | Unexpected server error            |
| `SERVICE_UNAVAILABLE` | 503         | Downstream service unreachable     |

---

## Core API — Auth

### POST /auth/register

Register a new user account.

| Field          | Type   | Required | Description                                    |
|----------------|--------|----------|------------------------------------------------|
| `email`        | string | yes      | User email address                             |
| `password`     | string | yes      | Password (min 8 characters)                    |
| `display_name` | string | yes      | Display name                                   |
| `skill_level`  | string | no       | `novice` \| `intermediate` \| `expert`         |
| `rider_type`   | string | no       | `street` \| `casual_track` \| `competitive`    |
| `units`        | string | no       | `metric` \| `imperial`                         |

**Response:** `201 Created`

```json
{
  "user_id": "uuid",
  "token": "jwt-string",
  "refresh_token": "jwt-string"
}
```

**Errors:** `400`, `422` (validation), `409` (`USER_EXISTS`), `500`

---

### POST /auth/login

Authenticate an existing user.

| Field      | Type   | Required |
|------------|--------|----------|
| `email`    | string | yes      |
| `password` | string | yes      |

**Response:** `200 OK`

```json
{
  "token": "jwt-string",
  "refresh_token": "jwt-string"
}
```

**Errors:** `400`, `401` (invalid credentials), `500`

---

### POST /auth/refresh

Refresh an expired access token.

| Field           | Type   | Required |
|-----------------|--------|----------|
| `refresh_token` | string | yes      |

**Response:** `200 OK`

```json
{
  "token": "jwt-string",
  "refresh_token": "jwt-string"
}
```

**Errors:** `401` (invalid/expired refresh token), `500`

---

### GET /auth/me

Get the authenticated user's profile.

**Auth required:** Yes

**Response:** `200 OK` — `UserProfile`

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "display_name": "Ryan Shu",
  "skill_level": "expert",
  "rider_type": "competitive",
  "units": "metric",
  "created_at": "2026-03-07T00:00:00Z",
  "updated_at": "2026-03-07T00:00:00Z"
}
```

---

### PATCH /auth/me

Update the authenticated user's profile.

**Auth required:** Yes

All fields optional:

| Field          | Type   | Description                                    |
|----------------|--------|------------------------------------------------|
| `display_name` | string | Display name                                   |
| `skill_level`  | string | `novice` \| `intermediate` \| `expert`         |
| `rider_type`   | string | `street` \| `casual_track` \| `competitive`    |
| `units`        | string | `metric` \| `imperial`                         |

**Response:** `200 OK` — `UserProfile`

---

## Core API — API Keys

All endpoints require authentication.

### GET /auth/me/api-keys

List the user's API keys.

**Response:** `200 OK` — `ApiKeySummary[]`

```json
[
  {
    "id": "uuid",
    "name": "my-key",
    "last_used_at": "2026-03-07T00:00:00Z",
    "expires_at": "2027-03-07T00:00:00Z",
    "created_at": "2026-03-07T00:00:00Z"
  }
]
```

---

### PUT /auth/me/api-keys

Create a new API key.

| Field        | Type   | Required | Description            |
|--------------|--------|----------|------------------------|
| `name`       | string | yes      | Key name               |
| `expires_at` | string | no       | ISO 8601 expiry date   |

**Response:** `201 Created`

```json
{
  "id": "uuid",
  "name": "my-key",
  "key": "dialed_ak_...",
  "expires_at": "2027-03-07T00:00:00Z",
  "created_at": "2026-03-07T00:00:00Z"
}
```

> The `key` value is only returned once at creation time.

---

### DELETE /auth/me/api-keys/{key_id}

Revoke an API key.

**Response:** `204 No Content`

**Errors:** `404` (key not found)

---

## Core API — Bikes

All endpoints require authentication. Users can only access their own bikes.

### GET /garage/bikes

List the authenticated user's bikes.

**Response:** `200 OK` — `Bike[]`

```json
[
  {
    "id": "uuid",
    "make": "Honda",
    "model": "CBR1000RR-R SP",
    "year": 2021,
    "vin": null,
    "color": null,
    "mileage_km": null,
    "engine_hours": null,
    "exhaust": "Full Akrapovic",
    "ecu": "HRC wiring harness and ECU",
    "gearing_front": 15,
    "gearing_rear": 44,
    "suspension_spec": { "...": "..." },
    "notes": "...",
    "status": "owned",
    "created_at": "2026-03-07T00:00:00Z",
    "updated_at": "2026-03-07T00:00:00Z"
  }
]
```

---

### POST /garage/bikes

Create a new bike.

| Field             | Type    | Required | Description                                               |
|-------------------|---------|----------|-----------------------------------------------------------|
| `make`            | string  | yes      | Manufacturer                                              |
| `model`           | string  | yes      | Model name                                                |
| `year`            | integer | yes      | Model year                                                |
| `vin`             | string  | no       | Vehicle identification number                             |
| `color`           | string  | no       | Bike color                                                |
| `mileage_km`      | number  | no       | Current odometer reading in km                            |
| `engine_hours`    | number  | no       | Engine hour meter reading                                 |
| `exhaust`         | string  | no       | Exhaust system description                                |
| `ecu`             | string  | no       | ECU / electronics description                             |
| `gearing_front`   | integer | no       | Front sprocket tooth count                                |
| `gearing_rear`    | integer | no       | Rear sprocket tooth count                                 |
| `suspension_spec` | object  | no       | Full suspension specification (see [SuspensionSpec](#suspensionspec)) |
| `notes`           | string  | no       | Free-form notes                                           |
| `status`          | string  | no       | `owned` \| `sold` \| `stored` \| `in_repair`             |

**Response:** `201 Created` — `Bike`

---

### GET /garage/bikes/{bike_id}

Get bike detail with aggregated stats.

**Response:** `200 OK` — `BikeDetail`

**Errors:** `404` (bike not found or belongs to another user)

---

### PATCH /garage/bikes/{bike_id}

Update a bike. All fields from `POST` are accepted, all optional.

**Response:** `200 OK` — `Bike`

---

### DELETE /garage/bikes/{bike_id}

Soft-delete a bike (sets `deleted_at`).

**Response:** `204 No Content`

---

## Core API — Maintenance

All endpoints require authentication. Scoped to `{bike_id}`.

### GET /garage/bikes/{bike_id}/maintenance

List maintenance logs for a bike.

| Query Param | Type   | Description                                   |
|-------------|--------|-----------------------------------------------|
| `category`  | string | Filter by category                            |
| `from_date` | string | ISO 8601 date — return logs on or after       |
| `to_date`   | string | ISO 8601 date — return logs on or before      |

**Response:** `200 OK` — `MaintenanceLog[]`

```json
[
  {
    "id": "uuid",
    "bike_id": "uuid",
    "category": "oil_change",
    "description": "Motul 300V 10W-40 full change",
    "mileage_km": 12500,
    "engine_hours": null,
    "cost": 85.50,
    "currency": "USD",
    "performed_by": "self",
    "performed_at": "2026-03-01",
    "next_due_km": 15500,
    "next_due_date": "2026-06-01",
    "notes": null,
    "receipt_url": null,
    "created_at": "2026-03-01T00:00:00Z",
    "updated_at": "2026-03-01T00:00:00Z"
  }
]
```

**Categories:** `oil_change`, `coolant`, `brake_fluid`, `chain`, `air_filter`, `spark_plugs`, `valve_check`, `brake_pads`, `battery`, `general_service`, `other`

---

### POST /garage/bikes/{bike_id}/maintenance

Create a maintenance log entry.

| Field           | Type    | Required | Description                          |
|-----------------|---------|----------|--------------------------------------|
| `category`      | string  | yes      | See categories above                 |
| `description`   | string  | yes      | What was done                        |
| `mileage_km`    | number  | no       | Odometer at time of service          |
| `engine_hours`  | number  | no       | Engine hours at time of service      |
| `cost`          | number  | no       | Cost of service                      |
| `currency`      | string  | no       | ISO 4217 currency code               |
| `performed_by`  | string  | no       | Who performed it                     |
| `performed_at`  | string  | yes      | Date performed (ISO 8601 date)       |
| `next_due_km`   | number  | no       | Next service due at this mileage     |
| `next_due_date` | string  | no       | Next service due date                |
| `notes`         | string  | no       | Additional notes                     |
| `receipt_url`   | string  | no       | URL to receipt image                 |

**Response:** `201 Created` — `MaintenanceLog`

---

### GET /garage/bikes/{bike_id}/maintenance/upcoming

Get upcoming maintenance items for a bike.

**Response:** `200 OK` — `UpcomingMaintenance`

---

### GET /garage/bikes/{bike_id}/maintenance/{maintenance_id}

Get a single maintenance log entry.

**Response:** `200 OK` — `MaintenanceLog`

---

### PATCH /garage/bikes/{bike_id}/maintenance/{maintenance_id}

Update a maintenance log entry. All fields from `POST` accepted, all optional.

**Response:** `200 OK` — `MaintenanceLog`

---

### DELETE /garage/bikes/{bike_id}/maintenance/{maintenance_id}

Delete a maintenance log entry.

**Response:** `204 No Content`

---

## Core API — Tire Pressure

All endpoints require authentication. Scoped to `{bike_id}`.

### GET /garage/bikes/{bike_id}/tire-pressure

List tire pressure readings.

| Query Param | Type   | Description                                    |
|-------------|--------|------------------------------------------------|
| `context`   | string | Filter by context                              |
| `from_date` | string | ISO 8601 date — return readings on or after    |
| `to_date`   | string | ISO 8601 date — return readings on or before   |

**Response:** `200 OK` — `TirePressureLog[]`

```json
[
  {
    "id": "uuid",
    "bike_id": "uuid",
    "front_psi": 33.0,
    "rear_psi": 30.0,
    "front_temp_c": 45.2,
    "rear_temp_c": 52.1,
    "context": "post_session",
    "session_id": "uuid",
    "notes": null,
    "recorded_at": "2026-03-07T14:30:00Z",
    "created_at": "2026-03-07T14:30:00Z"
  }
]
```

**Context values:** `cold`, `pre_ride`, `post_ride`, `pit_stop`, `pre_session`, `post_session`

---

### POST /garage/bikes/{bike_id}/tire-pressure

Record a tire pressure reading.

| Field          | Type    | Required | Description                                |
|----------------|---------|----------|--------------------------------------------|
| `front_psi`    | number  | yes      | Front tire pressure in PSI                 |
| `rear_psi`     | number  | yes      | Rear tire pressure in PSI                  |
| `front_temp_c` | number  | no       | Front tire temperature in Celsius          |
| `rear_temp_c`  | number  | no       | Rear tire temperature in Celsius           |
| `context`      | string  | yes      | See context values above                   |
| `session_id`   | string  | no       | Link to a session (UUID)                   |
| `notes`        | string  | no       | Additional notes                           |
| `recorded_at`  | string  | no       | ISO 8601 datetime (defaults to now)        |

**Response:** `201 Created` — `TirePressureLog`

---

### GET /garage/bikes/{bike_id}/tire-pressure/{reading_id}

Get a single tire pressure reading.

**Response:** `200 OK` — `TirePressureLog`

---

### DELETE /garage/bikes/{bike_id}/tire-pressure/{reading_id}

Delete a tire pressure reading.

**Response:** `204 No Content`

---

## Core API — Modifications

All endpoints require authentication. Scoped to `{bike_id}`.

### GET /garage/bikes/{bike_id}/mods

List modifications for a bike.

| Query Param | Type   | Description        |
|-------------|--------|--------------------|
| `category`  | string | Filter by category |
| `status`    | string | Filter by status   |

**Response:** `200 OK` — `Modification[]`

```json
[
  {
    "id": "uuid",
    "bike_id": "uuid",
    "action": "installed",
    "category": "exhaust",
    "part_name": "Full Akrapovic Racing Line",
    "brand": "Akrapovic",
    "part_number": "S-H10R12-APT",
    "cost": 2400.00,
    "currency": "USD",
    "installed_at": "2025-11-01",
    "removed_at": null,
    "mileage_km": 8000,
    "notes": null,
    "created_at": "2025-11-01T00:00:00Z",
    "updated_at": "2025-11-01T00:00:00Z"
  }
]
```

**Actions:** `installed`, `removed`, `swapped`, `upgraded`, `repaired`

**Categories:** `exhaust`, `ecu`, `suspension`, `brakes`, `wheels_tires`, `bodywork`, `controls`, `lighting`, `engine`, `drivetrain`, `electronics`, `ergonomics`, `other`

---

### POST /garage/bikes/{bike_id}/mods

Create a modification entry.

| Field          | Type    | Required | Description                    |
|----------------|---------|----------|--------------------------------|
| `action`       | string  | yes      | See actions above              |
| `category`     | string  | yes      | See categories above           |
| `part_name`    | string  | yes      | Name of the part               |
| `brand`        | string  | no       | Part manufacturer              |
| `part_number`  | string  | no       | Part/SKU number                |
| `cost`         | number  | no       | Cost                           |
| `currency`     | string  | no       | ISO 4217 currency code         |
| `installed_at` | string  | no       | Date installed (ISO 8601 date) |
| `removed_at`   | string  | no       | Date removed (ISO 8601 date)   |
| `mileage_km`   | number  | no       | Mileage at time of mod         |
| `notes`        | string  | no       | Additional notes               |

**Response:** `201 Created` — `Modification`

---

### GET /garage/bikes/{bike_id}/mods/{mod_id}

**Response:** `200 OK` — `Modification`

### PATCH /garage/bikes/{bike_id}/mods/{mod_id}

Update a modification. All fields from `POST` accepted, all optional.

**Response:** `200 OK` — `Modification`

### DELETE /garage/bikes/{bike_id}/mods/{mod_id}

**Response:** `204 No Content`

---

## Core API — Ownership

All endpoints require authentication. Scoped to `{bike_id}`.

### GET /garage/bikes/{bike_id}/ownership

List ownership history for a bike.

**Response:** `200 OK` — `OwnershipHistory[]`

```json
[
  {
    "id": "uuid",
    "bike_id": "uuid",
    "event_type": "purchased",
    "date": "2021-04-15",
    "price": 28000.00,
    "currency": "USD",
    "mileage_km": 0,
    "counterparty": "Honda dealer",
    "notes": null,
    "created_at": "2021-04-15T00:00:00Z"
  }
]
```

**Event types:** `purchased`, `sold`, `traded`, `gifted`, `transferred`

---

### POST /garage/bikes/{bike_id}/ownership

Create an ownership history entry.

| Field          | Type    | Required | Description                 |
|----------------|---------|----------|-----------------------------|
| `event_type`   | string  | yes      | See event types above       |
| `date`         | string  | yes      | ISO 8601 date               |
| `price`        | number  | no       | Transaction price           |
| `currency`     | string  | no       | ISO 4217 currency code      |
| `mileage_km`   | number  | no       | Mileage at time of event    |
| `counterparty` | string  | no       | Other party in transaction  |
| `notes`        | string  | no       | Additional notes            |

**Response:** `201 Created` — `OwnershipHistory`

---

### DELETE /garage/bikes/{bike_id}/ownership/{ownership_id}

**Response:** `204 No Content`

---

## Core API — Tracks

All endpoints require authentication.

### GET /garage/tracks

List the user's tracks.

**Response:** `200 OK` — `Track[]`

```json
[
  {
    "id": "uuid",
    "name": "Buttonwillow Raceway",
    "config": "TC#1",
    "surface_notes": "Abrasive surface. T8 and T13 have significant bumps.",
    "created_at": "2026-03-07T00:00:00Z",
    "updated_at": "2026-03-07T00:00:00Z"
  }
]
```

---

### POST /garage/tracks

| Field           | Type   | Required | Description                 |
|-----------------|--------|----------|-----------------------------|
| `name`          | string | yes      | Track name                  |
| `config`        | string | no       | Track configuration/layout  |
| `surface_notes` | string | no       | Surface condition notes     |

**Response:** `201 Created` — `Track`

---

### GET /garage/tracks/{track_id}

**Response:** `200 OK` — `Track`

### PATCH /garage/tracks/{track_id}

All fields from `POST` accepted, all optional.

**Response:** `200 OK` — `Track`

### DELETE /garage/tracks/{track_id}

**Response:** `204 No Content`

---

## Core API — Events

All endpoints require authentication.

### GET /garage/events

List events (race days, track days).

| Query Param | Type   | Description                               |
|-------------|--------|-------------------------------------------|
| `bike_id`   | string | Filter events by bike (UUID)              |
| `track_id`  | string | Filter events by track (UUID)             |
| `from_date` | string | ISO 8601 date — return events on or after |
| `to_date`   | string | ISO 8601 date — return events on or before|

**Response:** `200 OK` — `Event[]`

```json
[
  {
    "id": "uuid",
    "bike_id": "uuid",
    "track_id": "uuid",
    "date": "2026-03-07",
    "conditions": "dry",
    "air_temp_c": 18,
    "track_temp_c": 28,
    "created_at": "2026-03-07T00:00:00Z",
    "updated_at": "2026-03-07T00:00:00Z"
  }
]
```

---

### POST /garage/events

| Field          | Type    | Required | Description                              |
|----------------|---------|----------|------------------------------------------|
| `bike_id`      | string  | yes      | UUID of the bike                         |
| `track_id`     | string  | yes      | UUID of the track                        |
| `date`         | string  | yes      | Event date (ISO 8601 date)               |
| `conditions`   | string  | no       | `dry` \| `damp` \| `wet` \| `mixed`     |
| `air_temp_c`   | number  | no       | Air temperature in Celsius               |
| `track_temp_c` | number  | no       | Track surface temperature in Celsius     |

**Response:** `201 Created` — `Event`

---

### GET /garage/events/{event_id}

**Response:** `200 OK` — `Event`

### PATCH /garage/events/{event_id}

All fields from `POST` accepted, all optional.

**Response:** `200 OK` — `Event`

### DELETE /garage/events/{event_id}

**Response:** `204 No Content`

---

## Core API — Sessions

All endpoints require authentication.

### GET /sessions

List sessions.

| Query Param | Type   | Description                                 |
|-------------|--------|---------------------------------------------|
| `event_id`  | string | Filter by event (UUID)                      |
| `from_date` | string | ISO 8601 date — return sessions on or after |
| `to_date`   | string | ISO 8601 date — return sessions on or before|

**Response:** `200 OK` — `Session[]`

```json
[
  {
    "id": "uuid",
    "event_id": "uuid",
    "session_type": "qualifying",
    "manual_best_lap_ms": 105972,
    "csv_best_lap_ms": null,
    "tire_front": { "brand": "Pirelli", "compound": "SC1", "laps": null },
    "tire_rear": { "brand": "Pirelli", "compound": "SC1", "laps": null },
    "rider_feedback": "P1 in class...",
    "voice_note_url": null,
    "created_at": "2026-03-07T00:00:00Z",
    "updated_at": "2026-03-07T00:00:00Z"
  }
]
```

**Session types:** `practice`, `qualifying`, `race`, `trackday`

---

### POST /sessions

| Field              | Type    | Required | Description                           |
|--------------------|---------|----------|---------------------------------------|
| `event_id`         | string  | yes      | UUID of the event                     |
| `session_type`     | string  | yes      | See session types above               |
| `manual_best_lap_ms` | integer | no    | Best lap time in milliseconds         |
| `tire_front`       | object  | no       | `TireSnapshot` — brand, compound, laps|
| `tire_rear`        | object  | no       | `TireSnapshot` — brand, compound, laps|
| `rider_feedback`   | string  | no       | Free-form rider feedback              |

**Response:** `201 Created` — `Session`

---

### GET /sessions/{session_id}

Get session detail including setup snapshots and change log.

**Response:** `200 OK` — `SessionDetail`

```json
{
  "id": "uuid",
  "event_id": "uuid",
  "session_type": "qualifying",
  "manual_best_lap_ms": 105972,
  "csv_best_lap_ms": null,
  "tire_front": { "brand": "Pirelli", "compound": "SC1", "laps": null },
  "tire_rear": { "brand": "Pirelli", "compound": "SC1", "laps": null },
  "rider_feedback": "...",
  "snapshots": [
    {
      "id": "uuid",
      "session_id": "uuid",
      "settings": { "front": { "...": "..." }, "rear": { "...": "..." } },
      "created_at": "2026-03-07T00:00:00Z"
    }
  ],
  "changes": [
    {
      "id": "uuid",
      "session_id": "uuid",
      "parameter": "fork_height_mm",
      "from_value": "6.6",
      "to_value": "8.6",
      "rationale": "Lazy turn-in — raising front to correct geometry",
      "applied_at": "2026-03-07T12:00:00Z"
    }
  ],
  "created_at": "2026-03-07T00:00:00Z",
  "updated_at": "2026-03-07T00:00:00Z"
}
```

---

### PATCH /sessions/{session_id}

Update a session. All fields from `POST` accepted, all optional.

**Response:** `200 OK` — `Session`

---

### POST /sessions/{session_id}/snapshot

Add a setup snapshot to a session. Snapshots are **append-only** — multiple snapshots per session are allowed.

| Field      | Type   | Required | Description                                             |
|------------|--------|----------|---------------------------------------------------------|
| `settings` | object | yes      | Suspension settings (see [SuspensionSpec](#suspensionspec)) |

**Response:** `201 Created` — `SetupSnapshot`

---

### GET /sessions/{session_id}/changes

List the change log for a session.

**Response:** `200 OK` — `ChangeLog[]`

---

### POST /sessions/{session_id}/changes

Record a setup change made after this session.

| Field       | Type   | Required | Description                          |
|-------------|--------|----------|--------------------------------------|
| `parameter` | string | yes      | What was changed (e.g. `fork_height_mm`) |
| `from_value`| string | yes      | Previous value                       |
| `to_value`  | string | yes      | New value                            |
| `rationale` | string | no       | Why the change was made              |

**Response:** `201 Created` — `ChangeLog`

---

## Core API — Progress

All endpoints require authentication.

### GET /progress

Get the user's overall progress overview — lap time trends, best laps by track.

**Response:** `200 OK` — `ProgressOverview`

```json
{
  "sessions": [
    {
      "session_id": "uuid",
      "session_type": "qualifying",
      "best_lap_ms": 105972,
      "track_name": "Buttonwillow Raceway",
      "date": "2026-03-07"
    }
  ],
  "best_lap_ms": 105972,
  "total_time_found_ms": 4051,
  "tracks": [
    { "name": "Buttonwillow Raceway", "best_lap_ms": 105972 }
  ]
}
```

---

### GET /progress/efficacy

Get suggestion efficacy metrics — how often suggestions are applied and their impact.

**Response:** `200 OK` — `EfficacyOverview`

---

### GET /progress/sessions

Get session history with lap time deltas between sessions.

**Response:** `200 OK` — `SessionHistory`

---

## Core API — Admin

Requires authentication and admin role.

### GET /admin/channel-aliases

List telemetry channel aliases (maps vendor channel names to canonical names).

**Response:** `200 OK` — `ChannelAlias[]`

---

### POST /admin/channel-aliases

Create a channel alias.

| Field            | Type   | Required | Description                     |
|------------------|--------|----------|---------------------------------|
| `vendor_name`    | string | yes      | Vendor-specific channel name    |
| `canonical_name` | string | yes      | Canonical channel name          |

**Response:** `201 Created` — `ChannelAlias`

---

### PATCH /admin/channel-aliases/{alias_id}

Update a channel alias. All fields from `POST` accepted, all optional.

**Response:** `200 OK` — `ChannelAlias`

### DELETE /admin/channel-aliases/{alias_id}

**Response:** `204 No Content`

---

## Telemetry — Ingestion

All endpoints require authentication. Ingestion is **asynchronous** — endpoints return a `job_id` immediately. Use [job status](#telemetry--job-status--streaming) or SSE streaming to track progress.

### POST /ingest/csv

Upload an AiM/data logger CSV file for parsing and storage.

**Content-Type:** `multipart/form-data`

| Field        | Type   | Required | Description              |
|--------------|--------|----------|--------------------------|
| `session_id` | string | yes      | UUID of the session      |
| `file`       | binary | yes      | CSV file                 |

**Response:** `202 Accepted`

```json
{
  "job_id": "uuid"
}
```

**Errors:** `400` (`INVALID_FILE_FORMAT`), `422`, `500`

---

### POST /ingest/ocr

Upload a setup sheet image for OCR extraction of suspension settings.

**Content-Type:** `multipart/form-data`

| Field        | Type   | Required | Description              |
|--------------|--------|----------|--------------------------|
| `session_id` | string | yes      | UUID of the session      |
| `file`       | binary | yes      | Image file (JPG/PNG)     |

**Response:** `202 Accepted`

```json
{
  "job_id": "uuid"
}
```

Results require user confirmation via `POST /ingest/jobs/{job_id}/confirm` before being saved.

---

### POST /ingest/voice

Upload a voice recording or transcript for entity extraction.

**Content-Type:** `multipart/form-data`

| Field        | Type   | Required | Description              |
|--------------|--------|----------|--------------------------|
| `session_id` | string | yes      | UUID of the session      |
| `file`       | binary | yes      | Audio file               |

**Response:** `202 Accepted`

```json
{
  "job_id": "uuid"
}
```

Results require user confirmation before being saved.

---

## Telemetry — Job Status & Streaming

### GET /ingest/jobs/{job_id}

Poll for job status.

**Response:** `200 OK` — `IngestionJob`

```json
{
  "id": "uuid",
  "session_id": "uuid",
  "source": "csv",
  "status": "complete",
  "result": { "...": "..." },
  "error_message": null,
  "confidence": 0.95,
  "created_at": "2026-03-07T00:00:00Z",
  "completed_at": "2026-03-07T00:00:05Z"
}
```

**Status values:** `pending`, `processing`, `complete`, `failed`

**Source values:** `csv`, `ocr`, `voice`

---

### GET /ingest/jobs/{job_id}/stream

Subscribe to real-time job progress via Server-Sent Events (SSE).

**Content-Type:** `text/event-stream`

**Events:**

| Event      | Description                                |
|------------|--------------------------------------------|
| `status`   | Job status change (e.g. processing)        |
| `complete` | Job finished successfully — includes result|
| `failed`   | Job failed — includes error message        |

---

### POST /ingest/jobs/{job_id}/confirm

Confirm or reject OCR/voice extraction results before they are saved to the session.

| Field         | Type    | Required | Description                         |
|---------------|---------|----------|-------------------------------------|
| `confirmed`   | boolean | yes      | Accept or reject the extraction     |
| `corrections` | object  | no       | Manual corrections to extracted data|

**Response:** `200 OK`

---

## Telemetry — Data Queries

All endpoints require authentication.

### POST /telemetry/upload

Direct telemetry data upload (programmatic, not from file ingestion).

**Response:** `201 Created`

---

### GET /telemetry/{session_id}/channels

List available telemetry channels for a session with min/max values and sample counts.

**Response:** `200 OK` — `ChannelSummary`

```json
{
  "session_id": "uuid",
  "channels": [
    {
      "name": "GPS_Speed",
      "min": 0.0,
      "max": 155.8,
      "sample_count": 48000,
      "unit": "mph"
    }
  ]
}
```

---

### GET /telemetry/{session_id}/lap/{lap_number}

Get telemetry data for a specific lap.

| Query Param | Type    | Description                                      |
|-------------|---------|--------------------------------------------------|
| `hz`        | integer | Downsample to this frequency (e.g. `10` for 10Hz)|
| `channels`  | string  | Comma-separated list of channel names to include  |

**Response:** `200 OK` — `LapData`

```json
{
  "session_id": "uuid",
  "lap_number": 4,
  "lap_time_ms": 105972,
  "channels": ["GPS_Speed", "ThrottlePosition", "ForkPosition"],
  "point_count": 2119,
  "data": [
    {
      "time_ms": 0,
      "GPS_Speed": 45.2,
      "ThrottlePosition": 0.0,
      "ForkPosition": 82.1
    }
  ]
}
```

---

### GET /telemetry/{session_id}/analysis

Get computed analysis for a session — lap segments, braking zones, fork rebound rates, TCS events.

**Response:** `200 OK` — `SessionAnalysis`

```json
{
  "session_id": "uuid",
  "max_speed_mph": 155.8,
  "max_brake_pressure_bar": 15.63,
  "max_fork_compression_mm": 114.7,
  "grppct_cap_detected": true,
  "grppct_cap_percentage": 57.0,
  "fork_rebound_rate_mms": [
    { "braking_zone": "T5 entry", "rate_mms": 14.2 }
  ],
  "engine_braking_slip_events": 3,
  "lap_segments": [
    {
      "lap_number": 1,
      "start_time_ms": 0,
      "end_time_ms": 110023,
      "lap_time_ms": 110023
    }
  ]
}
```

---

## AI — Suggestions

All endpoints require authentication. Suggestion generation is **asynchronous** — `POST /suggest` returns a `job_id`. Use SSE streaming or poll the session suggestions list.

### POST /suggest

Request an AI-generated setup suggestion for a session.

| Field        | Type   | Required | Description         |
|--------------|--------|----------|---------------------|
| `session_id` | string | yes      | UUID of the session |

**Response:** `202 Accepted`

```json
{
  "job_id": "uuid"
}
```

The AI service loads the session context, all prior sessions for the event, runs the rules engine, and calls the Claude API. Suggestions are adapted based on the user's `skill_level`.

---

### GET /suggest/{job_id}/stream

Subscribe to suggestion generation progress via Server-Sent Events (SSE).

**Content-Type:** `text/event-stream`

**Events:**

| Event      | Description                                      |
|------------|--------------------------------------------------|
| `status`   | Job status change                                |
| `token`    | Incremental text token (streaming response)      |
| `complete` | Generation finished — includes suggestion ID     |
| `failed`   | Generation failed — includes error message       |

---

### GET /suggest/session/{session_id}

List all suggestion summaries for a session.

**Response:** `200 OK` — `SuggestionSummary[]`

```json
[
  {
    "id": "uuid",
    "session_id": "uuid",
    "created_at": "2026-03-07T15:00:00Z"
  }
]
```

---

### GET /suggest/{suggestion_id}

Get full suggestion detail including text and structured changes.

**Response:** `200 OK` — `Suggestion`

```json
{
  "id": "uuid",
  "session_id": "uuid",
  "user_id": "uuid",
  "text": "Based on your qualifying session at Buttonwillow...",
  "changes": [
    {
      "id": "uuid",
      "suggestion_id": "uuid",
      "parameter": "front_rebound_clicks",
      "suggested_value": "11",
      "symptom": "brake_to_throttle_chatter",
      "confidence": 0.82,
      "applied_status": "not_applied",
      "actual_value": null,
      "outcome_lap_delta_ms": null,
      "applied_at": null,
      "created_at": "2026-03-07T15:00:00Z"
    }
  ],
  "created_at": "2026-03-07T15:00:00Z"
}
```

---

## AI — Change Tracking

### PATCH /suggest/{suggestion_id}/changes/{change_id}

Update the applied status of a suggested change.

| Field            | Type   | Required | Description                                                          |
|------------------|--------|----------|----------------------------------------------------------------------|
| `applied_status` | string | yes      | `not_applied` \| `applied` \| `applied_modified` \| `skipped`       |
| `actual_value`   | string | no       | The value actually used (if different from suggested)                |

**Response:** `200 OK` — `UpdatedChange`

---

### PATCH /suggest/{suggestion_id}/changes/{change_id}/outcome

Record the lap time outcome after applying a change.

| Field                  | Type    | Required | Description                                        |
|------------------------|---------|----------|----------------------------------------------------|
| `outcome_lap_delta_ms` | integer | yes      | Lap time change in ms (negative = improvement)     |

**Response:** `200 OK` — `UpdatedChange`

---

## Data Schemas

### SuspensionSpec

Used in bike `suspension_spec` and session setup snapshots.

```json
{
  "schema_version": 1,
  "front": {
    "compression": 16,
    "rebound": 12,
    "preload": 2,
    "spring_rate": 10.75,
    "oil_level": null,
    "ride_height": 8.6
  },
  "rear": {
    "compression": 12,
    "rebound": 15,
    "preload": 10,
    "spring_rate": 110,
    "oil_level": null,
    "ride_height": null
  }
}
```

### TireSnapshot

Used in session tire fields.

```json
{
  "brand": "Pirelli",
  "compound": "SC1",
  "laps": 12
}
```

### Conditions

Used in event weather/track conditions.

```json
{
  "temp_c": 18,
  "humidity_pct": 45,
  "track_temp_c": 28,
  "wind_kph": 8,
  "condition": "dry",
  "notes": "Morning fog cleared by 10am"
}
```

**Condition values:** `dry`, `damp`, `wet`, `mixed`

### TelemetryPoint

20Hz hypertable row in TimescaleDB.

| Field             | Type     | Description                        |
|-------------------|----------|------------------------------------|
| `time`            | datetime | Partition key                      |
| `session_id`      | uuid     | Session reference                  |
| `gps_speed`       | number   | GPS speed                          |
| `throttle_pos`    | number   | Throttle position (0-100)          |
| `rpm`             | number   | Engine RPM                         |
| `gear`            | integer  | Current gear (>=0)                 |
| `lean_angle`      | number   | Lean angle in degrees              |
| `front_brake_psi` | number   | Front brake pressure               |
| `rear_brake_psi`  | number   | Rear brake pressure                |
| `fork_position`   | number   | Fork compression position          |
| `shock_position`  | number   | Rear shock position                |
| `coolant_temp`    | number   | Coolant temperature                |
| `oil_temp`        | number   | Oil temperature                    |
| `lat`             | number   | GPS latitude (-90 to 90)           |
| `lon`             | number   | GPS longitude (-180 to 180)        |
| `extra_channels`  | object   | Additional channels (string: number) |

### Redis Task Payloads

**Ingestion queue** (`dialed:ingestion`):

```json
{
  "job_id": "uuid",
  "session_id": "uuid",
  "user_id": "uuid",
  "source": "csv",
  "file_path": "/uploads/abc123.csv",
  "created_at": "2026-03-07T00:00:00Z"
}
```

**AI queue** (`dialed:ai`):

```json
{
  "job_id": "uuid",
  "session_id": "uuid",
  "user_id": "uuid",
  "created_at": "2026-03-07T00:00:00Z"
}
```
