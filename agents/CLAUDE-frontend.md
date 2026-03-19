# Frontend Agent Context

> Load `CLAUDE.md` first, then this file.

## Your service

You own `frontend/` — a React 19 + TypeScript PWA on port **5173**.

## What you own

- **Garage screens**: bike list/detail, maintenance logs, tire pressure, mods, ownership
- **Session screens**: session list/detail, setup snapshots, change log
- **Telemetry views**: lap data visualization, channel overlays
- **AI suggestion UI**: streaming display, change tracking, apply/skip/modify
- **Progress/efficacy**: stats and trends
- **Auth**: login, register, token management
- **Offline queue**: queued mutations synced when online
- **PWA**: installable, service worker, offline-first

## Your contracts

- `contracts/openapi/core-api.yaml` — most CRUD operations
- `contracts/openapi/telemetry-ingestion.yaml` — upload, telemetry views
- `contracts/openapi/ai.yaml` — suggestion streaming and tracking
- `contracts/generated/typescript/` — generated TypeScript types from JSON Schema

## Key implementation notes

- All API calls go through the gateway at port 8000 (`/api/v1/...`)
- Use MSW (Mock Service Worker) for development — generate handlers from OpenAPI specs
- SSE integration for two features: ingestion job completion, AI suggestion streaming
- Offline queue: mutations stored in IndexedDB, replayed on reconnect
- Auth: store Supabase JWT, gateway handles internal token exchange
- Units: respect user's preference (metric/imperial) from their profile

## Tech stack

- React 19 with TypeScript
- Vite for build/dev
- TanStack Query for server state
- Zustand or Jotai for client state
- Tailwind CSS for styling
- Workbox for service worker / PWA
- MSW for API mocking in development
