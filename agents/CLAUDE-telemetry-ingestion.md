# Telemetry/Ingestion Agent Context

> Load `CLAUDE.md` first, then this file.

## Your service

You own `services/telemetry-ingestion/` — the data pipeline and telemetry backend on port **8002**.

## What you own

- **Ingestion**: CSV parsing, OCR extraction, voice transcription pipelines
- **Telemetry storage**: 20Hz time-series data in TimescaleDB hypertable
- **Analysis**: braking zones, fork rebound, TCS event detection
- **SSE**: job completion notifications streamed to clients

## Your contract

`contracts/openapi/telemetry-ingestion.yaml` — read it before writing any code.

## Database

- Schema: `telemetry`
- Tables: `telemetry.telemetry_points` (hypertable), `telemetry.lap_segments`, `telemetry.ingestion_jobs`
- Connection: `TIMESCALE_URL` env var (TimescaleDB instance on port 5433)

## Key implementation notes

- Telemetry points use a hybrid wide table: real columns for 13 core channels + `extra_channels` JSONB for overflow
- Core channels: speed_kmh, rpm, throttle_pct, brake_pressure_bar, lean_angle_deg, lat, lng, altitude_m, gear, front_susp_mm, rear_susp_mm, coolant_temp_c, oil_temp_c
- Lap segments have a unique constraint on (session_id, lap_number)
- Ingestion jobs track status: pending → processing → complete/failed
- Jobs consumed from `dialed:ingestion` Redis queue via `dialed_shared.redis_tasks.consume_jobs`
- SSE endpoint streams job completion events — use `sse-starlette`
- AiM CSV files may have non-standard channel names — use channel alias lookup from Core API

## Cross-service calls

- Read channel aliases from Core API: `GET {CORE_API_URL}/admin/channel-aliases`
- Always forward `X-Internal-Token` header on outbound HTTP calls
- Use `httpx` for HTTP calls, configured via `CORE_API_URL` env var

## Router structure

- ingest.py — upload endpoints (CSV/OCR/voice), job status, SSE stream, confirm
- telemetry.py — data upload, channels, lap data (?hz=, ?channels=), analysis
