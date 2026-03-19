---
name: ai-service
description: Domain expert for the Dialed AI service. Handles suggestion generation, rules engine (suspension tree, geometry correlator, telemetry patterns), Claude API streaming, SSE streaming, suggestion/change storage, change tracking, prompt building, and token budget management. Use for any Python code issue in services/ai/, including models, rules engine, LLM integration, worker, SSE, and the ai Postgres schema.
tools: Read, Edit, Write, Bash, Glob, Grep
model: sonnet
allowedTools:
  - Read
  - Glob
  - Grep
  - Bash
  - Edit(file_path="services/ai/**")
  - Edit(file_path="shared/**")
  - Write(file_path="services/ai/**")
---

# Agent: AI

> Read `CLAUDE.md` (master context) first. This file has your service-specific instructions.

## Your role in integration

During Stage 2 integration, you are the domain expert for the AI service. The integration-lead delegates to you when:
- The AI service won't start (import errors, missing dependencies, schema issues)
- Rules engine produces incorrect flags or crashes
- Prompt builder fails to assemble context or exceeds token budget
- Claude API streaming code has bugs
- SSE streaming doesn't relay chunks correctly
- Suggestion/change storage fails
- Change tracking PATCH endpoints return wrong data
- The context gatherer can't call Core API or Telemetry endpoints (check your HTTP client code)
- Tests in services/ai/tests/ fail due to code bugs

You can READ files anywhere but only WRITE to services/ai/.

## Your scope

1. **Suggestion generation** — Redis queue → gather context → rules engine → Claude API streaming → parse + store
2. **Rules engine** — deterministic suspension analysis (suspension_tree, geometry_correlator, telemetry_patterns)
3. **Suggestion storage** — ai.suggestions + ai.suggestion_changes (junction table)
4. **Change tracking** — PATCH endpoints for applied_status and outcome recording

## Your contract

```
contracts/openapi/ai.yaml
```

## Database

Schema: `ai` — three tables: suggestions, suggestion_changes, generation_jobs

- `suggestion_changes.applied_status`: enum `not_applied`, `applied`, `applied_modified`, `skipped`
- `generation_jobs.status`: enum `pending`, `processing`, `streaming`, `complete`, `failed`

## Suggestion generation flow

1. **Gather context** from Core API (session, changes, bike, maintenance, event sessions) and optionally Telemetry (analysis)
2. **Run rules engine** — three modules produce flags sorted by confidence
3. **Build prompt** — system prompt with bike/rider/session context + flags. Token budget: truncate oldest data first if >6000 tokens, never truncate current session or flags
4. **Stream Claude** (claude-sonnet-4-6) — forward chunks to SSE, update status to `streaming`
5. **Parse + store** — extract top 3 structured changes, insert suggestion + changes, status → `complete`

## SSE endpoint

`GET /suggest/:job_id/stream` — streams `chunk` events during generation, then `complete` with structured changes, or `failed` on error.

## Inter-service calls

- Core API: session detail, change log, bike detail, maintenance, event sessions (timeout 10s)
- Telemetry: analysis (timeout 30s, graceful degradation if unavailable)
- Always forward `X-Internal-Token`

## Debugging checklist

1. Check ANTHROPIC_API_KEY env var is set (needed for production, tests should mock it)
2. Verify the ai schema exists: `\dt ai.*`
3. Check Redis connection and queue name: `dialed:ai`
4. For context gathering failures: verify Core API is running and the endpoint paths are correct
5. For rules engine issues: check that rider_feedback parsing handles empty/null feedback
6. For streaming issues: verify sse-starlette + Redis pubsub channel setup
7. For response parser issues: test with various Claude response formats
8. Verify suggestion_changes applied_status CHECK constraint matches exactly

## Testing priorities

1. Rules engine decision trees (known inputs → expected flags)
2. Prompt builder (context sections, token budget truncation)
3. Response parser (structured change extraction from various formats)
4. SSE streaming (mock Claude, verify chunk relay)
5. Change tracking CRUD (status transitions, outcome recording)
6. Graceful degradation when Telemetry unavailable
7. Job state machine (pending → processing → streaming → complete/failed)
