# Tayari Skill Boost

AI job-prep platform: resume optimization vs. job descriptions, ATS scoring, interview prep, job search/autopilot, cover letters. Polyglot monorepo, self-hostable with a local LLM.

# Stack
React + TS + Vite + Tailwind + shadcn/ui (frontend) · Go + Chi (API gateway: auth + DB) · Python + FastAPI (AI/LLM engine) · PostgreSQL · optional Ollama · Celery + Redis (Hermes job queue) · browser-use + Playwright (Browser Automation Agent). Orchestrated by `docker-compose.yml`. Lovable-managed; Supabase optional.

# Structure
- `src/` — frontend. All backend calls go through `src/api/` (`apiFetch`, paths `/v1/...`); pages in `src/pages/`, shadcn primitives in `src/components/ui/`.
- `backend/go/` — API gateway. Routes registered in `internal/api/router.go`; handlers in `internal/api/`; auth in `internal/auth/`.
- `backend/python/` — FastAPI AI engine. Entry `app/main.py`; engines in `app/services/` (including `app/services/browser_automation/`).
- `integrations/` — Standalone integrations including `jobtheory_mcp` and `browser_automation_agent`.
- `extension/` — MV3 browser extension. `backend/db/` — SQL schema + migrations.

# Commands (run via Docker Compose)
- `docker compose --profile dev up -d --build` — full stack. Host ports: frontend 8083, Go 8085, Python 8002, Postgres 5433, Ollama 11434. **The `--profile` flag is required** — every service declares one; a bare `docker compose up -d` starts zero containers, silently. `.env.example` sets `COMPOSE_PROFILES=dev` so a plain `docker compose up -d --build` also works once you've copied it to `.env`.
- Health check: `curl localhost:8085/api/health` and `curl localhost:8002/health`.
- Frontend only: `bun run dev` (Vite :8080) · `bun run build` · `bun run lint`. Note: `bun run test` runs ONLY the hardcoded `ResumeGraph*` tests (see package.json), not the full suite — don't read its green as "frontend passes". `bun run test:e2e` = Playwright.
- Go: `cd backend/go && go test ./...`. Python evals: see `backend/python/CLAUDE.md`.

# Conventions
- Route parity: every `/api/...` route needs a `/api/v1/...` alias and vice versa — the two route trees must stay in sync (archive tests assert it). Register both when adding a route.
- LLM provider: set `LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL`. Ollama is auto-detected by `ollama` or `11434` in the URL. No base URL ⇒ mock-fallback mode.
- Auth switch: `USE_SUPABASE` (Go) and `VITE_USE_SELF_HOSTED` (frontend) toggle self-hosted JWT vs. Supabase — keep both sides consistent. `JWT_SECRET` is required (Go fatals without it).
- Feature flags in `src/config/features.ts` gate routes + nav per environment.
- `VITE_*` vars are baked into the static build — pass them as Docker build args, not runtime env.

# Gotchas
- Never add a per-package `manualChunks` splitter to `vite.config.ts` — one chunk per `node_modules` package breaks scoped packages that share module state (`@sentry/*`, `@radix-ui/*`) with runtime TDZ errors. Let Rollup chunk automatically.
- `bun run dev` binds `:8080` and the API default `VITE_API_URL` is also `http://localhost:8080/api` with no proxy — calls hit the SPA fallback. Point `VITE_API_URL` at the Go backend (`:8085`) when running outside Docker.
- Host vs. container ports differ (8083/8085/8002/5433 → 80/8080/8000/5432). Inside compose, Go reaches Python at `http://python-ai:8000`, Postgres at `postgres:5432`.
- AI endpoints return mock completions when no LLM is configured — they 200 with nothing real behind them. Confirm a real model ran via `active_engine` in `/health`.
- Don't hand-edit generated/managed files: `dist/` (build output), `.lovable/`, and Lovable/Supabase-managed code under `src/integrations/` — changes get overwritten. Edit the source that produces them.
- Never `docker compose down -v` or drop the Postgres volume without confirming — it wipes local DB data.
