# GitHub Actions CI plan

## Goals

- **Every PR and push** to protected branches gets fast feedback: frontend lint/test/build, Python tests per service.
- **Contract-first**: optional checks that generated artifacts stay in sync with JSON Schema (see Phase 2).
- **No secrets required** for default CI (AI tests mock external APIs; core-api uses ephemeral Postgres).

## What runs today (see `.github/workflows/ci.yml`)

| Job | What it does | Notes |
|-----|----------------|--------|
| **contracts** | `swagger-cli validate` on each `contracts/openapi/*.yaml` | Fails fast on invalid OpenAPI |
| **frontend** | `npm ci` → `lint` → `test` → `build` | Node 22; `working-directory: frontend`; `frontend/.npmrc` sets `legacy-peer-deps` (Vite 8 + vite-plugin-pwa) |
| **e2e** | After **frontend**: Playwright Chromium + `vite build --mode e2e` + preview + `playwright test` | Uploads HTML report + `test-results/` on failure |
| **core-api** | Postgres 16 service → `pip install -e shared` + `requirements-test.txt` → `pytest` | `TEST_DATABASE_URL` points at job service; DB name `dialed_test` |
| **telemetry-ingestion** | Same pip pattern → `pytest` | Tests mock DB/Timescale deps |
| **ai** | Same pip pattern → `pytest` | SQLite in-memory in conftest |

**Triggers:** `push` / `pull_request` to `main`, `master`, and `develop` (adjust branch list to match your repo).

## Phase 2 — tighten the loop

1. **OpenAPI validation** — Add a step (e.g. [Spectral](https://stoplight.io/open-source/spectral) or Redocly CLI) on `contracts/openapi/*.yaml` so broken specs fail before implementation.
2. **Generated types drift** — Run `infra/scripts/generate-types.sh` (or `generate-types.ps1` on Windows agents) and **`git diff --exit-code`** on `contracts/generated/` so schema changes cannot merge without regenerated TS/Python (or commit codegen in the same PR).
3. **Docker build smoke** — Matrix build of `services/*/Dockerfile` with context repo root (catches broken Dockerfiles without starting the full stack).
4. **Integration job** — `docker compose up` minimal profile + healthchecks + one smoke `curl` to gateway (slower; nightly or `workflow_dispatch` only if minutes cost matters).
5. **Coverage gates** — Enforce thresholds per service (e.g. 80% core-api) with `pytest-cov` `--fail-under` once baselines are stable.
6. **Path filters** — `paths` / `paths-ignore` so doc-only PRs skip heavy jobs (optional).

## Phase 3 — web E2E “testing agent” (Playwright)

End-to-end browser tests that **simulate real users** (login, garage, session wizard, settings/nav personas). See **`plans/frontend-e2e-web-agent.md`** for journey map, MSW vs full-stack strategy, and Playwright CI job design (reports, sharding, path filters).

Planned addition: a **`e2e`** (or `frontend-e2e`) job that builds the frontend, serves **`vite preview`**, runs **`npx playwright test`**, and uploads traces/HTML on failure.

## Secrets & environments

- **None** for default unit CI.
- **Later:** staging deploy workflows may need Cloudflare / registry credentials; use **GitHub Environments** with required reviewers for production.

## Local parity

- Frontend: `npm run lint && npm run test && npm run build` in `frontend/`.
- Core API: Postgres with DB `dialed_test` and `TEST_DATABASE_URL` as in `services/core-api/tests/conftest.py`.
- Full stack tests: `make test-all` (requires Compose up) — mirror with integration job above.

## Related

- Public demos: Cloudflare Tunnel notes in `plans/contract-first-ride-session.md`.
- **Browser E2E user flows:** `plans/frontend-e2e-web-agent.md`.
- Python codegen on agents: `generate-types.sh` needs Python **&lt; 3.14** for `datamodel-codegen` today; CI should pin **3.12** to match Dockerfiles.
