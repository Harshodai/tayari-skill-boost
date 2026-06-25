# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Tayari Skill Boost is an AI-powered job-prep platform: resume optimization against job descriptions, ATS scoring, interview prep, job search/autopilot, cover letters, and a career roadmap. It is a polyglot monorepo with a React frontend, a Go API gateway, a Python AI engine, PostgreSQL, and an optional Ollama sidecar for fully-local LLMs.

## Architecture

Four services coordinated via `docker-compose.yml`:

```
Frontend (React/Vite, :8083 host)  ──HTTP/JWT──►  Go backend (:8085 host → 8080)
                                                       │  proxies AI calls + owns auth/DB
                                                       ▼
                                       Python AI engine (:8002 host → 8000)
                                                       │  OpenAI-compatible / Ollama / mock fallback
                                                       ▼
                                     PostgreSQL (:5433 host → 5432)  +  Ollama (:11434)
```

### Go backend (`backend/go/`, module `tayari-backend`)
Chi-based API gateway and source of truth for auth + persistence.
- `cmd/server/main.go` — entry point; picks auth strategy (`USE_SUPABASE=true` → Supabase, else local Postgres JWT), starts `concurrency.AuditWorker` pool (5 workers), graceful shutdown.
- `internal/api/router.go` — all route registration. **Two parallel route trees exist by design and must stay in sync**: archive-compatible (`/api/...`) and versioned (`/api/v1/...`) aliases for the same handlers. Do not break archive routes.
- `internal/api/routes_mvp.go` — MVP handlers (profile, jobs, autopilot, applications, schedules, resume AI ops).
- `internal/auth/` — `AuthService` interface with two impls (`local.go` JWT+Postgres, `supabase.go`) and `social.go` (Google/GitHub/LinkedIn via Goth).
- `internal/ai/client.go` — thin HTTP client to the Python service (multipart upload for `/api/v1/ats/analyze`).
- `internal/config/config.go` — env-driven config; `JWT_SECRET` is **required** (fatals if missing).
- `internal/database/` — pgx connection with ping/retry.
- SQL for handlers lives in `internal/api/resume_db.sql` (queries) and `backend/db/` (schema: `init.sql` emulates Supabase `auth.users`; `mvp_additions.sql` adds profiles, saved_jobs, autopilot, applications, schedules).

### Python AI engine (`backend/python/`, FastAPI)
Stateless ML/LLM layer called by the Go backend.
- `app/main.py` — FastAPI entry; defines ATS/strategic/entity/proofing/export routes. Routes generally mounted under `/api/v1/...`.
- `app/services/` — core engines: `ats_engine.py`, `optimizer.py` (reflective optimization), `job_agent.py`, `automation_engine.py`, `docx_builder.py`, `cover_letter.py`, `communication.py`, `interview_ai.py`, `knowledge_graph.py`, `scheduler.py`, `skill_taxonomy.py`, `embedding_service.py`, `circuit_breaker.py`.
- `app/services/llm_service.py` — **provider abstraction**. Reads `LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL`; auto-detects Ollama vs OpenAI-compatible; falls back to a mock completion when nothing configured (API never crashes). `active_engine()` is surfaced in `/health`.
- `app/guardrails/` — pipeline quality gates (`gate.py` `PipelineGate`, `truthfulness.py`, `keyword_stuffing.py`, `pii_detector.py`).
- `app/telemetry/` — pipeline event publisher (stage_complete/stage_fail).
- `app/parsers/`, `app/extraction/`, `app/analysis/`, `app/scoring/`, `app/ai_proofing/`, `app/llm/`, `app/export/` — domain modules.
- `app/plugins/resume_optimizer/` — pluggable AI modules (auto-discovered per `backend/python/README.md`).
- `eval/` — pytest eval harness (`runner.py`) driven by YAML datasets in `eval/datasets/`. `pytest` is **not** in `requirements.txt`; install it separately to run evals.

### Frontend (`src/`, React + TS + Vite + Tailwind + shadcn/ui)
- `src/App.tsx` — routes; some routes are conditionally rendered from `src/config/features.ts` feature flags. Editing flags changes visible nav + routes.
- `src/api/` — typed API client (`index.ts`) + `types.ts`. All backend calls go through `apiFetch` which reads `VITE_API_URL` (default `http://localhost:8080/api`) and attaches `Bearer` token from `localStorage["auth_token"]`. Call paths use `/v1/...`.
- `src/contexts/AuthContext.tsx` — dual auth: `VITE_USE_SELF_HOSTED=true` → Go JWT backend (mocks a Supabase-shaped session); else Supabase client (`src/integrations/supabase/client.ts`) or Lovable cloud auth (`src/integrations/lovable`).
- `src/pages/` — feature pages (ResumeUpload/Results, Dashboard, JobSearch, AutoPilot, InterviewBoard/Prep, CoverLetter, CommunicationHub, ReviewQueue, Profile, Blog, etc.).
- `src/components/ui/` — shadcn/ui primitives; `src/components/{landing,auth,layout,resume,blog}/` — feature components.

### Browser extension (`extension/`)
MV3 extension ("Tayari Job Companion") that detects jobs on ATS sites, autofills, and queues applications into the Go backend's review-queue endpoints.

### Hermes agent layer
Tiered, env-gated server-side job-scraping + automation layer wired into the live job-search flow.

- **Providers** (`app/services/hermes/providers/`): hybrid stack, each self-disables when its key is absent. Tier A — keyless ATS JSON APIs (Greenhouse/Lever/Ashby/Workday). Tier B — Firecrawl scrape/extract + SerpApi `google_jobs`. Tier C — Apify Actors. Tier D — Crawl4AI (in-process `AsyncWebCrawler`) + Playwright fallback. The 3 free providers in `job_providers.PROVIDERS` (Remotive/Arbeitnow/RemoteOK) always stay first/always-on, so the pipeline works with zero keys; Hermes providers are appended only when `.available()` is True.
- **Orchestrator** (`app/services/hermes/orchestrator.py` `HermesScraper`): `router.select_tier` picks the tier per request, runs available providers in parallel under per-provider `CircuitBreaker` (the previously-stub `circuit_breaker.py` is finally wired in), merges via `job_providers._dedupe`, caches to the `scraped_jobs` Postgres table with a TTL.
- **`job_agent.smart_search(..., scrape_enrich=True, target_board=None)`**: optional pre-GATHER Hermes scrape merged into the `jobs` list before the existing dedupe/rank steps. `/api/v1/jobs/search` payload gains optional `scrape_enrich` + `target_board` (Go `handleJobSearch` forwards the body verbatim — no Go change).
- **LLM `hermes` tier** (`llm_service.py`): `HERMES_AGENT_URL`/`HERMES_API_KEY`/`HERMES_MODEL` route to an OpenAI-compatible endpoint (e.g. local Ollama `hermes3:8b`); `active_engine()` reports `hermes-{model}`; mock fallback unchanged.
- **Celery / Redis / Flower** (`app/celery_app.py`, `app/tasks/`): durable job queue — broker+backend = Redis, queue `tayari`, `acks_late`, 15m task time limit. Tasks: `scrape_job_board`, `run_application_agent`, `run_scheduled_autopilot`. Flower UI on `:5555` (url-prefix `/flower`), built from `Dockerfile.worker` so it shares the app + deps.
- **Scheduler** (`scheduler.py`): `scheduler_loop` started as a background task in `main.py` `lifespan` on FastAPI startup, cancelled on shutdown; reads `autopilot_schedules WHERE active=true AND next_run_at<=now()` and enqueues Celery `run_scheduled_autopilot` (no blocking).
- **DB**: `agent_runs` (run_type, status, progress, current_step, logs/screenshots jsonb, result, engine, celery_task_id) + `scraped_jobs` (dedupe_key, source, board_class, job jsonb, fetched_at, expires_at TTL) — migration `backend/db/migrations/20260620_hermes_agents.sql`. `automation_engine.run_autopilot` state is mirrored to `agent_runs` (read-through cache over Postgres via asyncpg); degrades to in-memory when `DATABASE_URL` is unset.
- **Routes** (`/api/v1/hermes/*`): Python `app/api/hermes_routes.py` owns the logic (`POST /scrape` enqueues async → run_id; `GET /jobs/{board}` cached; `GET /runs`, `GET /runs/{id}` status+logs+screenshots). Go `routes_hermes.go` proxies under the protected group (both `/api/v1/*` and `/api/*` aliases) via `s.AI.PostJSON/GetJSON`; scrape always returns a run_id to dodge the 30s `ai.Client` timeout.
- **Open-source Hermes mode** (`docker-compose.hermes.yml`): override adding Ollama `hermes3:8b` + worker/flower env.

## Commands

### Frontend (repo root, uses Bun + Vite)
```bash
bun install
bun run dev          # vite dev (note: vite.config.ts sets port 8080)
bun run build        # production build
bun run lint         # eslint .
bun run test         # bun test --dom, mocks env via src/test/setup.ts
bun run test src/path/to/file.test.ts   # single file
```
Vite dev port is **8080** (configured in `vite.config.ts`), not Vite's default 5173.

### Go backend
```bash
cd backend/go
go run cmd/server/main.go          # requires DATABASE_URL + JWT_SECRET
go test ./...                      # all tests
go test ./internal/api -run TestName -v   # single test
CGO_ENABLED=0 go build -o server ./cmd/server
```

### Python AI engine
```bash
cd backend/python
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
python -m py_compile app/**/*.py    # quick syntax check (required per AGENT_SPEC.md before committing new files)
python -m pytest eval/runner.py -v          # eval suite (install pytest + pyyaml first)
python -m pytest eval/runner.py -v -k "ats_"
```

### Full stack (Docker Compose)
```bash
cp .env.example .env   # fill keys
docker compose up -d --build
# Host ports: frontend 8083, go-backend 8085, python-ai 8002, postgres 5433, ollama 11434
curl http://localhost:8085/api/health
curl http://localhost:8002/health
```
Container-internal ports differ from host ports (frontend 80, go 8080, python 8000, postgres 5432). The Go service reaches Python at `http://python-ai:8000` (`AI_SERVICE_URL`/`PYTHON_AI_URL`) and Postgres at `postgres:5432`.

### Hermes worker stack (Celery + Redis + Flower)
```bash
# Run a worker on the host (from backend/python):
cd backend/python && celery -A app.celery_app:celery_app worker -Q tayari --loglevel=info
# Flower UI (:5555):
flower -A app.celery_app:celery_app --port=5555
# Open-source Hermes mode (Ollama hermes3:8b + worker + flower):
docker compose -f docker-compose.yml -f docker-compose.hermes.yml up -d
```

## Key conventions

- **Route parity**: every archive-compatible `/api/...` route has a `/api/v1/...` alias (and vice versa). When adding a route, register both. Archive tests assert this.
- **Shared contracts (from `AGENT_SPEC.md`, do not break)**: Python port 8000, Go port 8080, frontend dev 5173 (legacy ref; current Vite is 8080), API base `http://localhost:8080/api`. DB schema is already committed.
- **LLM provider**: configure via `LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL` (or OpenAI/Anthropic keys for some services). With no `LLM_BASE_URL`, the Python engine runs in mock-fallback mode — endpoints still respond. Ollama is detected by `ollama` or `11434` in the base URL.
- **Auth strategy switch**: `USE_SUPABASE=true` (Go) and `VITE_USE_SELF_HOSTED` (frontend) toggle self-hosted JWT vs Supabase. Keep both sides consistent.
- **Feature flags**: `src/config/features.ts` gates routes and nav per-environment (`[prod, preview]`). `mode: 'auto'` detects prod by hostname `tayari-skill-boost.lovable.app`.
- **Build-time env**: frontend Vite vars (`VITE_*`) are baked into the static build — pass them as Docker build args (see `Dockerfile.frontend`). `src/test/setup.ts` mocks these for headless test/CI runs.
- **Secrets**: `JWT_SECRET` is required (Go fatals without it). Never commit real keys; `.env` is gitignored but currently present — rotate if exposed.
- **Python file hygiene**: run `python -m py_compile` on new/changed Python files before committing (per `AGENT_SPEC.md` validation rules).

## Docs in repo
`AGENT_SPEC.md` (subagent coordination spec + shared contracts), `DEPLOYMENT.md` (local + Railway/Render/Fly/Vercel), `IMPLEMENTATION_SUMMARY.md`, `lessons.md`, `backend/go/README.md`, `backend/python/README.md`, `research/WORLD_CLASS_ROADMAP.md`.