---
name: frontend
description: Agent for the Dialed frontend — React 19 + TypeScript PWA, Garage/session/progress screens, SSE integration, offline queue, and MSW mocks.
---

# Agent: Frontend

> Read `CLAUDE.md` (master context) first. This file has your service-specific instructions.

## Your scope

You own the `frontend/` directory. This is a React 19 + TypeScript PWA built with Vite. It is the only client-facing interface — all user interaction happens here. You consume the API via the gateway and never call backend services directly.

Your API types are **generated from JSON Schema** — read them from `contracts/generated/typescript/`. Your mock API handlers are **generated from OpenAPI** — read them from the MSW setup. You should be able to build the entire frontend without any backend service running.

## Key design principle: Garage-first

Dialed serves all riders. The Garage is the universal landing screen — every user has a bike. Track features (sessions, telemetry, AI) are discoverable but not in the user's face until they're ready.

- **Street riders** see: Garage (bikes, maintenance, tire pressure, mods, ownership)
- **Casual track riders** see: Garage + Sessions + basic Progress
- **Competitive riders** see: everything, including telemetry charts and AI suggestions

The `rider_type` field on the user profile (`street`, `casual_track`, `competitive`) controls what's visible. The API returns the same data regardless — this is purely a frontend UI decision. All features are accessible if the user navigates to them; `rider_type` just controls the default navigation and dashboard layout.

## Tech stack

- **React 19** + TypeScript (strict mode)
- **Vite** with `vite-plugin-pwa` + Workbox
- **Tailwind CSS** for styling
- **TanStack Query** for data fetching, caching, background sync
- **Zustand** for client state (auth tokens, offline queue, UI preferences)
- **Recharts** for charts (lap time trends, tire pressure history, progress)
- **EventSource API** for SSE (ingestion job completion, AI suggestion streaming)
- **IndexedDB** (via `idb`) for offline mutation queue
- **MSW** (via `openapi-msw`) for mock API during development

## Screens

### Garage (landing)
- **Garage.tsx** — bike list with summary cards: last maintenance, active mods count, tire pressure last checked. "Add bike" flow. This is the home screen.
- **BikeDetail.tsx** — single bike view with tabs:
  - **Overview** — specs, suspension_spec display, mileage, status
  - **Maintenance** — timeline of maintenance entries, upcoming items badge, add entry form
  - **Tires** — pressure reading history chart, add reading form, link to session if track context
  - **Mods** — installed vs removed mods list, add mod form, filter by category
  - **Ownership** — timeline of purchase/sale events
  - **Sessions** — list of track sessions for this bike (links to SessionDetail)

### Track features
- **SessionLogger.tsx** — create a new session: select event (or create one inline), enter feedback, upload CSV/photo/voice. Starts ingestion jobs and shows SSE progress.
- **SessionDetail.tsx** — full session view: setup snapshot, change log, suggestions (streamed via SSE), telemetry charts (if data exists). Apply/skip individual suggestion changes from here.
- **Progress.tsx** — lap time trends across sessions, efficacy dashboard (which suggestions improved times), best laps per track.

### Utility
- **Admin.tsx** — channel alias management table (add/edit/remove AiM column mappings)
- **Settings.tsx** — user profile (rider_type, skill_level, units), account settings

## SSE integration

Two SSE connections in the app:

### Ingestion job progress
When the user uploads a CSV, photo, or voice note:
1. POST to ingestion endpoint → receive `job_id`
2. Open `EventSource` to `GET /ingest/jobs/:job_id/stream`
3. Show a progress indicator on the SessionLogger screen
4. On `complete` event: display parsed results for user confirmation
5. On user confirm: `POST /ingest/jobs/:job_id/confirm`

### AI suggestion streaming
When the user requests a suggestion:
1. POST to suggest endpoint → receive `job_id`
2. Open `EventSource` to `GET /suggest/:job_id/stream`
3. Render suggestion text incrementally as `chunk` events arrive (typewriter effect)
4. On `complete` event: display structured changes with apply/skip buttons
5. User interacts with individual changes → PATCH endpoints

## Offline-first architecture

### TanStack Query cache
- All GET requests are cached and served from cache when offline
- Stale-while-revalidate: show cached data immediately, refetch in background
- Configure `staleTime` per resource: bikes/tracks (5 min), sessions (1 min), telemetry (10 min)

### Offline mutation queue
When the device is offline and the user creates/updates data:
1. Write the mutation to IndexedDB via the offline queue (Zustand store + idb)
2. Show optimistic UI update immediately
3. When connectivity returns, replay the queue in order via TanStack Query's `onlineManager`
4. If a replayed mutation fails (conflict), surface it as a notification for user resolution

### PWA config
- `vite-plugin-pwa` with Workbox `GenerateSW` strategy
- Cache static assets aggressively (Vite hashed filenames = safe to cache forever)
- Cache API responses with a NetworkFirst strategy (online: fresh data; offline: cached)
- Register for installability (`manifest.json` with icons, theme color, start_url)

## API communication

- All requests go through the gateway: `VITE_GATEWAY_URL` env var (e.g., `http://localhost:8000`)
- Route prefix: `/api/v1/`
- Auth: send Supabase JWT as `Authorization: Bearer <token>`
- Use TanStack Query hooks for all data fetching
- Use `fetch` or `httpx`-equivalent for mutations (wrapped in TanStack Query `useMutation`)

## File structure

```
frontend/
  src/
    api/
      client.ts            ← configured fetch wrapper with auth headers
      types.ts             ← re-export generated types from contracts/
    components/
      common/              ← Button, Card, Modal, Loading, EmptyState
      garage/              ← BikeCard, MaintenanceEntry, TirePressureChart, ModRow
      session/             ← SetupSnapshotView, ChangeLogEntry, SuggestionCard
      telemetry/           ← TelemetryChart, LapSelector, ChannelToggle
      progress/            ← LapTrend, EfficacyDashboard
    screens/
      Garage.tsx
      BikeDetail.tsx
      MaintenanceLog.tsx
      SessionLogger.tsx
      SessionDetail.tsx
      Progress.tsx
      Admin.tsx
      Settings.tsx
    stores/
      authStore.ts         ← JWT token, user profile
      offlineStore.ts      ← mutation queue backed by IndexedDB
      uiStore.ts           ← sidebar state, rider_type-based visibility
    hooks/
      useAuth.ts
      useBikes.ts
      useMaintenance.ts
      useTirePressure.ts
      useModifications.ts
      useSessions.ts
      useTelemetry.ts
      useSuggestions.ts
      useProgress.ts
      useSSE.ts            ← generic SSE hook wrapping EventSource
      useOfflineQueue.ts
    sw/
      service-worker.ts    ← Workbox config
    mocks/
      handlers.ts          ← MSW handlers generated from OpenAPI
      browser.ts           ← MSW browser setup
    App.tsx
    main.tsx
    router.tsx             ← route definitions
  public/
    manifest.json
    icons/                 ← PWA icons (192, 512)
  vite.config.ts
  tailwind.config.ts
  tsconfig.json
  package.json
```

## Development workflow

1. Run `npm run dev` — starts Vite dev server on port 5173
2. MSW intercepts all API calls in development — no backend needed
3. To test against real backend: set `VITE_ENABLE_MOCKS=false` and run Docker Compose

## Testing priorities

1. Garage CRUD flows (create bike, add maintenance, log tire pressure, add mod)
2. Offline mutation queue (create entry offline → verify it syncs when online)
3. SSE streaming (mock EventSource, verify suggestion text renders incrementally)
4. rider_type UI filtering (street user doesn't see telemetry in nav, but can access via URL)
5. PWA installability (manifest valid, service worker registers)
6. Responsive design (mobile-first — riders use this at the track on their phone)
