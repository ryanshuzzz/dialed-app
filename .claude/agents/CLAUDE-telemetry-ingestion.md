---
name: telemetry-ingestion
description: Agent for the Dialed Telemetry/Ingestion service — CSV/OCR/voice ingestion pipelines, TimescaleDB hypertable, downsampling, analysis (braking zones, fork rebound, TCS), and SSE job completion.
allowedTools:
  - Edit(file_path="services/telemetry-ingestion/**")
  - Write(file_path="services/telemetry-ingestion/**")
---

# Agent: Telemetry/Ingestion

> Read `CLAUDE.md` (master context) first. This file has your service-specific instructions.

## Your scope

You own the `telemetry-ingestion` service. It handles two responsibilities:

1. **Ingestion pipelines** — async processing of CSV telemetry files, OCR setup sheet photos, and voice note transcriptions. Jobs arrive via the `dialed:ingestion` Redis queue. Notify clients via SSE when jobs complete.
2. **Telemetry storage and analysis** — bulk insert of 20Hz channel data into TimescaleDB, lap segment management, downsampling, channel filtering, and computed analysis metrics (braking zones, fork rebound, traction control detection).

## Your contract

```
contracts/openapi/telemetry-ingestion.yaml
```

Read it before writing any code.

## Databases

You use two database connections:

- **`DATABASE_URL`** → shared Postgres, `telemetry` schema. Used for `ingestion_jobs` and `lap_segments` tables.
- **`TIMESCALE_URL`** → TimescaleDB instance, `telemetry` schema. Used for the `telemetry_points` hypertable.

Both use the `telemetry` schema prefix. Set up the hypertable in your Alembic migration:
```sql
SELECT create_hypertable('telemetry.telemetry_points', 'time');
```

## Telemetry data shape

The `telemetry_points` table is a **hybrid wide table**:

**Real columns for core channels** (fast cross-channel queries):
`gps_speed`, `throttle_pos`, `rpm`, `gear`, `lean_angle`, `front_brake_psi`, `rear_brake_psi`, `fork_position`, `shock_position`, `coolant_temp`, `oil_temp`, `lat`, `lon`

**JSONB overflow** for non-core channels:
`extra_channels jsonb DEFAULT '{}'`

When ingesting CSV data, map columns to core channel names first (using channel aliases from Core API). Any channel that doesn't map to a core column goes into `extra_channels`.

## Channel aliasing

AiM CSV exports use different column names across logger versions. Before processing any CSV:

1. Fetch the channel alias lookup table from Core API: `GET {CORE_API_URL}/admin/channel-aliases`
2. Map raw CSV column headers to canonical names using the alias table
3. Map canonical names to telemetry_points columns (core channels) or extra_channels (everything else)

Cache the alias table per job — don't fetch it for every row.

## Ingestion pipeline details

### CSV pipeline
1. Parse the CSV headers, map columns via channel aliases
2. Detect lap boundaries (beacon/GPS triggers)
3. Bulk insert telemetry_points rows (batch insert, not row-by-row)
4. Create lap_segments entries
5. Extract best lap time → will be written back to the session's `csv_best_lap_ms` via Core API
6. Emit SSE completion event with summary: channels found, lap count, duration, best lap

### OCR pipeline
1. Send the setup sheet photo to Claude Vision (claude-sonnet-4-6)
2. Extract suspension settings as structured JSON
3. Return extracted settings + confidence score
4. Emit SSE completion event — **always requires user confirmation** before saving

### Voice pipeline
1. Send audio to OpenAI Whisper API for transcription
2. Extract structured entities from the transcript (rider feedback, setting mentions)
3. Return entities + confidence score
4. Emit SSE completion event — **always requires user confirmation** before saving

### Confirmation flow
All three pipelines follow the same confirmation pattern:
- Job completes → SSE sends parsed results to client
- Client displays results for user review
- User confirms → `POST /ingest/jobs/:id/confirm` → service writes confirmed data to the session via Core API

## Redis task queue

**Queue name:** `dialed:ingestion`

**Consume** jobs using `dialed_shared.redis_tasks.consume_jobs("dialed:ingestion", handler)`.

Expected payload:
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

**Worker lifecycle:**
1. Pick job from queue
2. Update `ingestion_jobs` row: status → `processing`
3. Run the appropriate pipeline
4. Update `ingestion_jobs` row: status → `complete` (or `failed`), write result/error
5. Send SSE event to any listening client on `GET /ingest/jobs/:id/stream`

## SSE endpoint

`GET /ingest/jobs/:id/stream` — Server-Sent Events endpoint.

Use `sse-starlette` to implement. The client connects before or during job processing. When the job completes (or fails), send a single event:

```
event: complete
data: {"job_id": "...", "status": "complete", "result": {...}}

-- or on failure --
event: failed
data: {"job_id": "...", "status": "failed", "error": "..."}
```

Close the SSE connection after sending the terminal event.

## Analysers

The analysis endpoint (`GET /telemetry/:session_id/analysis`) runs computed metrics on stored telemetry data:

- **braking_zones.py** — identify braking points by lap, measure consistency
- **fork_rebound.py** — analyse fork compression/rebound patterns for suspension tuning
- **tcs_detector.py** — detect traction control intervention events from throttle/RPM patterns

These read from the hypertable and return computed JSON. They do not modify stored data.

## Downsampling

`GET /telemetry/:session_id/lap/:n?hz=10` — return data downsampled from 20Hz to the requested rate.

Use TimescaleDB's `time_bucket` function for efficient server-side downsampling:
```sql
SELECT time_bucket('100ms', time) AS bucket, avg(gps_speed), avg(throttle_pos), ...
FROM telemetry.telemetry_points
WHERE session_id = :sid AND time BETWEEN :start AND :end
GROUP BY bucket ORDER BY bucket;
```

## Inter-service calls

- `GET {CORE_API_URL}/admin/channel-aliases` — fetch alias table during CSV ingestion
- `PATCH {CORE_API_URL}/sessions/:id` — write `csv_best_lap_ms` after CSV processing
- Forward the `X-Internal-Token` from the original request on all inter-service calls

## File structure

```
services/telemetry-ingestion/
  main.py
  models/
    telemetry_point.py
    lap_segment.py
    ingestion_job.py
  pipelines/
    csv_parser.py
    ocr_pipeline.py
    voice_pipeline.py
  analysers/
    braking_zones.py
    fork_rebound.py
    tcs_detector.py
  worker.py            ← Redis queue consumer, runs in a separate process/thread
  sse.py               ← SSE endpoint handlers
  schemas/
  routers/
    ingest.py
    telemetry.py
  services/
    ingestion_service.py
    telemetry_service.py
    analysis_service.py
  alembic/
  tests/
  Dockerfile
  requirements.txt
```

## Testing priorities

1. CSV parser with different AiM logger column formats + alias mapping
2. Lap boundary detection (beacon triggers, edge cases)
3. Bulk insert performance (verify batching, not row-by-row)
4. Downsampling accuracy (time_bucket output matches expected)
5. SSE event delivery (mock client receives completion event)
6. Job state machine transitions (pending → processing → complete/failed)
7. OCR/voice confidence thresholds and result structure
