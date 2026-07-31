---
name: tayari-debugging-playbook
description: >-
  Symptom → triage playbook for Tayari Skill Boost's real failure modes. Load when you
  hit an error, crash, panic, failing test, blank/white screen, HTTP 500/502, CORS
  rejection, port clash, "works in Docker but not locally", a Go nil-pointer panic in
  database/sql, or when AI output "looks fake/generic". Gives symptom→cause→discriminating
  experiment for each verified trap, plus a first-5-minutes triage protocol. Facts
  verified 2026-07-31.
---

# Tayari Debugging Playbook

Fast triage for **this project's** actual failure modes — not generic debugging. Each row
gives a **discriminating experiment**: one command whose result tells you which branch you're
on. Run the experiment before you start editing.

This skill is the **fast path**. For the full write-up of a settled incident (root cause +
evidence + status), use `tayari-failure-archaeology`. For what a "real pass" means, use
`tayari-validation-and-qa`.

**Jargon defined once:**
- **Mock LLM / mock-masking** — when no LLM provider is configured (or a call fails), the
  Python engine returns plausible fake text instead of raising. Output looks real, proves nothing.
- **Profile-gated** — every root `docker-compose.yml` service sits behind `profiles: ["dev","prod"]`,
  so `docker compose up -d` with no `--profile` starts **zero** of them. The `include:`d Supabase
  stack (`supabase-local/`) has no profile tag and always starts.
- **TDZ** — "temporal dead zone": a JS runtime error accessing a `let`/`const` binding before
  it's initialized, e.g. `Cannot access 'Gt' before initialization`.
- **Green subset** — the DB-free Go tests (smoke + route parity), a fast targeted check. The
  **full** `go test ./...` also passes today (fixed 2026-07-31) — the subset is for speed, not
  because the full suite is red.

---

## 0. First 5 minutes — triage protocol

Do these in order before diving in. They cheaply localize the fault to a layer.

```bash
# 1. Are the two backends up and healthy? (host ports)
curl -s http://localhost:8085/api/health   # Go gateway
curl -s http://localhost:8002/health       # Python AI engine

# 2. Is the LLM real or mock? (decides whether AI output is trustworthy)
curl -s http://localhost:8002/health | grep -o '"model_status":"[^"]*"'
#   "loaded"            -> a real engine is wired
#   "llm_not_configured"-> MockProvider: any AI output you saw is FAKE

# 3. Is the code even building?
cd backend/go && go build ./...
cd backend/python && python -m py_compile app/**/*.py

# 4. Is the green Go test subset passing? (fast isolation of "your change" broke something)
cd backend/go && go test ./internal/api -run 'TestSmoke|TestRouteParity'
# Full suite is also green today (2026-07-31) if you want the real signal: go test ./...
```

If `curl` connection-refuses, the stack isn't up — check `docker compose --profile dev ps`
(see `tayari-run-and-operate`), remembering the profile trap (row 4 below).

---

## 1. Symptom → triage table

| Symptom | Most likely cause | Discriminating experiment | Fix / next step |
|---|---|---|---|
| `go test ./...` fails **CI's Coverage Check step specifically** (not the tests themselves) | Go test coverage is 14.1% vs the 80% `ci.yml` requires — a real gap, not a config bug | `go test -coverprofile=/tmp/c.out ./... && go tool cover -func=/tmp/c.out \| grep total` | Write more Go tests (`internal/billing`/`config`/`database`/`models`/`concurrency` are at ~0%). RESOLVED as of 2026-07-31: `go test ./...` itself (no coverage flag) now passes — `tenantMiddleware` guards nil DB. See `tayari-failure-archaeology` Entry 1. |
| AI-calling endpoint returns **HTTP 503 `{"error":"ai_service_unavailable"}`** instead of a result | No LLM configured — `MockProvider`/`llm_complete` now **raise** `LLMNotConfiguredError` instead of returning fake text (fixed; historically it silently returned `_mock_text` at HTTP 200, which is why old advice here said to check for generic-looking output — that mode no longer exists) | Set an LLM provider (see `tayari-config-and-flags`), then retry the call | `curl -s http://localhost:8002/health` → `model_status` (`"loaded"`/`"llm_not_configured"`) is a reliable check again — it now calls `is_llm_configured()` (`not isinstance(build_provider(), MockProvider)`) rather than the old fragile `active_engine() != "mock-fallback"` string comparison, which had drifted stale after `MockProvider.active_engine_label()` was renamed to return `"unconfigured"`. |
| Ollama is configured but **ignored** / requests hit the wrong endpoint | Provider auto-detect keys on the substrings `"ollama"` or `"11434"` in `LLM_BASE_URL`. The compose **host** port is `11435`, so `http://localhost:11435` matches neither → falls through to the generic OpenAI-compatible provider (`/chat/completions`), which is the wrong path for Ollama (`/api/generate`) | `echo $LLM_BASE_URL` — does it contain `ollama` or `11434`? | In-network use `http://ollama:11434`. From host, set `LLM_PROVIDER=ollama` explicitly, or use a URL containing `11434`. |
| `docker compose up -d` runs but **no root containers start** (Supabase services still come up — they're profile-less) | All root services are **profile-gated** `["dev","prod"]`; the `include:`d Supabase stack isn't | `docker compose config --services` vs `docker compose ps` (ps shows only `db`/`kong`/`auth`/etc.) | Use `docker compose --profile dev up -d --build`. |
| Frontend API calls **404 / return index.html** in local `bun run dev` | Vite dev server binds `:8080` and the default `VITE_API_URL` is also `http://localhost:8080/api` with **no `server.proxy`**, so calls hit the SPA fallback | Open devtools Network: request to `/api/...` returns HTML, not JSON | Set `VITE_API_URL=http://localhost:8085/api` (the Go backend host port) before `bun run dev`. |
| Browser **white screen**, console: `Cannot access 'Gt' before initialization` (or similar TDZ) | Someone re-added a per-package `manualChunks` splitter to `vite.config.ts`; scoped packages sharing module state (`@sentry/*`, `@radix-ui/*`) break | `grep -n manualChunks vite.config.ts` | Remove the splitter; let Rollup chunk automatically. The file carries a warning comment. History in `tayari-failure-archaeology`. |
| **CORS / preflight** failure in browser | Go uses an **explicit** origin allowlist; your frontend origin isn't listed. It never uses `*` with credentials (deliberate) | Check the `Origin` header vs `ALLOWED_ORIGINS`/`CORS_ALLOWED_ORIGINS` | Add your host origin to `ALLOWED_ORIGINS`. Defaults include `localhost`/`127.0.0.1` on 8080/8083/8085/5173. |
| Go server **exits immediately**: `FATAL: Required environment variable JWT_SECRET is not set` | `internal/config/config.go` fatals if `JWT_SECRET` is empty | `echo $JWT_SECRET` | Set `JWT_SECRET` (any non-empty value for local dev). |
| Scripts intermittently **time out** connecting to a service | `localhost` resolves to IPv6 first on macOS; services bind IPv4 | Retry with `127.0.0.1` | `.agents/AGENTS.md` rule: prefer `127.0.0.1` over `localhost` in scripts. |
| Health check works on `:8080`/`:8000`/`:80` in a doc but not on your machine | Those are **container-internal** ports (illustrative snippets in `DEPLOYMENT.md`). Host ports differ | `curl http://localhost:8085/api/health` and `:8002/health` | Use host ports: Go 8085, Python 8002, frontend 8083, Supabase Kong 8000, Studio 3001. Full table in `tayari-build-and-env`. |
| **Signup/login 500s: "Error sending confirmation email"** (Supabase mode) | `supabase-local/.env`'s `ENABLE_EMAIL_AUTOCONFIRM=false` with no mail service in this minimal stack — GoTrue tries to send a real confirmation email and has nowhere to send it | `curl -X POST http://localhost:8000/auth/v1/signup -H "apikey: $ANON_KEY" -d '{"email":"t@example.com","password":"Test12345678!!"}'` → `"msg":"Error sending confirmation email"` | Set `ENABLE_EMAIL_AUTOCONFIRM=true` in `supabase-local/.env`, restart `auth`. |
| **Every login "succeeds" (real GoTrue token issued) but every subsequent `Authorization: Bearer` call to Go 401s** | Go's `VerifyToken` (HMAC) uses root `.env`'s `JWT_SECRET`; GoTrue signs with `supabase-local/.env`'s `JWT_SECRET` — if they don't match byte-for-byte, every token fails verification with no distinguishing error | `diff <(grep ^JWT_SECRET= .env) <(grep ^JWT_SECRET= supabase-local/.env)` | Make the two files' `JWT_SECRET` identical, restart `go-backend`. |
| **Signed in (real Supabase session, `supabase.auth.getSession()` returns a user) but every `apiFetch` call still 401s** | `AuthContext.tsx`'s Supabase branch must write `session.access_token` into `localStorage['auth_token']` — that's the key `src/api/index.ts`'s `apiFetch` reads, a different key than Supabase's own internal session storage. If a future edit removes that write, this regresses silently | Browser devtools: `localStorage.getItem('auth_token')` — null/stale despite an active Supabase session | Fix `onAuthStateChange`/`getSession()` callbacks in `AuthContext.tsx` to write/clear that key. See `lessons.md`'s Supabase-migration entry. |
| PDF export 500s (`weasyprint`/`cairo`/`pango` import error) | WeasyPrint system libs missing when running Python outside Docker | `python -c "import weasyprint"` | Install the libs the Dockerfile lists (`libpango-1.0-0`, `libcairo2`, `libgdk-pixbuf2.0-0`, ...), or run in the container. |
| `python -m pytest eval/runner.py` errors on import (`No module named app` / `No module named yaml`) | Wrong CWD, or missing deps not in `requirements.txt` | Run from `backend/python`; `pip show pytest pyyaml` | `cd backend/python`; `pip install pytest pyyaml`. |
| Optimizer "succeeds" but guardrails/ATS numbers look meaningless | Ran against mock LLM; `_safe_optimize` in the eval runner swallows exceptions too | `curl :8002/health` model_status; check result for `_error` key | Configure a real LLM before trusting any quality number. See `tayari-quality-signal-campaign`. |

---

## 2. The three traps that cost the most time (with their stories)

### Trap A (RESOLVED 2026-07-31) — "The Go suite is red, so I broke something"
Historically, `go test ./...` panicked with 16 nil-pointer failures in `database/sql`, and
newcomers assumed their change broke the build. It hadn't — `tenantMiddleware` called
`s.DB.Conn.QueryRowContext` unconditionally on every request, and the Hermes route tests
passed `&database.DB{Conn: nil}`. **This is fixed**: `tenantMiddleware` now guards
`s.DB == nil || s.DB.Conn == nil` before querying. `go test ./...` (including `-race`) passes
clean today. If you see a full-suite panic now, it's a **new** regression, not this old trap —
investigate it directly rather than assuming it's expected. The DB-free subset
(`go test ./internal/api -run 'TestSmoke|TestRouteParity'` → 19 pass) is still useful as a fast
check, just no longer the only green thing.

### Trap B (RESOLVED) — "It works, look, the resume got optimized!" (it's mock text)
Historically, with no LLM configured the engine returned hardcoded fake resumes/JSON that
*looked* like a real optimization at HTTP 200 — you could burn an afternoon "verifying" a
feature that never called a model. **This is fixed**: `MockProvider`/`llm_complete` now raise
`LLMNotConfiguredError`, which the AI-calling endpoints (`/api/v1/optimizer/optimize`,
`/api/v1/optimize/stream`, `/api/v1/resumes/analyze-text`, etc.) turn into HTTP 503
`{"error":"ai_service_unavailable"}` — there is no more silent-mock-at-200 path to fall into.
**Discriminating experiment:** if an AI-calling endpoint returns 200, a real provider ran; a 503
`ai_service_unavailable` means it's unconfigured. `/health`'s `model_status` field also works
for this (see the triage table above). Never accept AI output as evidence without checking the
response code (`tayari-validation-and-qa`, `tayari-quality-signal-campaign`).

### Trap C — "docker compose up did nothing"
Because every root service is profile-gated, a bare `up` starts none of them (though the
`include:`d Supabase stack still comes up, since it has no profile tag) — the next `curl` to
Go/Python connection-refuses, which looks like a crash, not a no-op.
**Discriminating experiment:** `docker compose ps` shows only `db`/`kong`/`auth`/etc., no
`go-backend`/`python-ai`/`frontend`.
**Fix:** always `--profile dev` (or `--profile prod`).

---

## 3. Where each layer's logs / signals live

| Layer | How to observe |
|---|---|
| Go gateway | stdout of the container/process; `docker compose --profile dev logs go-backend`; `GET /api/health/detailed` |
| Python AI | uvicorn stdout; `docker compose --profile dev logs python-ai`; `GET /health` → `model_status` |
| Celery worker | `docker compose --profile dev logs celery-worker`; Flower UI at `http://localhost:5555` (url-prefix `/flower`) |
| Frontend | browser devtools console + Network tab (white screen → console TDZ) |
| DB | `docker compose --profile dev logs db`; init from `backend/db/*.sql` AND `backend/db/migrations/*.sql` (source of truth) — each must be copied into `supabase-local/volumes/db/init/` with the next `NN-` prefix AND individually mounted in `supabase-local/docker-compose.yml`'s `db:` service (a directory mount is silently invisible to the postgres image's init glob); auth service logs: `docker compose --profile dev logs auth` |

---

## When NOT to use this / use instead

| You want to… | Use |
|---|---|
| The full history of a settled bug (root cause, evidence, status) | `tayari-failure-archaeology` |
| Decide whether a green result is real evidence | `tayari-validation-and-qa` |
| Measure something precisely (health, ATS score, engine identity) | `tayari-diagnostics-and-tooling` |
| Understand *why* the architecture allows a failure mode | `tayari-architecture-contract` |
| Fix env/ports/build toolchain | `tayari-build-and-env` |
| Run/operate the stack | `tayari-run-and-operate` |
| Configure the LLM provider correctly | `tayari-config-and-flags` |

This skill triages; it does not authorize changes. Any fix still routes through
`tayari-change-control`.

---

## Provenance and maintenance

Facts verified against the repo on **2026-07-31**. Re-verify:

```bash
# nil-DB panic mechanism
grep -n 'tenantMiddleware' backend/go/internal/api/middleware.go
grep -n 'Conn: nil' backend/go/internal/api/routes_hermes_test.go
cd backend/go && go test ./... ; echo "exit=$?"   # expect exit=0 (fixed 2026-07-31, see Trap A above)
cd backend/go && go test ./internal/api -run 'TestSmoke|TestRouteParity'  # expect 19 pass

# mock-masking
grep -n 'def llm_complete\|_mock_text\|MockProvider' backend/python/app/services/llm_service.py
grep -n 'model_status' backend/python/app/routes/health.py

# ollama detection substring
grep -n '11434\|ollama' backend/python/app/services/llm_service.py

# profile trap — root services only; the include:d Supabase stack has none
docker compose config --services   # full merged list (root + Supabase)

# vite manualChunks warning
grep -n 'manualChunks' vite.config.ts

# vite dev port vs VITE_API_URL default
grep -n 'port: 8080' vite.config.ts ; grep -n 'VITE_API_URL' src/api/index.ts

# Supabase auth traps (added 2026-07-31)
grep -n 'ENABLE_EMAIL_AUTOCONFIRM' supabase-local/.env
diff <(grep ^JWT_SECRET= .env) <(grep ^JWT_SECRET= supabase-local/.env)   # must be identical
grep -n "localStorage.setItem('auth_token'" src/contexts/AuthContext.tsx  # must appear in the Supabase branch too, not just self-hosted
```

Update rows whose experiment stops reproducing, and bump the date. When Trap A is fixed
(green full suite), move it to `tayari-failure-archaeology` as RESOLVED and delete the row.
