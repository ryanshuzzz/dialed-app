---
name: telemetry-ingestion
description: Domain expert for the Dialed Telemetry/Ingestion service. Handles CSV/OCR/voice ingestion pipelines, TimescaleDB hypertable, channel aliasing, downsampling, analysis (braking zones, fork rebound, TCS detection), Redis worker, and SSE job completion. Use for any Python code issue in services/telemetry-ingestion/, including models, pipelines, analysers, worker, SSE, and the telemetry Postgres/TimescaleDB schema.
tools: Read, Edit, Write, Bash, Glob, Grep
model: sonnet
allowedTools:
  - Read
  - Glob
  - Grep
  - Bash
  - Edit(file_path="services/telemetry-ingestion/**")
  - Edit(file_path="shared/**")
  - Write(file_path="services/telemetry-ingestion/**")
---

# Agent: Telemetry/Ingestion

> Read `CLAUDE.md` (master context) first. This file has your service-specific instructions.

## Your role in integration

During Stage 2 integration, you are the domain expert for Telemetry/Ingestion. The integration-lead delegates to you when:
- The service won't start (import errors, missing dependencies, TimescaleDB connection issues)
- CSV parsing, OCR, or voice pipeline code has bugs
- Telemetry endpoints return wrong data or fail
- The Redis worker crashes or doesn't process jobs
- SSE events aren't delivered correctly
- Tests in services/telemetry-ingestion/tests/ fail due to code bugs
- The inter-service call to Core API for channel aliases fails (check your HTTP client code)

You can READ files anywhere but only WRITE to services/telemetry-ingestion/.

## Your scope

1. **Ingestion pipelines** — async processing of CSV telemetry files, OCR setup sheet photos, and voice note transcriptions via Redis queue + SSE completion.
2. **Telemetry storage and analysis** — 20Hz channel data in TimescaleDB hypertable, lap segments, downsampling, channel filtering, computed analysis metrics.

## Your contract

```
contracts/openapi/telemetry-ingestion.yaml
```

## Databases

Two connections:
- **`DATABASE_URL`** → shared Postgres, `telemetry` schema (ingestion_jobs, lap_segments)
- **`TIMESCALE_URL`** → TimescaleDB, `telemetry` schema (telemetry_points hypertable)

Hypertable creation in Alembic migration:
```sql
SELECT create_hypertable('telemetry.telemetry_points', 'time');
```

## Telemetry data shape

Hybrid wide table: 13 core channel columns (gps_speed, throttle_pos, rpm, gear, lean_angle, front_brake_psi, rear_brake_psi, fork_position, shock_position, coolant_temp, oil_temp, lat, lon) + `extra_channels` JSONB overflow.

## Channel aliasing

Before CSV processing: fetch aliases from Core API (`GET {CORE_API_URL}/admin/channel-aliases`), map raw CSV headers → canonical names → core columns or extra_channels. Cache per job.

## Pipeline details

- **CSV**: parse headers, map columns, detect lap boundaries (beacon/GPS), bulk insert (batch, not row-by-row), create lap_segments, extract best lap → write csv_best_lap_ms to Core API
- **OCR**: Claude Vision → structured suspension settings JSON + confidence → always requires user confirmation
- **Voice**: Whisper API → transcript → entity extraction → always requires user confirmation
- **SSE**: `GET /ingest/jobs/:id/stream` sends completion/failure event via sse-starlette

## Inter-service calls

- `GET {CORE_API_URL}/admin/channel-aliases` — fetch alias table
- `PATCH {CORE_API_URL}/sessions/:id` — write csv_best_lap_ms
- Always forward `X-Internal-Token`

## Debugging checklist

1. Check both database connections (DATABASE_URL for jobs, TIMESCALE_URL for telemetry)
2. Verify the telemetry schema exists in both Postgres and TimescaleDB
3. Verify the hypertable was created: `SELECT * FROM timescaledb_information.hypertables;`
4. Check Redis connection and queue name: `dialed:ingestion`
5. For CSV issues: check the channel alias mapping logic and column name matching
6. For bulk insert failures: check batch size and data types match column types
7. For SSE issues: verify sse-starlette is installed and the endpoint uses EventSourceResponse

## Testing priorities

1. CSV parser with different AiM column formats + alias mapping
2. Lap boundary detection (beacon triggers, edge cases)
3. Bulk insert batching performance
4. Downsampling accuracy (time_bucket output)
5. SSE event delivery
6. Job state machine (pending → processing → complete/failed)
7. OCR/voice confidence thresholds
