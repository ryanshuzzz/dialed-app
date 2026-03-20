# Plan: Web E2E “testing agent” (real-user flows)

## What we mean by “web testing agent”

Two layers that work together:

1. **Deterministic E2E runner (CI + local)** — **[Playwright Test](https://playwright.dev/)** drives the real browser, uses **accessibility roles / labels** (same philosophy as the `.claude/skills/e2e-test` Playwright MCP skill), and asserts URL, text, and network where needed. This is the **authoritative** gate for “simulate a real user.”
2. **Exploratory / authoring assist (optional)** — Playwright **Codegen**, or the **Playwright MCP** in Cursor during development, to draft steps. **Not** a replacement for checked-in tests; use it to speed up writing `*.spec.ts`.

This is **not** the same as Vitest + MSW (component/unit): E2E hits a **running app** in Chromium (and optionally WebKit/Firefox) and validates full navigation and critical paths.

## Recommended layout

| Piece | Suggestion |
|-------|----------------|
| Package location | `frontend/e2e/` **or** repo root `e2e/` with `playwright.config.ts` pointing at `frontend` build/preview |
| Config | `baseURL: http://127.0.0.1:4173` (Vite preview) or `5173` (dev) in CI |
| Auth | **Seed token** via `localStorage` / `sessionStorage` in `storageState` **or** run **login flow** once per project in `globalSetup` (slower but closer to reality) |
| API | **Phase A:** MSW already in app — E2E against `vite preview` + default mocks (fast, no Compose). **Phase B:** full stack via `docker compose` + real gateway (slower job, nightly or `workflow_dispatch`) |

## User journeys to cover (map to `frontend/src/router.tsx`)

Prioritize **smoke** first, then expand. Use `data-testid` where the app already exposes them (e.g. `add-bike-button`, `add-bike-form`).

| Journey | Rough steps | Notes |
|---------|-------------|--------|
| **Login** | `/login` → email/password → land on `/` | MSW accepts any credentials today |
| **Garage** | See bikes or empty state → **Add Bike** modal → submit → card appears | Contract + MSW must stay aligned |
| **Bike detail** | Open first bike → tabs load | Use stable selector / testid |
| **Settings** | `/settings` → profile fields → Save | Drives `uiStore` rider type for nav tests |
| **Track rider nav** | After saving profile as competitive/casual → sidebar shows Tracks, Events, Sessions, … | Two personas: `street` vs `casual_track` / `competitive` |
| **Tracks list** | `/tracks` → search/filter if present → open detail | |
| **Events** | `/events` → list/detail | |
| **Session logger** | `/sessions/new` → step through wizard | Longest flow; mark `@slow` or split jobs |
| **Session detail** | Deep-link or navigate from list | Needs fixture session id or create via flow |
| **Progress** | `/progress` loads | |
| **Admin** | `/admin` visible only for competitive nav | Conditional journey |
| **Logout** | Sign out → `/login` | |

Add **mobile viewport** project in Playwright (375×812) for PWA-critical flows once layouts stabilize.

## CI strategy (GitHub Actions)

- **New job** `e2e` (or `frontend-e2e`), **after** `frontend` build succeeds:
  1. `npm ci` in `frontend`
  2. `npx playwright install --with-deps chromium` (pin browser version in lockfile / Playwright version)
  3. `npm run build && npm run preview &` **or** `vite preview` in background with wait-for-TCP
  4. `npx playwright test`
- **Artifacts**: upload **HTML report** + **trace** on failure (`retain-on-failure`).
- **Frequency**: start with **PR** on `frontend/**` + `e2e/**` path filters; if minutes are tight, move to **nightly** + optional **manual** `workflow_dispatch`.
- **Sharding**: `matrix.shard` when the suite grows past ~10–15 minutes.

## Local commands (target DX)

```bash
cd frontend
npm run build && npx vite preview --host 127.0.0.1 --port 4173 &
npx playwright test
npx playwright show-report
```

(Add npm scripts: `test:e2e`, `test:e2e:ui` when implemented.)

## Relationship to existing skills

| Asset | Role |
|-------|------|
| `.claude/skills/e2e-test` | Human/agent-driven **Playwright MCP** sessions for debugging and one-off scenarios |
| `.claude/skills/browser-test` | Chrome DevTools MCP — quick manual QA, not the CI suite |
| Vitest + MSW | Fast unit/integration; E2E still catches router, lazy loading, and real DOM timing |

## Quality bar

- Prefer **getByRole**, **getByLabel**, **getByTestId** over CSS chains.
- No fixed `sleep`; use Playwright **auto-wait** and `expect(...).toBeVisible()`.
- One **clear assertion per user intention** (“user sees confirmation”, “URL is …”).
- Flakes: retry once at job level only after stabilizing tests; fix root cause (loading states, MSW race).

## Out of scope (later)

- Visual regression (screenshot baselines) — add if marketing-heavy pages need pixel stability.
- AI-only “autonomous” crawlers without assertions — useful for **discovery**, not for merge gates.
- Load testing — separate tooling (k6, etc.).

## Related docs

- `plans/ci-github.md` — wire the E2E job into Phase 2/3.
- `plans/contract-first-ride-session.md` — new flows (road vs track) become new E2E journeys when UI lands.
