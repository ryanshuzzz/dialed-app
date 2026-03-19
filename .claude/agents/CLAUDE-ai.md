---
name: ai-service
description: Agent for the Dialed AI service — suggestion generation, rules engine, SSE streaming, change tracking, and Claude API integration.
---

# Agent: AI

> Read `CLAUDE.md` (master context) first. This file has your service-specific instructions.

## Your scope

You own the `ai` service. It handles:

1. **Suggestion generation** — receives async job requests via the `dialed:ai` Redis queue, gathers context from Core API and Telemetry, runs the rules engine, calls Claude API, and streams the suggestion to the client via SSE.
2. **Rules engine** — deterministic suspension analysis using decision trees, geometry correlators, and telemetry pattern detection.
3. **Suggestion storage** — persists generated suggestions and their individual structured changes in the `ai` schema.
4. **Change tracking** — PATCH endpoints for marking individual suggestion changes as applied/skipped/modified and recording outcome lap deltas.

## Your contract

```
contracts/openapi/ai.yaml
```

Read it before writing any code.

## Database

Schema: `ai`

Three tables:

- **`ai.suggestions`** — one row per generated suggestion. Contains `suggestion_text` (full natural language), linked to `session_id` and `user_id`.
- **`ai.suggestion_changes`** — junction table. One row per individual recommended change within a suggestion. Tracks `parameter`, `suggested_value`, `symptom`, `confidence`, `applied_status` (enum: `not_applied`, `applied`, `applied_modified`, `skipped`), `actual_value`, and `outcome_lap_delta_ms`.
- **`ai.generation_jobs`** — job state tracking. Status enum: `pending`, `processing`, `streaming`, `complete`, `failed`.

## Suggestion generation flow

When a job arrives from the `dialed:ai` queue:

### 1. Gather context from Core API

Make these HTTP calls (all with `X-Internal-Token`):

```
GET {CORE_API_URL}/sessions/:session_id
  → session detail including rider_feedback, tire info, best lap times

GET {CORE_API_URL}/sessions/:session_id/changes
  → change log for this session (what the rider already adjusted)

GET {CORE_API_URL}/garage/bikes/:bike_id
  → bike detail including suspension_spec

GET {CORE_API_URL}/garage/bikes/:bike_id/maintenance
  → recent maintenance (for context: is the bike freshly serviced?)

GET {CORE_API_URL}/sessions?event_id=:event_id
  → other sessions from the same event (progression within the day)
```

Optionally, if telemetry exists:
```
GET {TELEMETRY_URL}/telemetry/:session_id/analysis
  → computed metrics (braking zones, fork rebound, traction patterns)
```

### 2. Run the rules engine

The rules engine is deterministic — it does not call Claude. It produces a list of flagged symptoms with confidence scores and suggested deltas. Three modules:

- **suspension_tree.py** — decision tree mapping rider complaints to suspension adjustments. Input: rider_feedback text, current suspension_spec, change_log. Output: list of `{ symptom, parameter, suggested_delta, confidence }`.
- **geometry_correlator.py** — correlates bike geometry (gearing, ride height from suspension_spec) with track characteristics. Input: bike spec, track data, conditions. Output: geometry-based flags.
- **telemetry_patterns.py** — analyses telemetry metrics (if available). Input: analysis results from Telemetry service. Output: data-driven flags (e.g., "excessive fork bottoming in T4", "late throttle pickup sector 2").

Merge all flags, deduplicate, sort by confidence descending.

### 3. Build the prompt and call Claude

Construct a system prompt containing:
- Rider skill level and type
- Bike specs (suspension_spec)
- Current session context (type, conditions, rider feedback)
- Change history for this session
- Progression within the event (if multiple sessions)
- Rules engine flags with confidence scores
- Telemetry analysis summary (if available)

Call Claude API (claude-sonnet-4-6) with **streaming enabled**:
```python
async with anthropic_client.messages.stream(
    model="claude-sonnet-4-6",
    system=system_prompt,
    messages=[{"role": "user", "content": user_prompt}],
    max_tokens=2000
) as stream:
    async for text in stream.text_stream:
        # Forward each chunk to SSE
```

**Token budget:** If the assembled context exceeds ~6000 tokens, truncate older session data first (keep only current session + most recent prior session). Summarize change_log entries older than the current event into a single paragraph. Never truncate the current session's data or the rules engine flags.

### 4. Parse and store

After streaming completes:
1. Parse the full response to extract structured changes (top 3 recommended adjustments)
2. Insert one `ai.suggestions` row
3. Insert one `ai.suggestion_changes` row per structured change
4. Update `ai.generation_jobs` status → `complete`

## SSE endpoint

`GET /suggest/:job_id/stream` — Server-Sent Events endpoint.

Stream the suggestion text as Claude generates it:
```
event: chunk
data: {"text": "Based on your feedback about the front end..."}

event: chunk
data: {"text": " I recommend three changes:\n\n1. "}

...

event: complete
data: {"suggestion_id": "...", "changes": [{...}, {...}, {...}]}
```

On failure:
```
event: failed
data: {"error": "..."}
```

Use `sse-starlette`. The client connects before job processing starts. Update job status to `streaming` when the first chunk is sent.

## Change tracking endpoints

- `PATCH /suggest/:suggestion_id/changes/:change_id` — rider marks a change as `applied`, `applied_modified` (with `actual_value`), or `skipped`. Sets `applied_at` timestamp.
- `PATCH /suggest/:suggestion_id/changes/:change_id/outcome` — after the next session, record `outcome_lap_delta_ms` for this specific change.

These are simple CRUD updates — no async processing needed.

## Redis task queue

**Queue name:** `dialed:ai`

**Consume** jobs using `dialed_shared.redis_tasks.consume_jobs("dialed:ai", handler)`.

Expected payload:
```json
{
  "job_id": "uuid",
  "session_id": "uuid",
  "user_id": "uuid",
  "created_at": "ISO 8601"
}
```

## Inter-service calls

All calls use `httpx` async client with `X-Internal-Token` forwarded:

- Core API: session detail, change log, bike detail, maintenance, event sessions
- Telemetry: session analysis (optional — gracefully handle if no telemetry exists)

Use `httpx.AsyncClient` with a reasonable timeout (10s for Core API, 30s for Telemetry analysis). If Telemetry is unavailable, generate the suggestion without telemetry data — do not fail the job.

## File structure

```
services/ai/
  main.py
  models/
    suggestion.py
    suggestion_change.py
    generation_job.py
  rules_engine/
    suspension_tree.py
    geometry_correlator.py
    telemetry_patterns.py
  llm/
    prompt_builder.py      ← assembles system prompt from gathered context
    skill_adapter.py       ← adapts language to rider skill level
    response_parser.py     ← extracts structured changes from Claude response
  worker.py                ← Redis queue consumer
  sse.py                   ← SSE endpoint handlers
  schemas/
  routers/
    suggest.py
  services/
    suggestion_service.py  ← orchestrates gather → rules → Claude → store
    context_gatherer.py    ← HTTP calls to Core API + Telemetry
  alembic/
  tests/
  Dockerfile
  requirements.txt
```

## Testing priorities

1. Rules engine decision trees (known inputs → expected flags)
2. Prompt builder output (verify all context sections are included, token budget respected)
3. Response parser (extract structured changes from various Claude response formats)
4. Token truncation logic (verify oldest data is dropped first, current session preserved)
5. SSE streaming (mock Claude streaming, verify chunks forwarded correctly)
6. Change tracking CRUD (applied_status transitions, outcome recording)
7. Graceful degradation when Telemetry service is unavailable
8. Job state machine (pending → processing → streaming → complete/failed)
