---
name: tayari-build-and-env
description: >
  Recreate the Tayari Skill Boost dev environment from scratch and build each service. Load this when
  cloning/bootstrapping the repo, installing or pinning toolchains (Go, Python, Node, Bun, Docker),
  building the Go gateway / Python AI engine / React frontend / Celery worker, or diagnosing
  environment, build, or toolchain-version errors ("go version mismatch", "python 3.9 vs 3.11",
  "WeasyPrint won't import", "bun.lockb missing", "docker compose up starts nothing", "which port is
  the API on"). Owns the authoritative host↔container PORT TABLE and the .env / JWT_SECRET setup.
  Facts verified 2026-07-31.
---

# Tayari Skill Boost — Build & Environment Runbook

Imperative setup guide for a mid-level engineer (or a Sonnet-class agent) recreating this polyglot
monorepo from a clean checkout and building every service. This skill OWNS toolchain versions, the
authoritative host↔container port table, and `.env`/`JWT_SECRET` bootstrap. Everything here was
re-opened and verified against the repo on 2026-07-31.

## When NOT to use / use instead
- Starting, orchestrating, or deploying the running stack (compose up, healthchecks, scaling) → **tayari-run-and-operate** (it cross-references the port table below).
- Debugging a failing build/test at runtime, panics, red CI → **tayari-debugging-playbook** (e.g. `go test ./...` failures) and **tayari-failure-archaeology**.
- Adding a route/dependency/flag or gating a change → **tayari-change-control**.
- Config knobs, feature flags, LLM provider selection → **tayari-config-and-flags**.

---

## 1. Required toolchains + pinned versions

The project pins these in Dockerfiles and `go.mod`. Match them locally; a newer local toolchain is a
**known skew** you must be aware of, not silently trust.

| Toolchain | Project pin (authoritative source) | Why it matters |
|-----------|-----------------------------------|----------------|
| **Go** | `1.24` — `backend/go/go.mod`: `go 1.24.0`, `toolchain go1.24.13`; `backend/go/Dockerfile`: `golang:1.24-alpine`; CI uses 1.24 | Gateway build. **Local machines often run newer Go (e.g. 1.26.x)** — builds still pass, but CI pins 1.24. Don't rely on 1.26-only language features. |
| **Python** | `3.11` — both `backend/python/Dockerfile` and `Dockerfile.worker`: `python:3.11-slim-bookworm`; CI uses 3.11 | AI engine. A stock macOS `python3` may be 3.9 — that is **too old** for this code; use a real 3.11 (`pyenv`/`brew install python@3.11`) in a per-project venv. |
| **Node** | `22` — `Dockerfile.frontend`: `node:22-alpine` | Frontend build/tooling. **Node 25.x OOM-crashes the WASM tooling — use Node 22 LTS.** |
| **Bun** | frontend package manager (`package.json` `test` uses `bun test`; `Dockerfile.frontend` installs via bun) | Primary FE installer/builder; ≥1.3.14 recommended. |
| **Docker + Compose v2** | `docker compose` (v2 subcommand syntax used throughout); `include:` support (Compose v2.20+) merges `supabase-local/docker-compose.yml` into this project | Full-stack orchestration. |
| **Database** | Self-hosted Supabase (`supabase/postgres:15.8.1.085` underneath) — `supabase-local/docker-compose.yml`, merged in via root `docker-compose.yml`'s `include:`. **Not** a standalone `postgres` service — that was removed 2026-07-31. | DB + Auth (GoTrue) + PostgREST + Kong + Realtime + Storage + Studio. |
| **Redis** | `7` — compose `redis:7-alpine` | Celery broker/backend (compose-managed). |
| Ollama (optional) | `ollama/ollama:0.32.5` (compose) | Local LLM (compose-managed). Ships with zero models — `docker exec tayari-ollama ollama pull <model>` first. The `0.1.39` pin used before 2026-07-31 couldn't load any current model (`done_getting_tensors` GGUF mismatch — its bundled llama.cpp predates modern model formats). |
| Caddy / nginx | `caddy:2.7.6-alpine` (reverse proxy), `nginx:alpine` (serves FE `dist/`) | compose-managed. |

Verify your local toolchains before building:

```bash
go version              # expect go1.24.x; newer (1.26.x) works locally but CI pins 1.24
python3.11 --version    # MUST be 3.11.x — a bare `python3` may be 3.9 and will not do
node --version          # expect v22.x — NOT 25.x
bun --version           # expect >= 1.3.14
docker --version && docker compose version
```

If you only need to build the containers, you do **not** need local Go/Python/Node/Bun at all — the
Dockerfiles pin everything. Local toolchains are for the fast inner loop (build/lint/compile without Docker).

---

## 2. Per-service local build (copy-paste)

### Go API gateway — `backend/go/`
```bash
cd backend/go
go build ./...                                   # VERIFIED OK (exit 0) on 2026-07-08
```
Production binary (mirrors `backend/go/Dockerfile`):
```bash
cd backend/go
CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server
# CI variant: go build -o tayari-backend ./cmd/server/main.go
```
`go build ./...` succeeds; **`go test ./...` also passes** (fixed 2026-07-31 —
`tenantMiddleware` now guards nil DB, see `tayari-failure-archaeology` Entry 1). The remaining
gap is **test coverage**, not correctness: `go test -coverprofile=... ./...` → 14.1% vs the 80%
CI requires. See **tayari-validation-and-qa** for the coverage detail and the DB-free fast
subset.

### Python AI engine — `backend/python/`
`weasyprint` (PDF export) needs native system libraries. The Dockerfiles install exactly these
(replicate on bare metal with `apt`/Homebrew equivalents):
```
libpango-1.0-0  libpangocairo-1.0-0  libcairo2  libffi-dev
libgdk-pixbuf2.0-0  libxml2  libxslt1.1  shared-mime-info  curl
```
Then:
```bash
cd backend/python
python3.11 -m venv .venv && source .venv/bin/activate   # per-project venv; never system Python
pip install -r requirements.txt                          # includes weasyprint, celery, crawl4ai, sklearn, nltk...
python -m py_compile app/**/*.py                         # fast sanity gate (AGENT_SPEC requires this pre-commit)
```
`requirements.txt` does **NOT** include `pytest`/`pyyaml`. To run unit tests or the eval harness,
install them separately:
```bash
pip install pytest pyyaml    # nltk is already in requirements; used optionally for stopwords
```
Quick smoke that imports resolve (must run **from `backend/python/`** so `app` is importable):
```bash
cd backend/python
python3 -c "from app.services import ats_engine; print('imports ok')"
```

### Frontend — repo root (`src/`)
```bash
bun install            # primary; Dockerfile falls back to `npm install` if bun fails
bun run build          # vite build → dist/
bun run lint           # eslint
bun run test           # NOTE: only runs the hardcoded ResumeGraph* tests, not the full suite
```
Both `bun.lockb` and `package-lock.json` are committed; `bun install` is the source of truth for FE deps.

### Celery worker (built from `backend/python/`)
Runs from the same package/deps as the AI engine. Local invocation:
```bash
cd backend/python
celery -A app.celery_app:celery_app worker -Q tayari --loglevel=info
```
The container image (`Dockerfile.worker`) additionally runs `python -m playwright install --with-deps
chromium` for Crawl4AI — see Trap (e).

---

## 3. AUTHORITATIVE PORT TABLE (host ↔ container)

**Source of truth: `docker-compose.yml`** (root `services:` + `include:`d `supabase-local/docker-compose.yml`). Reproduce these exactly. Everything else in the repo's
docs is suspect (see stale-doc warning below). Root services are profile-gated (see Trap (a));
the included Supabase services have no `profiles:` of their own and are always on.

| Service | **Host port** | Container port | Internal DNS (inside compose) | Notes |
|---------|---------------|----------------|-------------------------------|-------|
| frontend | **8083** | 80 | `frontend:80` | nginx serving `dist/` |
| go-backend | **8085** | 8080 | `go-backend:8080` | API gateway |
| python-ai | **8002** | 8000 | `python-ai:8000` | FastAPI |
| redis | **6380** | 6379 | `redis:6379` | host is **6380**, not 6379 |
| celery-flower | **5555** | 5555 | — | url-prefix `/flower` |
| ollama | **11435** | 11434 | `ollama:11434` | host is **11435** — see Ollama trap below |
| caddy | **8090** (`CADDY_HTTP_PORT`), **8443** (`CADDY_HTTPS_PORT`) | 80 / 443 | — | reverse proxy |
| **Supabase `db`** | `SUPABASE_DB_PORT` in `supabase-local/.env`, default **54329** | 5432 | `db:5432` | user/db always `postgres`/`postgres` — Supabase's fixed convention, no `POSTGRES_USER`/`POSTGRES_DB` vars anymore |
| **Supabase `kong`** | `KONG_HTTP_PORT` in `supabase-local/.env`, default **8000** | 8000 | `kong:8000` | API gateway for Auth/PostgREST/Storage/Realtime — no bare `/health` route, 401s unauthenticated requests to real routes (that IS the "alive" signal) |
| **Supabase `studio`** | **3001** | 3000 | `studio:3000` | DB admin UI |
| **Supabase `supavisor`** (pooler) | `POOLER_PROXY_PORT_TRANSACTION` in `supabase-local/.env`, default **6543** | 6543 | `supavisor:6543` | not used by go-backend/python-ai (they connect to `db` directly) |

Health checks (from the **host**):
```bash
curl http://localhost:8085/api/health    # Go gateway
curl http://localhost:8002/health         # Python AI engine
```
Go reaches Python inside the network via `AI_SERVICE_URL=http://python-ai:8000` (set by compose).

**Ollama host-port trap:** the Python LLM layer auto-detects Ollama by the substrings `"ollama"` or
`"11434"` in `LLM_BASE_URL`. The compose **host** port is `11435`, which contains neither — so pointing
a host process at `http://localhost:11435` falls through to the generic OpenAI-compatible provider
(wrong API path). Inside compose use `http://ollama:11434` (contains `"ollama"`, works). Details in
**tayari-config-and-flags**.

**Port collisions with unrelated local projects.** Kong (8000), Supabase Postgres (54329), and
Studio (3001) are common collision points if you're also running a Supabase CLI project
(`supabase start`, which defaults to 54321/54322/54323) or another Docker Compose stack on the
same machine. If `up` fails with "port is already allocated", change the colliding
`*_PORT`/`SUPABASE_DB_PORT`/`KONG_HTTP_PORT` var in `supabase-local/.env` rather than stopping the
other project — see `lessons.md`'s port-remapping entry for a worked example.

### STALE-DOC WARNING — do not trust ports from these files
The port table above is the ONLY correct one. Other docs contradict it and are wrong:
- **`CLAUDE.md`** says Ollama `11434` — the **host** port is `11435` (11434 is container-internal). (Otherwise `CLAUDE.md` was updated 2026-07-31 for the Supabase migration and is trustworthy on the rest.)
- **`DEPLOYMENT.md`** uses `localhost:8080` / `:8000` / `:80` in a couple of illustrative Railway/Render/Fly snippets — those are **container-internal** ports, not reachable from the host. Real host ports are 8085 / 8002 / 8083. (Updated 2026-07-31 for the Supabase migration otherwise.)
- **`lessons.md`**'s opening entry cites frontend host `4175` and Supabase Kong `8008` / Studio `3005` / db `54326` — that's a **different, one-off port remap** from a session running Tayari alongside an unrelated "Mukthi Guru" stack, not the shipped defaults. The shipped defaults are the table above (Kong 8000, Studio 3001, db 54329).
- **`AGENT_SPEC.md`** says frontend dev `5173` — legacy Vite default; current Vite dev port is `8080` (`vite.config.ts`).

---

## 4. `.env` setup — TWO files now, not one

```bash
cp .env.example .env
cp supabase-local/.env.example supabase-local/.env
```
Root `docker-compose.yml` and `supabase-local/docker-compose.yml` are two separate Compose
projects merged via `include:` — each resolves its own `${VAR}` references against its own env
file. **`POSTGRES_PASSWORD` and `JWT_SECRET` in `.env` must be byte-identical to the same-named
vars in `supabase-local/.env`.** There's no enforcement of this at parse time — a mismatch just
makes GoTrue-issued JWTs fail Go's verification silently (every login looks like an invalid
token, not an obviously-wrong-secret error). `.env.example`'s defaults for both already match
`supabase-local/.env.example`'s defaults, so leaving both untouched (dev only!) keeps them
aligned automatically.

**`JWT_SECRET` is REQUIRED** — the Go gateway calls `getEnvRequired("JWT_SECRET")`
and `log.Fatalf`s (process exits) if it is missing or empty. Compose's fallback matches
`supabase-local/.env.example`'s own JWT_SECRET placeholder
(`your-super-secret-jwt-token-with-at-least-32-characters-long`), but a bare local `go run`
without it set will fatal.

Secret hygiene:
- `.env` and `supabase-local/.env` are both **gitignored** (`.gitignore` lists `.env`, `.env.*`) and **not tracked in git**. Only the two `.env.example` files are committed. Real keys sitting in a working-tree `.env` should still be **rotated** if they were ever anything but placeholders.
- `supabase-local/.env`'s `ENABLE_EMAIL_AUTOCONFIRM` must stay `true` — the minimal Supabase setup has no mail/SMTP service, so with autoconfirm off every signup fails with "Error sending confirmation email" (500). `.env.example` defaults it to `true` for exactly this reason.
- `.env.example`'s `VITE_SUPABASE_URL`/`SUPABASE_URL`/`SUPABASE_ANON_KEY` are **current and required**, not legacy scaffolding to ignore — Supabase is the default auth/DB backend as of 2026-07-31. See **tayari-config-and-flags** for the full var catalog.

---

## 5. Known traps (read before your first build)

**(a) Profile gate — the #1 gotcha.** Every root compose service declares
`profiles: ["dev", "prod"]` (or similar). A bare `docker compose up -d` starts **ZERO** of them.
You MUST pass a profile:
```bash
docker compose --profile dev up -d --build
# or: COMPOSE_PROFILES=dev docker compose up -d --build
```
The `include:`d Supabase services (`db`, `kong`, `auth`, `rest`, `realtime`, `storage`, `meta`,
`studio`, `supavisor`) have **no `profiles:` of their own** and always come up regardless of
which profile you pick — go-backend/python-ai need a real database either way.
`IMPLEMENTATION_SUMMARY.md` (historical, dated 2026-06-20) says bare `docker compose up -d` — it's
wrong for this file today, treat it as a snapshot of an earlier state, not current guidance.
Operational detail lives in **tayari-run-and-operate**.

**(b) Frontend image installs via Bun with npm fallback.** `Dockerfile.frontend` copies
`package.json` + `bun.lockb`, then runs `npm install -g bun && bun install || npm install` and
`bun run build || npm run build`. Keep `bun.lockb` present and in sync — if it's stale/missing, the
build silently falls back to `npm install` (different resolution). Both lockfiles are committed.

**(c) Node 25 crashes WASM tooling — use Node 22.** The tree-sitter/WASM toolchain OOM-crashes on
Node 25.x. Stay on Node 22 LTS (which is also what `Dockerfile.frontend` pins).

**(d) WeasyPrint needs native libs.** PDF export (`weasyprint==63.1`) will `pip install` but fail to
import without the system libraries listed in §2 (libpango, libcairo, libgdk-pixbuf, etc.). Inside
Docker this is handled; on bare metal you must install them yourself.

**(e) Worker image bundles Playwright Chromium.** `Dockerfile.worker` runs
`python -m playwright install --with-deps chromium` for Crawl4AI (Hermes Tier-D scraping). This makes
the worker image large and its build slow. It's intentional — don't strip it if you need Tier-D scraping.

**(f) Local dev port clash (frontend outside Docker).** `vite dev` binds `:8080` and the default
`VITE_API_URL` is also `http://localhost:8080/api` with no proxy → API calls hit the SPA fallback.
When running the frontend outside Docker, set `VITE_API_URL=http://localhost:8085/api` (the Go host
port). `VITE_*` vars are baked at **build** time — pass them as Docker build args, not runtime env.

---

## 6. From zero to running — ordered checklist

1. **Clone** the repo; `cd` to the root.
2. **Install/verify toolchains** (only what you'll use locally): Go 1.24+, Python 3.11, Node 22, Bun ≥1.3.14, Docker + Compose v2 (§1).
3. **`cp .env.example .env && cp supabase-local/.env.example supabase-local/.env`**; set any LLM keys you want. `JWT_SECRET`/`POSTGRES_PASSWORD` default to matching placeholders in both files already — only change them if you also change both (§4).
4. **Build each service to catch errors early** (optional but recommended):
   - Go: `cd backend/go && go build ./...`
   - Python: `cd backend/python`, create venv, install system libs (§2) + `pip install -r requirements.txt`, then `python -m py_compile app/**/*.py`.
   - Frontend: `bun install && bun run build`.
5. **Bring up the stack WITH a profile** (never bare): `docker compose --profile dev up -d --build`.
6. **Health-check on host ports**: `curl http://localhost:8085/api/health` and `curl http://localhost:8002/health`. Frontend at `http://localhost:8083`.
7. If a service didn't start, first suspect the **profile gate** (Trap a); then check the **port table** (§3) — you're probably hitting a container-internal port from the host.
8. Hand off to **tayari-run-and-operate** for operating the running stack, and **tayari-debugging-playbook** for failures.

---

## Provenance and maintenance
- **Verified 2026-07-31** against: `docker-compose.yml` (incl. `include:` of
  `supabase-local/docker-compose.yml`), `Dockerfile.frontend`, `backend/python/Dockerfile`,
  `backend/python/Dockerfile.worker`, `backend/go/Dockerfile`, `backend/go/go.mod`,
  `backend/python/requirements.txt`, `package.json`, `.env.example`, `supabase-local/.env.example`,
  `.gitignore`, `vite.config.ts`, root `CLAUDE.md`, `backend/python/CLAUDE.md`. 2026-07-31 session
  removed the standalone `postgres` service and replaced it with the self-hosted Supabase stack —
  see `lessons.md`'s "Migrating Off Bare Postgres" entry for the three traps hit doing this.
- **Re-verify when:** any Dockerfile base image or `go.mod`/`toolchain` version changes; a service's
  host port changes in `docker-compose.yml` or `supabase-local/docker-compose.yml`; profiles are
  added/removed; `requirements.txt` or `package.json` gain/lose a native-dep package (e.g.
  WeasyPrint, Playwright/Crawl4AI); or `.env` git-tracking status changes. The port table here is
  authoritative — if it and any other doc disagree, `docker-compose.yml` wins and the other doc is
  stale.
- No oversell: this skill covers building and environment setup only. It makes no claim that
  `go test`/CI is green (it is not — see the validation/debugging skills).
