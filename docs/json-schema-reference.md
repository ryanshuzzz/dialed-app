# Dialed JSON Schema Reference

> **Source of truth:** `contracts/json-schema/`
> **Draft:** JSON Schema 2020-12
> All objects include `id` (uuid) and `created_at` (date-time). Mutable objects also include `updated_at`.

---

## Table of contents

1. [auth.schema.json](#authschemajson)
2. [garage.schema.json](#garageschemajson)
3. [suspension-spec.schema.json](#suspension-specschemajson)
4. [conditions.schema.json](#conditionsschemajson)
5. [session.schema.json](#sessionschemajson)
6. [telemetry.schema.json](#telemetryschemajson)
7. [ai.schema.json](#aischemajson)
8. [progress.schema.json](#progressschemajson)
9. [task-payloads.schema.json](#task-payloadsschemajson)

---

## auth.schema.json

User account, authentication tokens, and API keys.

### User

Represents any Dialed platform user — from casual street riders to competitive racers.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | ✓ | Unique user identifier |
| `email` | string (email) | ✓ | Login email address |
| `display_name` | string \| null | | UI display name; falls back to email prefix |
| `skill_level` | enum | ✓ | `novice` \| `intermediate` \| `expert` |
| `rider_type` | enum | ✓ | `street` \| `casual_track` \| `competitive` |
| `units` | enum | ✓ | `metric` \| `imperial` |
| `created_at` | date-time | ✓ | Account creation timestamp |
| `updated_at` | date-time | ✓ | Last modification timestamp |

### AuthToken

Persistent token record for programmatic or internal auth tracking.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | ✓ | Unique token identifier |
| `user_id` | uuid | ✓ | Owning user |
| `token_hash` | string | ✓ | Hashed token — raw value returned only at creation |
| `expires_at` | date-time | ✓ | Token expiry |
| `created_at` | date-time | ✓ | Issuance timestamp |

### UserApiKey

Named API key for team or programmatic access (e.g. "Paddock laptop").

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | ✓ | Unique key identifier |
| `user_id` | uuid | ✓ | Owning user |
| `name` | string | ✓ | Human-readable label |
| `key_hash` | string | ✓ | Hashed key — raw value returned only at creation |
| `last_used_at` | date-time \| null | | Most recent successful auth, or null |
| `expires_at` | date-time \| null | | Expiry timestamp; null = never expires |
| `created_at` | date-time | ✓ | Creation timestamp |

---

## garage.schema.json

Bikes, maintenance logs, tire pressure logs, modifications, and ownership history.

### Bike

Core garage entity. All maintenance, sessions, and telemetry hang off a bike.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | ✓ | Unique bike identifier |
| `user_id` | uuid | ✓ | Owning user |
| `make` | string | ✓ | Manufacturer (e.g. Honda, Ducati) |
| `model` | string | ✓ | Model designation (e.g. CBR600RR) |
| `year` | integer \| null | | Model year |
| `vin` | string \| null | | Vehicle identification number |
| `color` | string \| null | | Color or livery |
| `mileage_km` | integer \| null | | Current odometer in km |
| `engine_hours` | number \| null | | Hour meter reading |
| `exhaust` | string \| null | | Exhaust system description |
| `ecu` | string \| null | | ECU / flash description |
| `gearing_front` | integer \| null | | Front sprocket tooth count |
| `gearing_rear` | integer \| null | | Rear sprocket tooth count |
| `suspension_spec` | SuspensionSpec | ✓ | Current suspension settings (see [suspension-spec.schema.json](#suspension-specschemajson)) |
| `notes` | string \| null | | Free-text notes |
| `status` | enum | ✓ | `owned` \| `sold` \| `stored` \| `in_repair` |
| `deleted_at` | date-time \| null | | Soft-delete timestamp; non-null = removed from garage view |
| `created_at` | date-time | ✓ | Added to garage timestamp |
| `updated_at` | date-time | ✓ | Last modification timestamp |

### MaintenanceLog

A single maintenance event — oil change, chain service, valve check, etc.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | ✓ | Unique entry identifier |
| `bike_id` | uuid | ✓ | Target bike |
| `user_id` | uuid | ✓ | Logging user |
| `category` | enum | ✓ | `oil_change` \| `coolant` \| `brake_fluid` \| `chain` \| `air_filter` \| `spark_plugs` \| `valve_check` \| `brake_pads` \| `battery` \| `general_service` \| `other` |
| `description` | string \| null | | What was done |
| `mileage_km` | integer \| null | | Odometer at service time |
| `engine_hours` | number \| null | | Hour meter at service time |
| `cost` | number \| null | | Cost of service |
| `currency` | string \| null | | ISO 4217 code (default: USD) |
| `performed_by` | string \| null | | Who did the work (self, shop, mechanic) |
| `performed_at` | date | ✓ | Date the work was done |
| `next_due_km` | integer \| null | | Odometer target for next service |
| `next_due_date` | date \| null | | Date target for next service |
| `notes` | string \| null | | Additional notes |
| `receipt_url` | string (uri) \| null | | Blob storage URL of receipt photo |
| `created_at` | date-time | ✓ | Record creation timestamp |
| `updated_at` | date-time | ✓ | Last modification timestamp |

### TirePressureLog

Timestamped tire pressure reading, optionally linked to a track session.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | ✓ | Unique reading identifier |
| `bike_id` | uuid | ✓ | Target bike |
| `user_id` | uuid | ✓ | Logging user |
| `front_psi` | number \| null | | Front tire pressure in PSI |
| `rear_psi` | number \| null | | Rear tire pressure in PSI |
| `front_temp_c` | number \| null | | Front tire surface temperature in °C |
| `rear_temp_c` | number \| null | | Rear tire surface temperature in °C |
| `context` | enum | | `cold` \| `pre_ride` \| `post_ride` \| `pit_stop` \| `pre_session` \| `post_session` (default: `pre_ride`) |
| `session_id` | uuid \| null | | Optional link to a track session |
| `notes` | string \| null | | Free-text notes |
| `recorded_at` | date-time | ✓ | When the reading was taken |
| `created_at` | date-time | ✓ | Record creation timestamp |

### Modification

A part installed, removed, or changed on a bike. Builds a full modification history.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | ✓ | Unique record identifier |
| `bike_id` | uuid | ✓ | Target bike |
| `user_id` | uuid | ✓ | Logging user |
| `action` | enum | ✓ | `installed` \| `removed` \| `swapped` \| `upgraded` \| `repaired` |
| `category` | enum | ✓ | `exhaust` \| `ecu` \| `suspension` \| `brakes` \| `wheels_tires` \| `bodywork` \| `controls` \| `lighting` \| `engine` \| `drivetrain` \| `electronics` \| `ergonomics` \| `other` |
| `part_name` | string | ✓ | Part description (e.g. "Öhlins TTX GP rear shock") |
| `brand` | string \| null | | Manufacturer name |
| `part_number` | string \| null | | OEM or aftermarket part number |
| `cost` | number \| null | | Cost of part or service |
| `currency` | string \| null | | ISO 4217 code (default: USD) |
| `installed_at` | date | ✓ | Date the action was performed |
| `removed_at` | date \| null | | Date the part was removed; null = currently installed |
| `mileage_km` | integer \| null | | Odometer at time of modification |
| `notes` | string \| null | | Free-text notes |
| `created_at` | date-time | ✓ | Record creation timestamp |
| `updated_at` | date-time | ✓ | Last modification timestamp |

### OwnershipHistory

A single ownership transaction — purchase, sale, trade, gift, or transfer.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | ✓ | Unique event identifier |
| `bike_id` | uuid | ✓ | Target bike |
| `user_id` | uuid | ✓ | Logging user |
| `event_type` | enum | ✓ | `purchased` \| `sold` \| `traded` \| `gifted` \| `transferred` |
| `date` | date | ✓ | Date of the transaction |
| `price` | number \| null | | Transaction price; null for non-monetary transfers |
| `currency` | string \| null | | ISO 4217 code (default: USD) |
| `mileage_km` | integer \| null | | Odometer at transaction time |
| `counterparty` | string \| null | | Other party (dealer, private seller, etc.) |
| `notes` | string \| null | | Free-text notes |
| `created_at` | date-time | ✓ | Record creation timestamp |

---

## suspension-spec.schema.json

Versioned suspension specification stored as validated JSONB in `core.bikes.suspension_spec`.

### SuspensionSpec

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schema_version` | integer (const: 1) | ✓ | Version number — increment when shape changes |
| `front` | SuspensionEndSettings \| null | | Front fork / damper settings |
| `rear` | SuspensionEndSettings \| null | | Rear shock / linkage settings |

### SuspensionEndSettings

All fields optional — riders fill in what they have and know.

| Field | Type | Description |
|-------|------|-------------|
| `compression` | number \| null | Compression damping clicks from full hard |
| `rebound` | number \| null | Rebound damping clicks from full hard |
| `preload` | number \| null | Spring preload in mm or turns from minimum |
| `spring_rate` | number \| null | Spring rate in N/mm |
| `oil_level` | number \| null | Fork oil level in mm from top of inner tube (front only) |
| `ride_height` | number \| null | Ride height in mm |

---

## conditions.schema.json

Structured weather and track conditions stored as validated JSONB in `core.events.conditions`.

### Conditions

All fields optional — riders record what they have.

| Field | Type | Description |
|-------|------|-------------|
| `temp_c` | number \| null | Ambient air temperature in °C |
| `humidity_pct` | number \| null | Relative humidity 0–100% |
| `track_temp_c` | number \| null | Track surface temperature in °C |
| `wind_kph` | number \| null | Wind speed in km/h (≥ 0) |
| `condition` | enum \| null | `dry` \| `damp` \| `wet` \| `mixed` |
| `notes` | string \| null | Free-text (fog, crosswind, oil flags, etc.) |

---

## session.schema.json

Track sessions, append-only setup snapshots, and the setting change log.

### Session

A single on-track session within a track event.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | ✓ | Unique session identifier |
| `event_id` | uuid | ✓ | Parent track event |
| `user_id` | uuid | ✓ | Rider |
| `session_type` | enum | ✓ | `practice` \| `qualifying` \| `race` \| `trackday` |
| `manual_best_lap_ms` | integer \| null | | Best lap in ms — rider-entered fallback |
| `csv_best_lap_ms` | integer \| null | | Best lap in ms — from CSV logger (displayed preferentially) |
| `tire_front` | TireSnapshot \| null | | Front tire spec at session start |
| `tire_rear` | TireSnapshot \| null | | Rear tire spec at session start |
| `rider_feedback` | string \| null | | Free-text notes used as AI context |
| `voice_note_url` | string (uri) \| null | | Blob storage URL of audio note |
| `created_at` | date-time | ✓ | Creation timestamp |
| `updated_at` | date-time | ✓ | Last modification timestamp |

### TireSnapshot

Tire specification at session time (embedded in Session as `tire_front` / `tire_rear`).

| Field | Type | Description |
|-------|------|-------------|
| `brand` | string \| null | Manufacturer (e.g. Pirelli, Dunlop) |
| `compound` | string \| null | Compound designation (e.g. SC1, SC2, Medium) |
| `laps` | integer \| null | Laps on this tire at session start |

### SetupSnapshot

Immutable snapshot of suspension settings at a point in time. Append-only — never updated.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | ✓ | Unique snapshot identifier |
| `session_id` | uuid | ✓ | Parent session |
| `settings` | SuspensionSpec | ✓ | Full suspension spec at snapshot time |
| `created_at` | date-time | ✓ | Snapshot timestamp — defines ordering |

### ChangeLog

A single setting change made during or between sessions. Provides AI with structured change history.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | ✓ | Unique entry identifier |
| `session_id` | uuid | ✓ | Parent session |
| `parameter` | string | ✓ | Parameter name (e.g. `front.compression`, `rear.rebound`) |
| `from_value` | string \| null | | Previous value; null if not recorded |
| `to_value` | string | ✓ | New value |
| `rationale` | string \| null | | Why the change was made |
| `applied_at` | date-time | ✓ | When the change was applied |

---

## telemetry.schema.json

20Hz telemetry data points, lap segments, and ingestion jobs. Stored in TimescaleDB.

### TelemetryPoint

A single 20Hz sample from an AiM or compatible logger. 13 core channels as real columns; overflow into `extra_channels` JSONB.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `time` | date-time | ✓ | Sample timestamp — TimescaleDB partition key |
| `session_id` | uuid | ✓ | Parent session |
| `gps_speed` | number \| null | | GPS-derived speed in km/h |
| `throttle_pos` | number \| null | | Throttle position 0–100% |
| `rpm` | number \| null | | Engine RPM |
| `gear` | integer \| null | | Current gear (0 = neutral) |
| `lean_angle` | number \| null | | Lean angle in degrees (negative = left) |
| `front_brake_psi` | number \| null | | Front brake line pressure in PSI |
| `rear_brake_psi` | number \| null | | Rear brake line pressure in PSI |
| `fork_position` | number \| null | | Front fork position in mm from full extension |
| `shock_position` | number \| null | | Rear shock position in mm from full extension |
| `coolant_temp` | number \| null | | Engine coolant temperature in °C |
| `oil_temp` | number \| null | | Engine oil temperature in °C |
| `lat` | number \| null | | GPS latitude in decimal degrees (−90 to 90) |
| `lon` | number \| null | | GPS longitude in decimal degrees (−180 to 180) |
| `extra_channels` | object | | Additional channels keyed by canonical name (after alias resolution) |

### LapSegment

Computed lap boundary data. `session_id + lap_number` is unique.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | ✓ | Unique identifier |
| `session_id` | uuid | ✓ | Parent session |
| `lap_number` | integer (≥ 1) | ✓ | Sequential lap number within session |
| `start_time_ms` | integer | ✓ | Lap start offset in ms from file start |
| `end_time_ms` | integer | ✓ | Lap end offset in ms from file start |
| `lap_time_ms` | integer | ✓ | Total lap duration in ms |
| `beacon_start_s` | number \| null | | Physical beacon start time in seconds; null = GPS-computed |
| `beacon_end_s` | number \| null | | Physical beacon end time in seconds; null = GPS-computed |
| `created_at` | date-time | ✓ | Computed and stored timestamp |

### IngestionJob

Tracks state of an async ingestion job (CSV, OCR, or voice).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | ✓ | Job identifier — used in SSE stream URL |
| `session_id` | uuid | ✓ | Target session |
| `source` | enum | ✓ | `csv` \| `ocr` \| `voice` |
| `status` | enum | ✓ | `pending` \| `processing` \| `complete` \| `failed` |
| `result` | object \| null | | Parsed output; shape varies by source |
| `error_message` | string \| null | | Error description if status is `failed` |
| `confidence` | number \| null | | OCR/voice confidence score 0–1; null for CSV |
| `created_at` | date-time | ✓ | File upload timestamp |
| `completed_at` | date-time \| null | | Completion or failure timestamp |

---

## ai.schema.json

AI-generated suggestions, per-change tracking, and generation jobs.

### Suggestion

A Claude-generated suspension tuning suggestion for a session.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | ✓ | Unique suggestion identifier |
| `session_id` | uuid | ✓ | Target session |
| `user_id` | uuid | ✓ | Requesting rider |
| `suggestion_text` | string | ✓ | Full reasoning text from Claude — streamed via SSE |
| `changes` | SuggestionChange[] | | Individual parameter changes for tracking |
| `created_at` | date-time | ✓ | Creation timestamp |

### SuggestionChange

A single parameter change within a suggestion. Junction record between a suggestion and rider outcome.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | ✓ | Unique identifier |
| `suggestion_id` | uuid | ✓ | Parent suggestion |
| `parameter` | string | ✓ | Parameter name (e.g. `front.compression`) |
| `suggested_value` | string | ✓ | Value Claude recommended |
| `symptom` | string \| null | | Handling symptom this change addresses |
| `confidence` | number \| null | | Rules engine confidence score 0–1 |
| `applied_status` | enum | ✓ | `not_applied` \| `applied` \| `applied_modified` \| `skipped` (default: `not_applied`) |
| `actual_value` | string \| null | | Value the rider actually set; populated when `applied_modified` |
| `outcome_lap_delta_ms` | integer \| null | | Lap time change in ms; negative = improvement |
| `applied_at` | date-time \| null | | When rider acted on this change; null if `not_applied` |
| `created_at` | date-time | ✓ | Record creation timestamp |

### GenerationJob

Tracks state of an async AI suggestion generation job.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | ✓ | Job identifier — used in SSE stream URL |
| `session_id` | uuid | ✓ | Target session |
| `status` | enum | ✓ | `pending` \| `processing` \| `streaming` \| `complete` \| `failed` |
| `error_message` | string \| null | | Error description if status is `failed` |
| `created_at` | date-time | ✓ | Job creation timestamp |
| `completed_at` | date-time \| null | | Completion or failure timestamp |

**Generation job lifecycle:**
```
pending → processing → streaming → complete
                    ↘            ↗
                      failed
```

---

## progress.schema.json

Suggestion efficacy outcomes stored in the `core` schema.

### EfficacyStats

Records the measured lap time outcome for an applied AI suggestion. `suggestion_id` is a cross-schema reference to `ai.suggestions(id)` — no database FK, validated at the application layer.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | uuid | ✓ | Unique efficacy record identifier |
| `user_id` | uuid | ✓ | Rider whose outcome this captures |
| `suggestion_id` | uuid | ✓ | Cross-schema ref to `ai.suggestions(id)` — no DB FK |
| `lap_delta_ms` | integer \| null | | Net lap time change in ms; negative = improvement |
| `recorded_at` | date-time | ✓ | Outcome recording timestamp |

---

## task-payloads.schema.json

Redis task queue message payloads. Both queues use `LPUSH` / `BRPOP` on Redis Lists.

### IngestionJobPayload — queue: `dialed:ingestion`

Published when a file upload triggers an ingestion job.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `job_id` | uuid | ✓ | Matches `telemetry.ingestion_jobs(id)` |
| `session_id` | uuid | ✓ | Target session |
| `user_id` | uuid | ✓ | Requesting user — for auth checks in worker |
| `source` | enum | ✓ | `csv` \| `ocr` \| `voice` |
| `file_path` | string | ✓ | Absolute path to uploaded file on shared storage |
| `created_at` | date-time | ✓ | Enqueue timestamp — used for stale-job sweeps |

### AiJobPayload — queue: `dialed:ai`

Published when a suggestion generation request is received.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `job_id` | uuid | ✓ | Matches `ai.generation_jobs(id)` |
| `session_id` | uuid | ✓ | Target session — worker fetches all context via Core API |
| `user_id` | uuid | ✓ | Requesting user — forwarded in inter-service HTTP calls |
| `created_at` | date-time | ✓ | Enqueue timestamp — used for stale-job sweeps |
