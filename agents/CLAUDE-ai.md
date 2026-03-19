# AI Agent Context

> Load `CLAUDE.md` first, then this file.

## Your service

You own `services/ai/` — the AI suggestion engine on port **8003**.

## What you own

- **Rules engine**: evaluates session data against tuning rules to build prompts
- **Claude API integration**: sends prompts, streams responses
- **Suggestion storage**: persists generated suggestions and individual changes
- **Change tracking**: tracks which changes riders apply, skip, or modify
- **SSE**: token-by-token streaming of suggestions as Claude generates them

## Your contract

`contracts/openapi/ai.yaml` — read it before writing any code.

## Database

- Schema: `ai`
- Tables: `ai.suggestions`, `ai.suggestion_changes`, `ai.generation_jobs`
- Connection: `DATABASE_URL` env var

## Key implementation notes

- Generation jobs track status: pending → processing → streaming → complete/failed
- Jobs consumed from `dialed:ai` Redis queue via `dialed_shared.redis_tasks.consume_jobs`
- Use the `anthropic` Python SDK to call Claude API (`ANTHROPIC_API_KEY` env var)
- SSE streams suggestion text token-by-token as Claude generates it — use `sse-starlette`
- Each suggestion contains multiple changes; each change is tracked individually
- Change applied_status: not_applied, applied, applied_modified, skipped
- Changes can record actual_value (what the rider actually set) and outcome_lap_delta_ms

## Cross-service calls

- Read session data from Core API: `GET {CORE_API_URL}/sessions/{id}`
- Read bike data from Core API: `GET {CORE_API_URL}/garage/bikes/{id}`
- Always forward `X-Internal-Token` header on outbound HTTP calls
- Use `httpx` for HTTP calls, configured via `CORE_API_URL` env var

## Router structure

- suggest.py — POST request (→202), GET SSE stream, GET by session, GET detail, PATCH change status, PATCH change outcome
