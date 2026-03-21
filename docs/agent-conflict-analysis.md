# Agent Process Engineering — Conflict Analysis

> Analysis of delegation flows, file access patterns, and potential conflicts across the Dialed agent system.

---

## 1. Agent write-access map

Before tracing flows, here's what each agent can actually modify:

```
┌─────────────────────┬──────────────────────────────────────────────┐
│ Agent               │ Write access                                 │
├─────────────────────┼──────────────────────────────────────────────┤
│ core-api            │ services/core-api/**  ·  shared/**           │
│ telemetry-ingestion │ services/telemetry-ingestion/**  ·  shared/**│
│ ai-service          │ services/ai/**  ·  shared/**                 │
│ frontend            │ frontend/**                                  │
│ ui-ux-designer      │ frontend/**                                  │
│ infra-fixer         │ infra/**  ·  docker-compose*  ·              │
│                     │ services/*/Dockerfile  ·  shared/**           │
│ test-fixer          │ services/*/tests/**  ·  services/*/conftest  │
│                     │ frontend/src/**/*.test.*                      │
│ integration-lead    │ (none — delegates only)                      │
└─────────────────────┴──────────────────────────────────────────────┘
```

---

## 2. Feature modification scenarios

### Scenario A: Add a new field to bikes (e.g., `engine_cc`)

**Flow:**
1. Update `contracts/openapi/core-api.yaml` and `contracts/json-schema/garage.schema.json`
2. Run `make generate-types` → regenerate Python + TypeScript types
3. **core-api** → add column to SQLAlchemy model, Alembic migration, update Pydantic schema, update router
4. **frontend** → update BikeDetail screen, bike form, types
5. **frontend** consults **ui-ux-designer** → where/how to display engine_cc
6. **ui-ux-designer** queries MCP → returns placement recommendation
7. **frontend** implements
8. **test-fixer** → update test assertions for new field

**Conflict: WHO UPDATES THE CONTRACTS?**
No agent owns `contracts/`. The core-api agent can read contracts but cannot write to them. Neither can any other agent. Contract updates are an orphaned responsibility — they must be done manually or by an unscoped agent. If an agent tries to add a field without updating the contract first, it violates the "contract is law" rule.

**Conflict: `shared/` write overlap.**
core-api, telemetry-ingestion, ai-service, AND infra-fixer all have write access to `shared/`. If two agents independently decide `dialed_shared` needs a helper function for the same purpose, they'll write conflicting versions. There's no lock or coordination mechanism.

---

### Scenario B: Redesign the Garage screen

**Flow:**
1. **frontend** receives task "redesign Garage"
2. **frontend** MUST delegate design to **ui-ux-designer** (mandatory rule)
3. **ui-ux-designer** calls MCP tools (search_styles, search_components, search_colors)
4. **ui-ux-designer** writes new component code to `frontend/src/components/garage/`
5. **frontend** integrates the component into `frontend/src/screens/Garage.tsx`

**Conflict: BOTH AGENTS WRITE TO `frontend/**`.**
The ui-ux-designer's instructions say to "Write the actual `.tsx` + Tailwind code" — it has `Write(file_path="frontend/**")` permission. The frontend agent also writes to `frontend/**`. If the ui-ux-designer writes a component file and the frontend agent independently modifies the same file to wire up hooks/state, they'll overwrite each other. There's no merge strategy — the last write wins.

**Conflict: AMBIGUOUS OWNERSHIP OF COMPONENT FILES.**
The ui-ux-designer prompt says "always produce working code — Real `.tsx` files." The frontend prompt says "implement the design the ui-ux-designer provides." Both are told to produce the same artifact. When the ui-ux-designer writes `BikeCard.tsx` with Tailwind styles and the frontend agent rewrites it to add TanStack Query data fetching, the frontend agent may clobber the designer's carefully crafted styles.

---

### Scenario C: Add a new ingestion pipeline (e.g., GPS file format)

**Flow:**
1. Update `contracts/openapi/telemetry-ingestion.yaml`
2. **telemetry-ingestion** → new pipeline module, new router endpoint, worker handler
3. **telemetry-ingestion** calls Core API to fetch channel aliases → needs `X-Internal-Token`
4. **frontend** → new upload option in SessionLogger wizard
5. **frontend** consults **ui-ux-designer** for upload UI
6. **test-fixer** → new tests for pipeline

**Conflict: CROSS-SERVICE SCHEMA CHANGES.**
If the new pipeline requires a new field on `core.sessions` (e.g., `gps_file_best_lap_ms`), the telemetry-ingestion agent cannot modify core-api's models. It must ask integration-lead to delegate to core-api. But the telemetry-ingestion agent's instructions don't mention this escalation path — it only says "never import another service's code." An agent might work around this by making direct SQL calls or adding the field to its own schema, violating the architecture.

---

### Scenario D: Fix a bug where AI suggestions show wrong suspension values

**Flow:**
1. **integration-lead** diagnoses: Core API returns stale setup snapshot, AI service reads it
2. Delegates to **core-api** to fix the snapshot query
3. Delegates to **ai-service** to verify context gathering handles the corrected data
4. Delegates to **test-fixer** to update test assertions

**Conflict: SEQUENTIAL DEPENDENCY WITHOUT COORDINATION.**
The ai-service fix depends on core-api's fix being complete first. But both agents could be spawned in parallel by integration-lead (its instructions say to delegate to each service's expert agent "separately" but don't specify sequential ordering for dependent fixes). If ai-service runs first and tests against the old core-api behavior, its "fix" will be wrong.

---

### Scenario E: Update the shared package (e.g., add a new error code)

**Flow:**
1. Need to add `CONFLICT` error code to `dialed_shared.errors`
2. Multiple agents could initiate this: core-api, telemetry-ingestion, ai-service, or infra-fixer

**Conflict: FOUR AGENTS HAVE WRITE ACCESS TO `shared/**`.**
There is no designated owner of the shared package. All three service agents plus infra-fixer can modify it. If two agents independently add the same error code with slightly different implementations (different HTTP status, different message format), the last write wins silently. The CLAUDE.md says "use dialed_shared — do NOT reimplement" but doesn't say who is responsible for extending it.

---

### Scenario F: Frontend agent redesigns a form, triggers cascading consultations

**Flow:**
1. **frontend** gets task: "add tire pressure logging form to BikeDetail"
2. Must consult **ui-ux-designer** for form design
3. **ui-ux-designer** calls MCP tools, designs the form, writes `TirePressureForm.tsx`
4. **frontend** adds state management, API hooks, validation
5. **frontend** realizes the API response shape doesn't match what the designer assumed → needs to adjust the component
6. Should frontend modify the designer's component directly, or go back to the designer?

**Conflict: NO DEFINED ITERATION PROTOCOL.**
The frontend agent's instructions say: "implement the design the ui-ux-designer provides" and "after implementation, ask the ui-ux-designer to review." But there's no protocol for what happens when the implementation reveals the design doesn't work (API data shape mismatch, missing states, performance issue requiring different component structure). The frontend agent could silently change the design, violating the "never pick a color, font size, spacing value without consulting" rule. Or it could enter an infinite consultation loop.

---

### Scenario G: Integration-lead merges telemetry branch, Docker breaks

**Flow:**
1. **integration-lead** merges telemetry-ingestion branch
2. `docker compose up --build` fails — TimescaleDB connection refused
3. Delegates to **infra-fixer** → fixes docker-compose.yml timing
4. Rebuild succeeds, but telemetry tests fail — CSV parser expects column that was renamed
5. Is this a test problem or a code problem?

**Conflict: AMBIGUOUS TRIAGE BETWEEN test-fixer AND service expert.**
The integration-lead's instructions provide heuristics ("Test assertion failures where the TEST is wrong → test-fixer; Test failures where the CODE is wrong → service expert"). But in practice, many failures are ambiguous. A CSV parser test fails because the test data uses old column names — is the test wrong (it should use new names) or is the code wrong (it should handle both)? The decision requires domain knowledge that neither test-fixer nor the integration-lead necessarily has. Mis-routing wastes a full agent cycle.

---

## 3. Identified conflicts — prioritized

### CRITICAL — Will cause incorrect output

| # | Conflict | Agents involved | Impact |
|---|----------|-----------------|--------|
| C1 | **`frontend/**` dual-write** — both frontend and ui-ux-designer write to the same directory with no coordination mechanism | frontend, ui-ux-designer | Last write wins. Designer's carefully crafted styles get overwritten by frontend's hook integration, or vice versa. Produces broken or visually incorrect components. |
| C2 | **`shared/**` four-way write** — four agents can modify the shared package independently | core-api, telemetry, ai-service, infra-fixer | Conflicting implementations of the same utility. Silent data loss on concurrent edits. Broken imports across all services. |
| C3 | **Contract ownership gap** — no agent can write to `contracts/` | All agents | Contract-first rule cannot be enforced. Agents either work without updating contracts (violating the core rule) or get stuck. |

### HIGH — Will cause wasted work or process failures

| # | Conflict | Agents involved | Impact |
|---|----------|-----------------|--------|
| H1 | **No iteration protocol for design ↔ implementation** — what happens when implementation reveals the design doesn't fit | frontend, ui-ux-designer | Infinite consultation loops, or frontend silently diverges from design. Either way, one agent's work is wasted. |
| H2 | **Parallel agent spawning without dependency ordering** — integration-lead can spawn dependent fixes simultaneously | integration-lead + any two service agents | Second agent builds on stale assumptions. Its fix is wrong on arrival and must be redone. |
| H3 | **Ambiguous triage for test failures** — "is the test wrong or the code wrong" requires domain judgment the router doesn't have | integration-lead, test-fixer, service experts | Mis-routed tickets waste a full agent execution cycle. Test-fixer may "fix" a test to match broken code. |

### MEDIUM — Creates friction or inconsistency

| # | Conflict | Agents involved | Impact |
|---|----------|-----------------|--------|
| M1 | **ui-ux-designer told to produce "working code" AND "the frontend agent will handle implementation"** — contradictory deliverables | frontend, ui-ux-designer | Unclear who writes the final component file. Duplicated effort. |
| M2 | **Cross-service schema changes have no escalation path** — telemetry agent needs a field on core.sessions but can't modify it | telemetry, core-api | Agent gets stuck or works around the constraint, violating architecture rules. |
| M3 | **infra-fixer can edit `shared/`** — infrastructure agent modifying Python library code | infra-fixer vs service agents | Infra-fixer could make shared package changes that break service-level assumptions. Its scope description says "never change application code" but shared/ is application code. |
| M4 | **test-fixer has no MCP or Agent tool** — cannot consult anyone when uncertain about domain intent | test-fixer (isolated) | Must make judgment calls about what the "correct" behavior is, with only contract files as reference. If contracts are ambiguous, it guesses. |
| M5 | **No agent owns `Makefile`, `README.md`, `CLAUDE.md`, or docs/** — meta-project files have no steward | All agents | Documentation drift. Make targets go stale. Agent context files become outdated as the codebase evolves. |

---

## 4. Recommended fixes

### For C1 (frontend/designer dual-write):

**Establish a clear file-level split.** The ui-ux-designer should write to a staging area or only produce design specs (not files). Better: restrict the designer to write only `frontend/src/components/ui/**` (primitives) and have the frontend agent own all screen-level and composed component files. Or remove `Write`/`Edit` permissions from the designer entirely and make it advisory-only — it returns Tailwind class strings, color values, and component structures in its response, and the frontend agent writes all files.

### For C2 (shared/ four-way write):

**Designate a single shared-package owner.** The core-api agent is the most natural choice since it owns the most foundational code. All other agents should request shared package changes through integration-lead, who delegates to core-api. Remove `Edit(file_path="shared/**")` from telemetry-ingestion, ai-service, and infra-fixer.

### For C3 (contract ownership gap):

**Add contract write permissions to a designated agent**, or create a new `contract-manager` agent. Alternatively, give integration-lead write access to `contracts/` since it orchestrates cross-service changes. At minimum, add `Edit(file_path="contracts/**")` to integration-lead's allowedTools.

### For H1 (design iteration protocol):

**Define a three-pass protocol in both agent files:**
1. **Pass 1 (designer):** Research + produce a design spec (component tree, props, Tailwind classes, states) — NOT code files
2. **Pass 2 (frontend):** Implement the spec as working React code, flag any data/API mismatches
3. **Pass 3 (designer):** Review the implementation, approve or request changes with specific diffs

### For H2 (parallel dependency):

**Add explicit sequencing rules to integration-lead.** When a fix spans two services, always complete the upstream fix first (core-api → telemetry → ai), verify it passes, then start the downstream fix. Add this to the delegation rules section.

### For H3 (ambiguous triage):

**Give test-fixer the Agent tool** so it can consult the relevant service expert when unsure. Or require integration-lead to always provide a preliminary diagnosis ("I believe the test is wrong because the contract says X") rather than routing blindly.

### For M3 (infra-fixer + shared/):

**Remove `shared/**` from infra-fixer's write permissions.** Its description says "never change application code" — `shared/` is application code. If infrastructure changes require a shared package update, infra-fixer should report back to integration-lead who delegates to core-api.

---

## 5. Delegation flow diagrams

### Current flow (with conflicts marked ⚠️)

```
User request
    │
    ▼
integration-lead (opus, read-only, delegates everything)
    │
    ├─── code bug in service ──► service expert agent
    │                               ├── writes services/<name>/**
    │                               └── writes shared/** ⚠️ C2
    │
    ├─── infra issue ──────────► infra-fixer
    │                               ├── writes infra/**, docker-compose*
    │                               └── writes shared/** ⚠️ C2, M3
    │
    ├─── test failure ─────────► test-fixer ⚠️ H3 (ambiguous routing)
    │                               └── writes tests only
    │
    ├─── frontend work ────────► frontend agent
    │       │                       └── writes frontend/** ⚠️ C1
    │       │
    │       └── design question ──► ui-ux-designer
    │               │                   ├── calls ui-ux-pro MCP
    │               │                   └── writes frontend/** ⚠️ C1, M1
    │               │
    │               └── (no iteration protocol) ⚠️ H1
    │
    └─── contract change ──────► ??? ⚠️ C3 (no owner)
```

### Recommended flow (conflicts resolved)

```
User request
    │
    ▼
integration-lead (opus, delegates everything)
    │
    ├─── contract change ──────► integration-lead writes contracts/ ✓
    │       │
    │       └── make generate-types
    │
    ├─── code bug in service ──► service expert agent
    │                               └── writes services/<name>/** only
    │
    ├─── shared pkg change ────► core-api (sole owner of shared/) ✓
    │
    ├─── infra issue ──────────► infra-fixer
    │                               └── writes infra/**, Dockerfiles only ✓
    │
    ├─── test failure ─────────► test-fixer (now has Agent tool)
    │       │                       └── can consult service expert ✓
    │       └── preliminary diagnosis from integration-lead ✓
    │
    └─── frontend work ────────► frontend agent
            │                       └── sole writer of frontend/** ✓
            │
            └── design question ──► ui-ux-designer (advisory only)
                    ├── calls ui-ux-pro MCP
                    └── returns spec (not files) ✓
                            │
                            ├── Pass 1: design spec
                            ├── Pass 2: frontend implements
                            └── Pass 3: designer reviews ✓
```
