# Tayari Skill Boost

AI job-prep platform: resume optimization vs. job descriptions, ATS scoring, interview prep, job search/autopilot, cover letters. Polyglot monorepo, self-hostable with a local LLM.

# Stack
React + TS + Vite + Tailwind + shadcn/ui (frontend) · Go + Chi (API gateway: auth + DB) · Python + FastAPI (AI/LLM engine) · self-hosted Supabase (Postgres + GoTrue auth + PostgREST + Kong + Realtime + Storage + Studio, `supabase-local/`) · optional Ollama · Celery + Redis (Hermes job queue) · browser-use + Playwright (Browser Automation Agent). Orchestrated by `docker-compose.yml`, which `include:`s `supabase-local/docker-compose.yml` into the same project. Lovable-managed.

# Structure
- `src/` — frontend. All backend calls go through `src/api/` (`apiFetch`, paths `/v1/...`); pages in `src/pages/`, shadcn primitives in `src/components/ui/`. Supabase Auth calls go directly through `src/integrations/supabase/client.ts` (`supabase.auth.*`), not through `src/api/`.
- `backend/go/` — API gateway. Routes registered in `internal/api/router.go`; handlers in `internal/api/`; auth in `internal/auth/` (`local.go` self-hosted JWT, `supabase.go` verifies Supabase-issued JWTs — Go never issues its own tokens in Supabase mode).
- `backend/python/` — FastAPI AI engine. Entry `app/main.py`; engines in `app/services/` (including `app/services/browser_automation/`).
- `integrations/` — Standalone integrations including `jobtheory_mcp` and `browser_automation_agent`.
- `extension/` — MV3 browser extension. `backend/db/` — SQL schema + migrations (source of truth); `supabase-local/volumes/db/init/` — a copy of that schema (auth-stub stripped) mounted into the Supabase `db` container. The two are not auto-synced — see the Gotchas entry below.
- `supabase-local/` — self-hosted Supabase Docker stack. Its own `.env`/`.env.example`, separate from root.

# Commands (run via Docker Compose)
- `docker compose --profile dev up -d --build` — full stack, including the Supabase stack (no `--profile` of its own, always on). Host ports: frontend 8083, Go 8085, Python 8002, Ollama 11435, Supabase Kong `KONG_HTTP_PORT` in `supabase-local/.env` (default 8000), Supabase Studio 3001, Supabase Postgres `SUPABASE_DB_PORT` in `supabase-local/.env` (default 54329). All of these are Compose `${VAR:-default}` — every one is overridable from its `.env` file (root for app services, `supabase-local/.env` for Supabase ones; see README.md's Ports table) if it collides with another project on the machine, no tracked file edits needed. **The `--profile` flag is required for root services** — every one declares one; a bare `docker compose up -d` starts zero of them, silently. `.env.example` sets `COMPOSE_PROFILES=dev` so a plain `docker compose up -d --build` also works once copied to `.env`.
- **Two `.env` files needed**: `cp .env.example .env && cp supabase-local/.env.example supabase-local/.env`. `POSTGRES_PASSWORD` and `JWT_SECRET` MUST be identical across both — Compose resolves each file's `${VAR}` against its own env file, so these are two independent values that silently diverge otherwise. A JWT_SECRET mismatch doesn't error; every login just looks like an invalid token (GoTrue signs with supabase-local's secret, Go verifies with root's).
- Health check: `curl localhost:8085/api/health` and `curl localhost:8002/health`.
- Frontend only: `bun run dev` (Vite :8080) · `bun run build` · `bun run lint`. Note: `bun run test` runs ONLY the hardcoded `ResumeGraph*` tests (see package.json), not the full suite — don't read its green as "frontend passes". `bun run test:e2e` = Playwright.
- Go: `cd backend/go && go test ./...`. Python evals: see `backend/python/CLAUDE.md`.

# Conventions
- Route parity: every `/api/...` route needs a `/api/v1/...` alias and vice versa — the two route trees must stay in sync (archive tests assert it). Register both when adding a route.
- LLM provider: set `LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL`. Ollama is auto-detected by `ollama` or `11434` in the URL. No base URL ⇒ `build_provider()` falls through to `MockProvider`, which raises `LLMNotConfiguredError` (see Gotchas below for the resulting HTTP behavior — not silent mock output).
- Auth switch: `USE_SUPABASE` (Go) and `VITE_USE_SELF_HOSTED` (frontend) toggle Supabase (default: `USE_SUPABASE=true`/`VITE_USE_SELF_HOSTED=false`, frontend talks to Supabase Auth directly, Go only verifies JWTs) vs. self-hosted JWT (Go issues/verifies its own tokens, no Supabase Auth involved) — keep both sides consistent. `JWT_SECRET` is required either way (Go fatals without it; in Supabase mode it must also match `supabase-local/.env`'s `JWT_SECRET`, see above).
- Feature flags in `src/config/features.ts` gate routes + nav per environment.
- `VITE_*` vars are baked into the static build — pass them as Docker build args, not runtime env.
- **Learning capture (hard rule):** Every task completion — bug fix, feature, refactor, investigation, or remediation — MUST append a dated entry to `lessons.md` with: what was done, root cause, fix applied, and the reusable lesson. No exceptions. This is the project's institutional memory; if it's not in `lessons.md`, it didn't happen.

# Gotchas
- Never add a per-package `manualChunks` splitter to `vite.config.ts` — one chunk per `node_modules` package breaks scoped packages that share module state (`@sentry/*`, `@radix-ui/*`) with runtime TDZ errors. Let Rollup chunk automatically.
- `bun run dev` binds `:8080` and the API default `VITE_API_URL` is also `http://localhost:8080/api` with no proxy — calls hit the SPA fallback. Point `VITE_API_URL` at the Go backend (`:8085`) when running outside Docker.
- Host vs. container ports differ. Inside compose, Go reaches Python at `http://python-ai:8000`, Postgres at `db:5432` (Supabase's `db` service, not a `postgres` service — that was removed).
- AI endpoints return an explicit 503 `{"error":"ai_service_unavailable"}` (`LLMNotConfiguredError`) when no LLM is configured — they do NOT 200 with placeholder text (that was true historically; `build_provider()` in `backend/python/app/services/llm_service.py` no longer has a silent-mock path). `LLM_PROVIDER=openrouter` reads `OPENROUTER_API_KEY` first (+ optional `OPENROUTER_MODEL`, default `openai/gpt-4o-mini`) but falls back to `LLM_API_KEY` if `OPENROUTER_API_KEY` is unset (`build_provider()`: `_env("OPENROUTER_API_KEY") or _env("LLM_API_KEY")`) — `LLM_MODEL` has no such fallback for `OPENROUTER_MODEL`. Both `OPENROUTER_API_KEY`/`OPENROUTER_MODEL` are passed through `docker-compose.yml` to `python-ai`/`celery-worker`/`celery-beat`; adding a new provider-specific var needs the same passthrough on all three or it silently never reaches the container. Confirm a real model ran via `active_engine` in `/health`.
- Don't hand-edit generated/managed files: `dist/` (build output), `.lovable/`, and Lovable/Supabase-managed code under `src/integrations/` — changes get overwritten. Edit the source that produces them.
- Never `docker compose down -v` or delete `supabase-local/volumes/db/data` without confirming — it wipes local DB data. Note `down -v` alone does **not** wipe it: `supabase-local/volumes/db/data` is a bind mount, not a named Docker volume, so you have to `rm -rf` it yourself for a truly fresh init.
- Adding a file to `backend/db/migrations/` does **not** automatically apply to the self-hosted Supabase stack — also copy it into `supabase-local/volumes/db/init/` with the next `NN-` prefix and add the matching individual-file volume mount in `supabase-local/docker-compose.yml`'s `db:` service. The Supabase postgres image's `migrate.sh` globs `migrations/*.sql` **non-recursively** — mounting a directory there (instead of individual files) is silently invisible to it, zero tables created, zero errors logged.
- `supabase-local/`'s minimal setup has no mail/SMTP service — `ENABLE_EMAIL_AUTOCONFIRM` must stay `true` in `supabase-local/.env` or every signup fails with "Error sending confirmation email" (500).
- `src/contexts/AuthContext.tsx`'s Supabase branch must write the session's `access_token` into `localStorage['auth_token']` (both in `onAuthStateChange` and the initial `getSession()` call) — that's the key `src/api/index.ts`'s `apiFetch` reads for the Go backend's `Authorization` header. It's a different key than Supabase's own internal session storage, so this doesn't happen automatically.
- `FLOWER_USER`/`FLOWER_PASSWORD` in root `.env` are required, not optional — `docker-compose.yml`'s `celery-flower` service refuses to start (fails fast with an error) if either is unset. `.env.example` ships both blank.


# Ruthless Security, HITL, AWS, and Release Addendum

## Safety boundary

Treat Job Tayari as manual-submit only. `AUTONOMOUS_SUBMIT_ENABLED` must remain `false` by default and must be enforced by the server. Never create accounts, enter passwords, OTP/MFA codes, CAPTCHA answers, terms acceptance, legal declarations, work-authorization or sponsorship answers, salary expectations, EEO/self-identification answers, or credentials. These fields must pause execution and create a durable owner-scoped human handoff.

A frontend stop button is not a kill switch. Cancellation must terminate the actual browser resource server-side and the work loop must observe it. Handoff tokens must be owner-bound, expiring, single-use, replay-resistant, and absent from logs. Never log session cookies, passwords, OTPs, CAPTCHA text, raw tokens, full accessibility snapshots, or unredacted resume/application data.

## Ownership and database security

Reject `default_user` and all synthetic identities. The Go gateway must forward verified identity to Python. Every user-owned database query, answer snapshot, question, browser run, audit row, and state transition must include an owner predicate. Sensitive answer data must be persistent, versioned, provenance-aware, application-aware, expiry-aware where appropriate, and fail closed on database errors. Previously stored sensitive answers must not silently autofill a new application.

Every public table requires verified RLS, explicit least-privilege grants, and two-user negative tests. Secret-bearing tables such as API keys and password-reset tokens should be service-role-only. Never expose `USING (true)` to `anon` or general `authenticated` access. Add forward migrations; do not rewrite applied historical migrations. Verify every Python/Go query against the actual database schema before deployment.

**RLS scope — read before assuming RLS is a backstop for backend code.** `DATABASE_URL` connects the Go gateway, Python engine, Celery, and Flower as the `postgres` role, which has `BYPASSRLS` (confirmed live 2026-08-26: `SELECT rolbypassrls FROM pg_roles WHERE rolname='postgres'` returns `true`). RLS policies never evaluate for these connections regardless of how they're written — a live exploit inserted and read back two different users' rows through a `FORCE ROW LEVEL SECURITY` table with a correct `auth.uid() = user_id` policy, and RLS never engaged. **RLS in this codebase protects exactly one path: direct PostgREST/Supabase-JS access via the `anon`/`authenticated` roles** (confirmed those two roles correctly have `rolbypassrls=false`). It does **not** protect anything the Go or Python backend does on a user's behalf — that path's entire tenant-isolation guarantee is the application code's own `WHERE user_id=$1` discipline, with zero database-layer backstop. Treat every backend query as security-critical on that basis; a missing or wrong owner predicate in Go/Python is a full cross-tenant breach with nothing else standing behind it.

**Why the "obvious" fix (connect as a non-bypassing role) doesn't work without a larger rework:** RLS policies here key off `auth.uid()`, which reads a JWT claim (`request.jwt.claims`) that PostgREST sets per-connection from the caller's Supabase-issued JWT. The Go/Python backend's raw `database/sql`/`asyncpg` connections carry no such claim — even switching their connection role to `authenticated` would make `auth.uid()` evaluate to `NULL` on every query, and RLS would then deny all backend access outright (fail-closed on every table), not fail-open. Making RLS actually protect backend traffic requires either (a) setting the JWT-claims session variable explicitly on every backend connection/transaction before every query, matching the real authenticated user, across every Go and Python call site that touches the DB — a large, cross-cutting rework, not a one-line role swap — or (b) accepting that RLS is scoped to the direct-PostgREST path only, as documented here, and continuing to rely on (and audit) application-level ownership checks for everything the backend does. As of 2026-08-26 this project has chosen (b) pending capacity for (a); do not silently attempt a role swap as a "quick fix" — it will break the backend outright without also doing the JWT-claims plumbing.

## Truthful product behavior

No fabricated names, emails, URLs, scores, proof claims, compensation values, demo payloads, or unconditional readiness labels. A manually recorded submission is candidate-confirmed but externally unverified unless an actual portal receipt or evidence exists. All non-2xx API responses need visible UI error state. Frontend API calls go through the Go gateway and shared `apiFetch` helper, never directly to Python or raw `/api` fetches.

## AWS canary contract

The low-cost AWS path is one EC2 canary running `docker-compose.aws.yml`: Caddy is the public edge, Go is exposed through `/api`, Python and Redis remain private, Redis is self-hosted, and Supabase/PostgreSQL/Auth remain external until their security contract is verified. Use `deploy/aws/ec2-canary.yaml`, `deploy/aws/provision.sh`, `deploy/aws/deploy.sh`, and the runbook in `deploy/aws/README.md`. Create a budget before provisioning; prefer SSM; restrict SSH; encrypt storage; keep `deploy/aws/.env` mode 600 and outside Git; and never create NAT Gateway, RDS, ElastiCache, or a load balancer merely for a Free Tier canary.

The host is not HA. Playwright/Chromium and Celery are memory-heavy, so keep concurrency conservative. PostgreSQL/Supabase is the system of record; Redis is recoverable queue/cache state. Backups and restore drills must be verified in a disposable environment.

## Release gates and permissions

`bun run security:production` must pass with zero unresolved critical/high findings. Never update the baseline to force green. The current repository still reports 41 critical and 72 high database findings. Before launch, run Python, Go, frontend, migration, two-user ownership, queue outage, handoff expiry/replay, browser cancellation, redacted-log, backup/restore, and staging smoke tests.

Stage only intended files and inspect `git status`, `git diff --check`, staged names, tests, and remote state before pushing. If GitHub refuses a workflow update because the token lacks `workflows` permission, record the limitation and do not claim the workflow was pushed; push non-workflow files separately only when that is explicitly acceptable.
