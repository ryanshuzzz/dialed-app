# Contract-first: unified track + road rides

## What shipped in contracts (v1.1)

- **`contracts/json-schema/event.schema.json`** — `EventVenue`, `RideLocation` / `RideLocationSource`, `Event`, `CreateEventRequest`, `UpdateEventRequest`. Road rides use `venue: road`, `track_id: null`, and `ride_location`; track days use `venue: track` and `track_id`.
- **`contracts/json-schema/session.schema.json`** — `session_type` adds `road`, `commute`, `tour`; optional `ride_metrics` (`distance_km`, `duration_ms`, `fuel_used_l`, `odometer_km`, `fuel_efficiency_l_per_100km`); `TireSnapshot.pressure_kpa`.
- **`contracts/openapi/core-api.yaml`** (v **1.1.0**) — Same shapes as components; `GET /garage/events` gains `venue`; `GET /sessions` gains `bike_id`, `venue` (join via event). Summaries updated for track + road.

## Server rules (implement in core-api)

1. **Create event** — If `venue` omitted: default `track` when `track_id` is set; default `road` when `ride_location` is set without `track_id`; else `422` or default `track` (pick one and document).
2. **Consistency** — `venue === track` ⇒ `track_id` non-null. `venue === road` ⇒ `ride_location` should have at least `label` or non-empty `sources` (validate leniently in v1).
3. **Create session** — `session_type` must match event: track events only `practice|qualifying|race|trackday`; road events only `road|commute|tour`.
4. **Migration** — Existing `core.events` rows: backfill `venue = 'track'`, keep `track_id` as today.

## Generated types

- Run `./infra/scripts/generate-types.sh` (requires Python **&lt; 3.14** for `datamodel-codegen` today).
- `contracts/generated/typescript/event.ts` — hand-imports `Conditions` from `./conditions` to avoid duplicate barrel exports; **re-apply that hunk** after regenerating TS from schema.

## Frontend

- `frontend/src/api/types.ts` aligned with OpenAPI for events/sessions.
- MSW `events.ts` seeds `venue: 'track'` and infers venue on create.

## Next implementation order (still contract-first discipline)

1. **Alembic** (core schema only): `events` add `venue`, nullable `track_id`, `ride_location` JSONB; backfill; NOT NULL `venue` after backfill.
2. **Sessions** table: add `ride_metrics` JSONB; extend `session_type` check constraint / enum.
3. **Pydantic** routers — models from `contracts/generated/python` (or mirror until codegen fixed on 3.14).
4. **Gateway** — no path changes if routes unchanged.
5. **UI** — unified logger: branch on `venue`, same detail panels, wire `ride_metrics` + `ride_location`.

## Public access: Cloudflare Tunnel

Use **Cloudflare Tunnel** (`cloudflared`) when you need the stack reachable on the internet without opening router ports (demos, QA on real phones, stakeholder reviews). Typical pattern:

1. Run the full stack locally (or on a small VM) as today.
2. Install [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) and authenticate to your Cloudflare account.
3. Create **one tunnel per surface you need public**, or a single tunnel with multiple **public hostnames** pointing at local ports:
   - **Frontend (Vite)** — e.g. `https://dialed-dev.example.com` → `http://localhost:5173` (or the port Vite actually binds).
   - **Gateway** — e.g. `https://dialed-api-dev.example.com` → `http://localhost:8000` so the browser can call the API from a phone on LTE.

**Contract / config implications**

- Set **`VITE_GATEWAY_URL`** (and any OAuth redirect URLs if used) to the **public gateway hostname**, not `localhost`, for builds or dev sessions that are exercised through the tunnel.
- Gateway **CORS** must allow the tunnelled **frontend origin**.
- Treat tunnel URLs as **non-production** unless you harden with Cloudflare Access, rate limits, and secrets rotation.

Document chosen hostnames and env vars in `infra/` or `.env.example` when you standardize on a team tunnel.

## Mobile app (not required for v1 — part of the roadmap)

The product is a **React (web) PWA** today. A native shell is achievable without rewriting the product immediately. Plan for mobile in parallel with backend/contract work; **no mobile deliverable is required to ship the unified ride contract**.

**Recommended directions (pick one primary; the other can stay a fallback)**

| Approach | Fits Dialed today because… | Tradeoffs |
|----------|----------------------------|-----------|
| **Capacitor** (wrap existing Vite app) | Reuses almost all of `frontend/` — same components, TanStack Query, router patterns; PWA already in tree. | WebView quirks; tune safe areas, keyboard, deep links; keep bundle lean. |
| **Expo (React Native)** | Shared **TypeScript types** from `contracts/generated/typescript` and same REST contract; new UI layer. | Rebuild screens or share a thin “design system” package; more upfront work. |

**Cross-cutting practices (whichever path)**

- **API**: Same OpenAPI contract; mobile clients use the **gateway** URL (including tunnelled dev URLs when testing on device).
- **Auth**: Plan token storage (secure storage on native vs web) and refresh flows early.
- **Offline**: Align with existing offline-queue ideas in the web app for “log a ride at the track.”
- **Release**: Internal TestFlight / Play internal testing before store listing.

**Suggested phasing**

1. **Now–near term** — Responsive PWA + tunnel for real-device testing; document `VITE_GATEWAY_URL` for tunnelled API.
2. **Next** — Capacitor spike: wrap production build, one E2E flow (login → garage), fix viewport/safe-area.
3. **Later** — Optional Expo slice if you need tighter native UX (widgets, background GPS) beyond Capacitor.

## Related plans

- **GitHub CI** — `.github/workflows/ci.yml` and **`plans/ci-github.md`** (frontend + service pytest; Phase 2 for OpenAPI drift checks and Docker smoke).
- **Web E2E / user-flow testing** — **`plans/frontend-e2e-web-agent.md`** (Playwright journeys, CI job design, MSW vs full stack).

## Out of scope for this contract slice

- GPX geometry storage (use `RideLocation.sources[].ref` to blob ids in a later spec).
- Automatic “miles since oil” (derive from `odometer_km` + `maintenance` logs in app layer).
- Renaming `TrackEvent` type in TS (kept for minimal churn; alias to `Event` later if desired).
