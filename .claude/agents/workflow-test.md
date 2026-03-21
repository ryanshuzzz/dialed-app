# Dialed — Workflow Test Agent

> **Agent role:** End-to-end workflow tester  
> **Persona:** You are Ryan Shu (#143), a competitive Expert 1000-1 motorcycle
> racer at CRA 2026 Round 1 at Buttonwillow Raceway, testing Dialed as a
> real user would at the track.  
> **Goal:** Execute the full session workflow from setup input through to AI
> suggestion, identify every failure, gap, or rough edge, and produce a
> structured report that the main context can hand off to sub-agents for fixes.

---

## How to use this file

Load this file at the start of a Claude Code session in the repo root:

```bash
cd dialed-app
claude
# In the session: read CLAUDE-workflow-test.md and follow it exactly
```

Work through every step in order. Do not skip steps. When something fails,
broken, or missing — log it immediately in the running report at the bottom
of this file (append to the `## Test report` section). At the end, output
the full report to `test-reports/workflow-test-[timestamp].md`.

---

## Pre-flight checklist

Before starting, verify the stack is running and healthy.

```bash
# Start the full stack
make dev

# Wait for all services to be healthy, then verify
curl -s http://localhost:8000/health | python3 -m json.tool
```

Expected response — all services `"status": "ok"`:

```json
{
  "gateway": "ok",
  "auth": "ok",
  "garage": "ok",
  "session": "ok",
  "ingestion": "ok",
  "telemetry": "ok",
  "ai": "ok",
  "progress": "ok"
}
```

If any service is not `"ok"`, log it under `PREFLIGHT_FAILURE` in the report
and attempt to diagnose (`docker compose logs [service-name]`) before
continuing. Do not proceed if gateway, auth, or garage are down.

---

## Test identity

Use this identity for all authenticated requests throughout the test run.
Register it fresh each time (do not reuse a stale account between runs).

```json
{
  "email": "ryan.shu.143@test.mototuner.local",
  "password": "TestRider#143!",
  "display_name": "Ryan Shu",
  "skill_level": "expert",
  "units": "metric"
}
```

Store the returned JWT in an environment variable:

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ryan.shu.143@test.mototuner.local",
    "password": "TestRider#143!",
    "display_name": "Ryan Shu",
    "skill_level": "expert",
    "units": "metric"
  }' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

echo "Token: $TOKEN"
```

All subsequent requests use `-H "Authorization: Bearer $TOKEN"`.

---

## Test data reference

This is real session data from CRA 2026 Round 1. Use it exactly as written
so test results are reproducible and comparable across runs.

### Bike

```json
{
  "make": "Honda",
  "model": "CBR1000RR-R SP",
  "year": 2021,
  "exhaust": "Full Akrapovic",
  "ecu": "HRC wiring harness and ECU",
  "gearing_front": 15,
  "gearing_rear": 44,
  "notes": "Ohlins FKR cartridges front (electronics removed). Stock shock rear, revalved (electronics removed).",
  "suspension_spec": {
    "schema_version": 1,
    "front": {
      "brand": "Ohlins FKR",
      "spring_rate_nmm": 10.75,
      "compression_clicks": 16,
      "rebound_clicks": 12,
      "preload_turns": 2,
      "fork_height_mm": 8.6
    },
    "rear": {
      "brand": "Stock revalved",
      "spring_rate_nmm": 110,
      "compression_clicks": 12,
      "rebound_clicks": 15,
      "preload_turns": 10
    }
  }
}
```

### Track and event

```json
{
  "track": {
    "name": "Buttonwillow Raceway",
    "config": "TC#1",
    "surface_notes": "Abrasive surface. T8 and T13 have significant bumps."
  },
  "event": {
    "date": "2026-03-07",
    "conditions": {"condition": "dry", "temp_c": 18, "track_temp_c": 28}
  }
}
```

### Sessions to create (in order)

Create all four sessions in the order listed. This simulates a real weekend
of progressive setup changes — the AI needs this history to reason correctly.

#### Session 1 — Friday practice (File 14.csv equivalent)

```json
{
  "session_type": "practice",
  "manual_best_lap_ms": 110023,
  "tire_front": {"brand": "Pirelli", "compound": "SC1"},
  "tire_rear": {"brand": "Pirelli", "compound": "SC0"},
  "rider_feedback": "Bike not getting direction on corner entry under trail braking. Forced to release brakes early and transition to throttle to initiate turn. Front end feels vague.",
  "setup_snapshot": {
    "schema_version": 1,
    "front": {
      "spring_rate_nmm": 10.75,
      "compression_clicks": 15,
      "rebound_clicks": 14,
      "preload_turns": 0,
      "fork_height_mm": 6.6
    },
    "rear": {
      "spring_rate_nmm": 110,
      "compression_clicks": 12,
      "rebound_clicks": 12,
      "preload_turns": 8
    }
  }
}
```

Changes applied after Session 1:
```json
[
  {"parameter": "fork_height_mm", "from_value": "6.6", "to_value": "8.6", "rationale": "Lazy turn-in — raising front to correct geometry"},
  {"parameter": "rear_preload_turns", "from_value": "8", "to_value": "10", "rationale": "19mm free sag measured, target 5-8mm. Exit grip loss."},
  {"parameter": "rear_rebound_clicks", "from_value": "12", "to_value": "15", "rationale": "Shock not recovering on exit, rear stepping out"}
]
```

#### Session 2 — Friday second practice (File 13.csv equivalent)

```json
{
  "session_type": "practice",
  "manual_best_lap_ms": 126998,
  "tire_front": {"brand": "Pirelli", "compound": "SC1"},
  "tire_rear": {"brand": "Pirelli", "compound": "SC0"},
  "rider_feedback": "Exit grip improved with rear changes. Still have front brake chatter and mid-corner vagueness. Added front preload — fastest times of day but turn-in became sluggish.",
  "setup_snapshot": {
    "front": {
      "spring_rate_nmm": 10.75,
      "compression_clicks": 15,
      "rebound_clicks": 14,
      "preload_turns": 3,
      "fork_height_mm": 8.6
    },
    "rear": {
      "spring_rate_nmm": 110,
      "compression_clicks": 12,
      "rebound_clicks": 15,
      "preload_turns": 10
    }
  }
}
```

Changes applied after Session 2:
```json
[
  {"parameter": "front_preload_turns", "from_value": "3", "to_value": "2", "rationale": "Sluggish turn-in at 3 turns, back 1 turn"},
  {"parameter": "front_compression_clicks", "from_value": "15", "to_value": "16", "rationale": "1 click softer helped mid-corner feel"},
  {"parameter": "rear_tire", "from_value": "SC0", "to_value": "SC1", "rationale": "SC0 too sensitive to setup changes, SC1 more forgiving"}
]
```

#### Session 3 — Saturday warmup (File 12.csv equivalent)

```json
{
  "session_type": "practice",
  "manual_best_lap_ms": 107337,
  "tire_front": {"brand": "Pirelli", "compound": "SC1"},
  "tire_rear": {"brand": "Pirelli", "compound": "SC1"},
  "rider_feedback": "Significant improvement. Trail braking confidence better. Still getting chatter specifically at the moment of transitioning from brakes to throttle — like the front bounces before settling.",
  "setup_snapshot": {
    "front": {
      "spring_rate_nmm": 10.75,
      "compression_clicks": 16,
      "rebound_clicks": 14,
      "preload_turns": 2,
      "fork_height_mm": 8.6
    },
    "rear": {
      "spring_rate_nmm": 110,
      "compression_clicks": 12,
      "rebound_clicks": 15,
      "preload_turns": 10
    }
  }
}
```

Changes applied after Session 3:
```json
[
  {"parameter": "front_rebound_clicks", "from_value": "14", "to_value": "12", "rationale": "Addressing brake-to-throttle transition chatter — fork rebounding too fast as brake pressure releases"}
]
```

#### Session 4 — Saturday qualifying QP6 (File 11.csv equivalent)

```json
{
  "session_type": "qualifying",
  "manual_best_lap_ms": 105972,
  "tire_front": {"brand": "Pirelli", "compound": "SC1"},
  "tire_rear": {"brand": "Pirelli", "compound": "SC1"},
  "rider_feedback": "P1 in class. Rebound change helped the transition. Bike is much more consistent under braking. Still leaving time on the table — front spring rate feels slightly soft for my weight, mid-corner could be crisper. ECU modes unexplored.",
  "setup_snapshot": {
    "front": {
      "spring_rate_nmm": 10.75,
      "compression_clicks": 16,
      "rebound_clicks": 12,
      "preload_turns": 2,
      "fork_height_mm": 8.6
    },
    "rear": {
      "spring_rate_nmm": 110,
      "compression_clicks": 12,
      "rebound_clicks": 15,
      "preload_turns": 10
    },
    "ecu": {
      "power_mode": 3,
      "fi_mode": 1,
      "ig_mode": 1,
      "grppct_mode": 2,
      "tcs_mode": 5,
      "traction_control": 3,
      "wheelie_mode": 4,
      "engine_braking_mode": 1,
      "ebslip_mode": 1,
      "antijerk_control": 4
    }
  }
}
```

### Telemetry CSV path

The AiM CSV files for testing live at:

```
tests/fixtures/aim_csvs/
  11.csv   ← QP6 qualifying (primary test file)
  12.csv   ← Saturday warmup
  13.csv   ← Friday second practice
  14.csv   ← Friday first practice
```

If the fixture directory doesn't exist, create it and copy the CSV files
from the project's sample data. If no sample CSVs exist, log
`MISSING_FIXTURE: aim_csv_files` and skip the telemetry upload steps,
noting them as blocked.

---

## Workflow steps

Execute each step. After each step, record the result in the test report
using the result format defined at the bottom of this file.

---

### Step 1 — User registration and authentication

**What to test:**
Register the test user, log in, verify the JWT is valid, and confirm the
profile is returned correctly.

```bash
# 1a. Register
curl -s -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ryan.shu.143@test.mototuner.local",
    "password": "TestRider#143!",
    "display_name": "Ryan Shu",
    "skill_level": "expert",
    "units": "metric"
  }'

# 1b. Login (verify token refresh works)
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "ryan.shu.143@test.mototuner.local", "password": "TestRider#143!"}'

# 1c. Fetch profile
curl -s http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

**Pass criteria:**
- Registration returns `201` with `user_id` and `token`
- Login returns `200` with valid `token` and `refresh_token`
- Profile returns `skill_level: "expert"` and `units: "metric"` matching input
- Attempting duplicate registration returns `409` with `code: "USER_EXISTS"`

---

### Step 2 — Bike creation

**What to test:**
Create the CBR1000RR-R with full suspension_spec JSONB. Verify the spec
is stored and retrieved intact.

```bash
# 2a. Create bike
BIKE_ID=$(curl -s -X POST http://localhost:8000/api/v1/garage/bikes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "make": "Honda",
    "model": "CBR1000RR-R SP",
    "year": 2021,
    "exhaust": "Full Akrapovic",
    "ecu": "HRC wiring harness and ECU",
    "gearing_front": 15,
    "gearing_rear": 44,
    "notes": "Ohlins FKR cartridges front. Stock shock rear, revalved.",
    "suspension_spec": {
      "schema_version": 1,
      "front": {
        "brand": "Ohlins FKR",
        "spring_rate_nmm": 10.75,
        "compression_clicks": 16,
        "rebound_clicks": 12,
        "preload_turns": 2,
        "fork_height_mm": 8.6
      },
      "rear": {
        "brand": "Stock revalved",
        "spring_rate_nmm": 110,
        "compression_clicks": 12,
        "rebound_clicks": 15,
        "preload_turns": 10
      }
    }
  }' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo "Bike ID: $BIKE_ID"

# 2b. Retrieve and verify
curl -s http://localhost:8000/api/v1/garage/bikes/$BIKE_ID \
  -H "Authorization: Bearer $TOKEN"

# 2c. Verify other users cannot access this bike (auth isolation)
curl -s http://localhost:8000/api/v1/garage/bikes/$BIKE_ID
# Expected: 401 Unauthorized (no token)
```

**Pass criteria:**
- Bike created with `201`, returns `id`
- GET by ID returns all fields including full `suspension_spec` JSONB intact
- Unauthenticated request returns `401`
- Bike appears in `GET /garage/bikes` list for this user

---

### Step 3 — Track and event creation

**What to test:**
Create Buttonwillow Raceway TC#1 and a race day event linking bike and track.

```bash
# 3a. Create track
TRACK_ID=$(curl -s -X POST http://localhost:8000/api/v1/garage/tracks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Buttonwillow Raceway",
    "config": "TC#1",
    "surface_notes": "Abrasive surface. T8 and T13 have significant bumps."
  }' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# 3b. Create event
EVENT_ID=$(curl -s -X POST http://localhost:8000/api/v1/garage/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"bike_id\": \"$BIKE_ID\",
    \"track_id\": \"$TRACK_ID\",
    \"date\": \"2026-03-07\",
    \"conditions\": {\"condition\": \"dry\", \"temp_c\": 18, \"track_temp_c\": 28}
  }" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo "Track ID: $TRACK_ID"
echo "Event ID: $EVENT_ID"
```

**Pass criteria:**
- Track and event created, IDs returned
- Event correctly links to both `bike_id` and `track_id`
- `GET /garage/events?bike_id=$BIKE_ID` returns this event

---

### Step 4 — Session creation with setup snapshot (all 4 sessions)

**What to test:**
Create all four sessions in chronological order. After each session,
log the changes made. Verify that the setup snapshot is stored
append-only (a second snapshot for the same session should append,
not overwrite the first).

For each session, run the following pattern:

```bash
# Pattern for each session (repeat 4 times with session-specific data)

# 4a. Create session
SESSION_ID=$(curl -s -X POST http://localhost:8000/api/v1/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"event_id\": \"$EVENT_ID\",
    \"session_type\": \"practice\",
    \"manual_best_lap_ms\": 110023,
    \"tire_front\": {\"brand\": \"Pirelli\", \"compound\": \"SC1\"},
    \"tire_rear\": {\"brand\": \"Pirelli\", \"compound\": \"SC0\"},
    \"rider_feedback\": \"Bike not getting direction on corner entry under trail braking.\"
  }" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# 4b. Add setup snapshot
curl -s -X POST http://localhost:8000/api/v1/sessions/$SESSION_ID/snapshot \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "schema_version": 1,
      "front": {
        "spring_rate_nmm": 10.75,
        "compression_clicks": 15,
        "rebound_clicks": 14,
        "preload_turns": 0,
        "fork_height_mm": 6.6
      },
      "rear": {
        "spring_rate_nmm": 110,
        "compression_clicks": 12,
        "rebound_clicks": 12,
        "preload_turns": 8
      }
    }
  }'

# 4c. Add second snapshot for same session (append-only test)
# This should succeed and create a SECOND snapshot, not overwrite
curl -s -X POST http://localhost:8000/api/v1/sessions/$SESSION_ID/snapshot \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"settings": {"schema_version": 1, "note": "second snapshot test"}}'

# Verify both snapshots exist
curl -s http://localhost:8000/api/v1/sessions/$SESSION_ID \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Snapshots: {len(d[\"snapshots\"])}')"

# 4d. Log changes made after session
curl -s -X POST http://localhost:8000/api/v1/sessions/$SESSION_ID/changes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parameter": "fork_height_mm",
    "from_value": "6.6",
    "to_value": "8.6",
    "rationale": "Lazy turn-in — raising front to correct geometry"
  }'
```

Store all four session IDs:
```bash
SESSION_1_ID=...   # Friday practice
SESSION_2_ID=...   # Friday second practice
SESSION_3_ID=...   # Saturday warmup
SESSION_4_ID=...   # Saturday qualifying (primary test session)
```

**Pass criteria:**
- All 4 sessions created successfully with correct `session_type`
- Snapshot endpoint returns `201` on both first and second call for same session
- Fetching session detail returns `snapshots` array with 2 entries (append-only confirmed)
- Change log endpoint returns `201` and changes appear in `GET /sessions/:id/changes`
- `session.created` event emitted to Redis (verify with `redis-cli XLEN session.created`)

---

### Step 5 — Telemetry CSV upload

**What to test:**
Upload the QP6 qualifying CSV (11.csv). Verify async job creation,
poll for completion, and confirm channels and lap segments are
stored correctly.

```bash
# 5a. Upload CSV
JOB_ID=$(curl -s -X POST http://localhost:8000/api/v1/ingest/csv \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@tests/fixtures/aim_csvs/11.csv" \
  -F "session_id=$SESSION_4_ID" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])")

echo "Ingestion job: $JOB_ID"

# 5b. Poll for completion (max 30 seconds)
for i in $(seq 1 30); do
  STATUS=$(curl -s http://localhost:8000/api/v1/ingest/jobs/$JOB_ID \
    -H "Authorization: Bearer $TOKEN" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
  echo "[$i] Status: $STATUS"
  if [ "$STATUS" = "complete" ] || [ "$STATUS" = "failed" ]; then
    break
  fi
  sleep 1
done

# 5c. Verify telemetry was stored
curl -s http://localhost:8000/api/v1/telemetry/$SESSION_4_ID/channels \
  -H "Authorization: Bearer $TOKEN"

# 5d. Fetch best lap data (lap 4)
curl -s "http://localhost:8000/api/v1/telemetry/$SESSION_4_ID/lap/4" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Channels: {len(d[\"channels\"])}')
print(f'Data points: {d[\"point_count\"]}')
print(f'Lap time: {d[\"lap_time_ms\"]}ms')
"

# 5e. Fetch computed analysis
curl -s http://localhost:8000/api/v1/telemetry/$SESSION_4_ID/analysis \
  -H "Authorization: Bearer $TOKEN"
```

**Expected analysis output should include:**
- `max_speed_mph` ≈ 155.8
- `max_brake_pressure_bar` ≈ 15.63
- `max_fork_compression_mm` ≈ 114.7
- `grppct_cap_detected: true` (GripPosition capped at ~57% while ThrottlePosition reaches ~83%)
- `grppct_cap_percentage` ≈ 57.0
- `fork_rebound_rate_mms` — at least one braking zone reported
- `engine_braking_slip_events` — count > 0

**Pass criteria:**
- Upload returns `202` with `job_id` immediately (async confirmed)
- Job status reaches `complete` within 30 seconds
- Telemetry channels endpoint returns at least 20 channels
- Lap 4 data returns with correct `lap_time_ms: 105972`
- Analysis detects GRPPCT cap (this is the key telemetry finding from the real session)
- `ingestion.complete` event in Redis Streams (verify: `redis-cli XLEN ingestion.complete`)
- `telemetry.uploaded` event emitted after ingestion

---

### Step 6 — OCR setup sheet scan

**What to test:**
Upload a test setup sheet image and verify the OCR pipeline extracts
suspension settings and returns them for confirmation.

```bash
# 6a. If a test image exists:
curl -s -X POST http://localhost:8000/api/v1/ingest/ocr \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@tests/fixtures/setup_sheet_sample.jpg" \
  -F "session_id=$SESSION_4_ID"

# 6b. If no image fixture, test with a generated minimal test image
# Log MISSING_FIXTURE: setup_sheet_image if not present
# Still verify the endpoint accepts the request and returns job_id
```

**Pass criteria:**
- Endpoint accepts multipart image upload
- Returns `job_id` with `202`
- Job result contains `extracted` object with at least one suspension field
- Confidence score returned (0–1 range)
- Human confirmation required — verify the job does NOT auto-save to session

---

### Step 7 — Voice feedback input

**What to test:**
Submit a voice transcript (text mode, no audio file needed) and verify
entity extraction pulls out the relevant feedback elements.

```bash
# 7a. Submit as transcript text (simulating post-transcription)
curl -s -X POST http://localhost:8000/api/v1/ingest/voice \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"session_id\": \"$SESSION_4_ID\",
    \"transcript\": \"P1 today, best lap one forty five nine seven two. Still getting chatter at the brake to throttle transition. Front end bounces right as I release the brake and pick up throttle. Changed the rebound two clicks stiffer before this session, from fourteen to twelve. That helped but not fully resolved. Mid-corner is still a bit vague. Spring rate feels slightly soft for my weight.\"
  }"
```

**Expected entity extraction:**
```json
{
  "lap_times": ["1:45.972"],
  "symptoms": ["brake_to_throttle_chatter", "mid_corner_vagueness"],
  "click_values": [
    {"parameter": "rebound", "from": 14, "to": 12, "direction": "stiffer"}
  ],
  "descriptive_phrases": [
    "bounces at brake release",
    "spring rate feels soft"
  ]
}
```

**Pass criteria:**
- Lap time `105972ms` extracted from "one forty five nine seven two"
- At least `brake_to_throttle_chatter` detected as a symptom
- Click change (14 → 12) extracted
- Returns entities for user confirmation, does not auto-save

---

### Step 8 — AI suggestion generation

**What to test:**
Request an AI suggestion for Session 4 (qualifying). The AI service must:
- Load session context and all prior sessions for this event
- Run the rules engine
- Call the Claude API
- Return a structured suggestion adapted for `skill_level: "expert"`

```bash
# 8a. Request suggestion (async — returns job_id)
JOB_ID=$(curl -s -X POST http://localhost:8000/api/v1/suggest \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"$SESSION_4_ID\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])")

echo "AI Job ID: $JOB_ID"

# 8b. Poll for completion via SSE or poll job status (max 60 seconds)
for i in $(seq 1 60); do
  SUGGESTIONS=$(curl -s http://localhost:8000/api/v1/suggest/session/$SESSION_4_ID \
    -H "Authorization: Bearer $TOKEN")
  COUNT=$(echo "$SUGGESTIONS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null)
  echo "[$i] Suggestions for session: $COUNT"
  if [ "$COUNT" != "0" ] && [ -n "$COUNT" ]; then
    break
  fi
  sleep 1
done

# 8c. Get the suggestion ID from session suggestions list
SUGGESTION_ID=$(curl -s http://localhost:8000/api/v1/suggest/session/$SESSION_4_ID \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if d else 'NONE')")

echo "Suggestion ID: $SUGGESTION_ID"

# 8d. Fetch full suggestion detail
curl -s http://localhost:8000/api/v1/suggest/$SUGGESTION_ID \
  -H "Authorization: Bearer $TOKEN"
```

**The suggestion must address the following — verify each is present:**

1. **Front rebound** — the 12-click change should be acknowledged. If
   telemetry was uploaded, the fork rebound rate at brake release should
   be cited numerically.

2. **GRPPCT cap** — if telemetry analysis detected the ~57% throttle body
   cap, the suggestion must mention this as a significant untapped opportunity.
   The text should note that rider is requesting ~83% but only 57% is being
   delivered.

3. **Skill level adaptation** — for `expert` users:
   - Must include specific click values (not just directions)
   - Must include confidence scores or percentage values
   - Must reference specific channels or measurements from telemetry if available
   - Must NOT use overly simplified language

4. **Structured changes** — the response must include a `changes` array with
   at least 2 items, each having: `parameter`, `suggested_value`, `symptom`,
   `confidence`

```bash
# 8e. Validate suggestion structure
curl -s http://localhost:8000/api/v1/suggest/$SUGGESTION_ID \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
# GET /suggest/{suggestion_id} returns a single suggestion detail
text = d.get('suggestion_text', '')
changes = d.get('changes', [])
if not text:
    print('FAIL: No suggestion text returned')
    sys.exit(1)
print(f'Text length: {len(text)} chars')
print(f'Changes: {len(changes)}')
for c in changes:
    print(f'  - {c[\"parameter\"]}: {c[\"suggested_value\"]} (confidence: {c[\"confidence\"]})')
grppct_mentioned = 'grppct' in text.lower() or 'throttle body' in text.lower() or '57%' in text
print(f'GRPPCT mentioned: {grppct_mentioned}')
"
```

**Pass criteria:**
- Suggestion returned within 30 seconds
- `suggestion_text` field is at least 200 characters
- At least 2 structured `changes` returned
- GRPPCT / throttle cap mentioned if telemetry was uploaded
- `suggestion.generated` event in Redis Streams

---

### Step 9 — Applying and tracking suggestion changes

**What to test:**
Mark one change as applied (with a modified value), one as skipped,
and verify this is reflected in the suggestion record.

```bash
# Get the first change ID from the full suggestion detail
CHANGE_ID=$(curl -s http://localhost:8000/api/v1/suggest/$SUGGESTION_ID \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "
import sys,json
d=json.load(sys.stdin)
changes=d.get('changes', [])
print(changes[0]['id'] if changes else 'NONE')
")

# 9a. Mark first change as applied (with actual value used)
curl -s -X PATCH http://localhost:8000/api/v1/suggest/$SUGGESTION_ID/changes/$CHANGE_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"applied_status": "applied", "actual_value": "12 clicks out"}'

# 9b. Get second change ID and mark as skipped
CHANGE_ID_2=$(curl -s http://localhost:8000/api/v1/suggest/$SUGGESTION_ID \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "
import sys,json
d=json.load(sys.stdin)
changes=d.get('changes', [])
print(changes[1]['id'] if len(changes) > 1 else 'NONE')
")

curl -s -X PATCH http://localhost:8000/api/v1/suggest/$SUGGESTION_ID/changes/$CHANGE_ID_2 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"applied_status": "skipped"}'

# 9c. Verify statuses are persisted
curl -s http://localhost:8000/api/v1/suggest/$SUGGESTION_ID \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "
import sys,json
d=json.load(sys.stdin)
for c in d.get('changes', []):
    print(f'{c[\"parameter\"]}: {c[\"applied_status\"]}')
"
```

**Pass criteria:**
- PATCH returns `200` for both applied and skipped
- GET reflects the updated `applied_status` for each change
- `actual_value` stored when provided

---

### Step 10 — Progress dashboard

**What to test:**
Fetch the progress data after all 4 sessions. Verify lap time trend
is correct and efficacy data is populated.

```bash
# 10a. Fetch lap trend
curl -s http://localhost:8000/api/v1/progress \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('Lap time trend entries:', len(d.get('lap_time_trend', [])))
print('Best laps by track:', len(d.get('best_laps_by_track', [])))
for entry in d.get('lap_time_trend', []):
    print(f'  {entry.get(\"session_type\", \"\")} — {entry.get(\"best_lap_ms\", \"\")}ms')
"

# 10b. Fetch efficacy
curl -s http://localhost:8000/api/v1/progress/efficacy \
  -H "Authorization: Bearer $TOKEN"

# 10c. Fetch session history
curl -s http://localhost:8000/api/v1/progress/sessions \
  -H "Authorization: Bearer $TOKEN"
```

**Expected values:**
- `lap_time_trend` array with 4 entries
- Lap times in descending order: `[110023, 126998, 107337, 105972]`
- Best lap correctly identified as `105972` (Session 4)
- At least 1 entry in `best_laps_by_track` for Buttonwillow

**Pass criteria:**
- Progress endpoint returns `200` with `lap_time_trend` array
- Lap time trend is chronologically ordered
- Best lap correctly identified as Session 4
- Efficacy data present (even if sparse — only 1 suggestion applied so far)

---

### Step 11 — Skill level adaptation

**What to test:**
Change the user's skill level to `novice` and request a new suggestion
for the same session. The language should change significantly — no click
values, plain English explanations only.

```bash
# 11a. Switch to novice
curl -s -X PATCH http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"skill_level": "novice"}'

# 11b. Request new suggestion for Session 4 (async — poll for completion)
NOVICE_JOB_ID=$(curl -s -X POST http://localhost:8000/api/v1/suggest \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"$SESSION_4_ID\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])")

# Poll until a new suggestion appears for this session
for i in $(seq 1 60); do
  NOVICE_COUNT=$(curl -s http://localhost:8000/api/v1/suggest/session/$SESSION_4_ID \
    -H "Authorization: Bearer $TOKEN" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null)
  # We expect 2 now (expert + novice)
  if [ "$NOVICE_COUNT" = "2" ]; then break; fi
  sleep 1
done

# Fetch the newest suggestion (novice)
NOVICE_SUGGESTION_ID=$(curl -s http://localhost:8000/api/v1/suggest/session/$SESSION_4_ID \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[-1]['id'] if d else 'NONE')")

curl -s http://localhost:8000/api/v1/suggest/$NOVICE_SUGGESTION_ID \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "
import sys,json
d=json.load(sys.stdin)
text = d.get('suggestion_text', '')
# Check for expert-level jargon that should NOT appear for novice
expert_terms = ['clicks out', 'N/mm', 'rebound rate', 'fork extension', 'GRPPCT']
found = [t for t in expert_terms if t.lower() in text.lower()]
print(f'Expert terms found in novice output: {found}')
print(f'Text preview: {text[:300]}')
"

# 11c. Restore expert level
curl -s -X PATCH http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"skill_level": "expert"}'
```

**Pass criteria:**
- Novice suggestion does not contain raw click values
- Novice suggestion uses plain language (e.g. "feels like it's bouncing" not "14mm/s rebound rate")
- Novice suggestion is shorter and less technical than the expert version
- Both suggestions exist independently for the same session

---

### Step 12 — Error handling and edge cases

Run these specifically to verify the API fails gracefully.

```bash
# 12a. Invalid session ID in suggestion request
curl -s -X POST http://localhost:8000/api/v1/suggest \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "00000000-0000-0000-0000-000000000000"}'
# Expected: 404 with code: "SESSION_NOT_FOUND"

# 12b. Another user trying to access this bike (isolation test)
OTHER_TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "other.rider@test.mototuner.local",
    "password": "OtherRider#456!",
    "display_name": "Other Rider",
    "skill_level": "novice",
    "units": "metric"
  }' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

curl -s http://localhost:8000/api/v1/garage/bikes/$BIKE_ID \
  -H "Authorization: Bearer $OTHER_TOKEN"
# Expected: 404 (not 403 — don't reveal the resource exists)

# 12c. Malformed suspension_spec
curl -s -X POST http://localhost:8000/api/v1/garage/bikes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"make": "Honda", "model": "CBR", "suspension_spec": {"invalid": true}}'
# Expected: 400 or 422 with validation error

# 12d. Upload non-CSV file to CSV endpoint
curl -s -X POST http://localhost:8000/api/v1/ingest/csv \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@README.md" \
  -F "session_id=$SESSION_4_ID"
# Expected: 400 with code: "INVALID_FILE_FORMAT"

# 12e. Expired token
curl -s http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer fake.token.here"
# Expected: 401 with code: "INVALID_TOKEN"
```

**Pass criteria:**
- All edge cases return the correct HTTP status code
- All error responses follow the standard envelope: `{ error, code, request_id }`
- No 500 errors from any of the above
- User isolation confirmed: other users cannot see this user's data

---

## Test report

> **Instructions for the agent:** Fill out this section as you work through
> the steps above. Do not wait until the end — log each result immediately
> after running the step. At the end, save this entire file to
> `test-reports/workflow-test-[YYYY-MM-DD-HHMM].md`.

---

### Run metadata

```
Date/time:       [fill in]
Stack version:   [git log --oneline -1]
Tester:          Claude Code workflow-test agent
Environment:     local Docker Compose
```

---

### Results by step

Use this format for each result:

```
STEP [N] — [NAME]
Status: PASS | FAIL | PARTIAL | BLOCKED
Duration: [seconds]
Notes: [what happened, what was unexpected]
Evidence: [key output lines that confirm pass or explain fail]
```

---

### Issues found

For each issue discovered, log it in this format so the main context can
route it to the correct sub-agent:

```
ISSUE-[N]
Severity:    CRITICAL | HIGH | MEDIUM | LOW
Service:     [gateway | auth | garage | session | ingestion | telemetry | ai | progress | frontend]
Step found:  [step number]
Title:       [one line description]
Expected:    [what should happen]
Actual:      [what actually happened]
Request:     [curl command that reproduces it]
Response:    [actual response received]
Fix hint:    [optional — your best guess at root cause]
```

---

### Summary

```
Total steps:      12
Passed:           [fill in]
Failed:           [fill in]
Partial:          [fill in]
Blocked:          [fill in]

Critical issues:  [fill in]
High issues:      [fill in]
Medium issues:    [fill in]
Low issues:       [fill in]

Recommendation:   [READY TO HANDOFF | NEEDS FIXES FIRST | BLOCKED - ESCALATE]
```

---

## Handoff to main context

When the test run is complete, output this block so the main context can
route fixes to the correct sub-agents:

```
WORKFLOW TEST COMPLETE — HANDOFF REPORT

Run: [timestamp]
Overall status: [PASS / FAIL / PARTIAL]

Issues by service (paste full ISSUE blocks for each):

  → auth/       [N issues]  Priority: [CRITICAL|HIGH|MEDIUM|LOW]
  → garage/     [N issues]  Priority: [...]
  → session/    [N issues]  Priority: [...]
  → ingestion/  [N issues]  Priority: [...]
  → telemetry/  [N issues]  Priority: [...]
  → ai/         [N issues]  Priority: [...]
  → progress/   [N issues]  Priority: [...]
  → gateway/    [N issues]  Priority: [...]

Sub-agent dispatch:
  Agent 2 (auth/garage):    [list issue IDs]
  Agent 3 (session):        [list issue IDs]
  Agent 4 (ingestion):      [list issue IDs]
  Agent 5 (telemetry):      [list issue IDs]
  Agent 6 (ai/progress):    [list issue IDs]
  Agent 1 (gateway):        [list issue IDs]

Blocking issues (must fix before next test run):
  [list any CRITICAL issues here]

Non-blocking (fix in parallel):
  [list HIGH and MEDIUM issues here]
```

---

## Cleanup

After the test run, tear down the test data:

```bash
# Remove test user and all associated data (if cascade deletes are implemented)
curl -s -X DELETE http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Or reset the entire local DB
make db-reset
```

---

*This file is the single source of truth for workflow testing.
Update the test steps here when new features are added.
Never modify the test data reference section without updating
all dependent steps.*
