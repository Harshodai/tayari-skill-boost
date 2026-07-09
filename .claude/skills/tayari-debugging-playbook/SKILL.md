---
name: tayari-debugging-playbook
description: >-
  Symptom → triage playbook for Tayari Skill Boost's real failure modes. Load when you
  hit an error, crash, panic, failing test, blank/white screen, HTTP 500/502, CORS
  rejection, port clash, "works in Docker but not locally", a Go nil-pointer panic in
  database/sql, or when AI output "looks fake/generic". Gives symptom→cause→discriminating
  experiment for each verified trap, plus a first-5-minutes triage protocol. Facts
  verified 2026-07-08.
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
- **Profile-gated** — every `docker-compose.yml` service sits behind `profiles: ["dev","prod"]`,
  so `docker compose up -d` with no `--profile` starts **zero** containers.
- **TDZ** — "temporal dead zone": a JS runtime error accessing a `let`/`const` binding before
  it's initialized, e.g. `Cannot access 'Gt' before initialization`.
- **Green subset** — the DB-free Go tests that actually pass today (smoke + route parity).

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

# 4. Is the green Go test subset passing? (isolates "your change" vs "known-red suite")
cd backend/go && go test ./internal/api -run 'TestSmoke|TestRouteParity'
```

If `curl` connection-refuses, the stack isn't up — check `docker compose --profile dev ps`
(see `tayari-run-and-operate`), remembering the profile trap (row 4 below).

---

## 1. Symptom → triage table

| Symptom | Most likely cause | Discriminating experiment | Fix / next step |
|---|---|---|---|
| `go test ./...` panics: **`nil pointer dereference` in `database/sql.(*DB).QueryContext`** | Global `tenantMiddleware` queries `s.DB.Conn` on **every** route; the Hermes tests build the server with `Conn: nil` | `go test ./internal/api -run 'TestSmoke\|TestRouteParity'` (19 pass) vs full `go test ./...` (16 fail) | This is a **known OPEN issue** (as of 2026-07-08), not your change. Use the green subset. Full story in `tayari-failure-archaeology`. To fix: give the test a non-nil fake DB (see `handlers_smoke_test.go`'s `fakeDB()`) or guard `tenantMiddleware` on a nil `Conn`. |
| AI output looks **generic / identical every time / obviously templated** (e.g. always "John Doe, TechCorp, Python/FastAPI/Docker") | `MockProvider` is active — no LLM configured, or the real call threw and `llm_complete` swallowed it | `curl -s http://localhost:8002/health` → `model_status` | If `llm_not_configured`: set an LLM provider (see `tayari-config-and-flags`). `llm_complete` **never raises** — it returns `_mock_text`, so a broken key looks "healthy". |
| Ollama is configured but **ignored** / requests hit the wrong endpoint | Provider auto-detect keys on the substrings `"ollama"` or `"11434"` in `LLM_BASE_URL`. The compose **host** port is `11435`, so `http://localhost:11435` matches neither → falls through to the generic OpenAI-compatible provider (`/chat/completions`), which is the wrong path for Ollama (`/api/generate`) | `echo $LLM_BASE_URL` — does it contain `ollama` or `11434`? | In-network use `http://ollama:11434`. From host, set `LLM_PROVIDER=ollama` explicitly, or use a URL containing `11434`. |
| `docker compose up -d` runs but **no containers start** | All 9 services are **profile-gated** `["dev","prod"]` | `docker compose config --services` vs `docker compose ps` (ps shows nothing) | Use `docker compose --profile dev up -d --build`. The README/DEPLOYMENT docs omit the profile — they are wrong. |
| Frontend API calls **404 / return index.html** in local `bun run dev` | Vite dev server binds `:8080` and the default `VITE_API_URL` is also `http://localhost:8080/api` with **no `server.proxy`**, so calls hit the SPA fallback | Open devtools Network: request to `/api/...` returns HTML, not JSON | Set `VITE_API_URL=http://localhost:8085/api` (the Go backend host port) before `bun run dev`. |
| Browser **white screen**, console: `Cannot access 'Gt' before initialization` (or similar TDZ) | Someone re-added a per-package `manualChunks` splitter to `vite.config.ts`; scoped packages sharing module state (`@sentry/*`, `@radix-ui/*`) break | `grep -n manualChunks vite.config.ts` | Remove the splitter; let Rollup chunk automatically. The file carries a warning comment. History in `tayari-failure-archaeology`. |
| **CORS / preflight** failure in browser | Go uses an **explicit** origin allowlist; your frontend origin isn't listed. It never uses `*` with credentials (deliberate) | Check the `Origin` header vs `ALLOWED_ORIGINS`/`CORS_ALLOWED_ORIGINS` | Add your host origin to `ALLOWED_ORIGINS`. Defaults include `localhost`/`127.0.0.1` on 8080/8083/8085/5173. |
| Go server **exits immediately**: `FATAL: Required environment variable JWT_SECRET is not set` | `internal/config/config.go` fatals if `JWT_SECRET` is empty | `echo $JWT_SECRET` | Set `JWT_SECRET` (any non-empty value for local dev). |
| Scripts intermittently **time out** connecting to a service | `localhost` resolves to IPv6 first on macOS; services bind IPv4 | Retry with `127.0.0.1` | `.agents/AGENTS.md` rule: prefer `127.0.0.1` over `localhost` in scripts. |
| Health check works on `:8080`/`:8000`/`:80` in a doc but not on your machine | Those are **container-internal** ports (stale `DEPLOYMENT.md`). Host ports differ | `curl http://localhost:8085/api/health` and `:8002/health` | Use host ports: Go 8085, Python 8002, frontend 8083. Full table in `tayari-build-and-env`. |
| PDF export 500s (`weasyprint`/`cairo`/`pango` import error) | WeasyPrint system libs missing when running Python outside Docker | `python -c "import weasyprint"` | Install the libs the Dockerfile lists (`libpango-1.0-0`, `libcairo2`, `libgdk-pixbuf2.0-0`, ...), or run in the container. |
| `python -m pytest eval/runner.py` errors on import (`No module named app` / `No module named yaml`) | Wrong CWD, or missing deps not in `requirements.txt` | Run from `backend/python`; `pip show pytest pyyaml` | `cd backend/python`; `pip install pytest pyyaml`. |
| Optimizer "succeeds" but guardrails/ATS numbers look meaningless | Ran against mock LLM; `_safe_optimize` in the eval runner swallows exceptions too | `curl :8002/health` model_status; check result for `_error` key | Configure a real LLM before trusting any quality number. See `tayari-quality-signal-campaign`. |

---

## 2. The three traps that cost the most time (with their stories)

### Trap A — "The Go suite is red, so I broke something" (you probably didn't)
`go test ./...` panics with 16 nil-pointer failures in `database/sql`. Newcomers assume
their change broke the build. **It didn't** — the failures are pre-existing and
environmental. `tenantMiddleware` runs on every request and calls `s.DB.Conn.QueryRowContext`;
the Hermes route tests pass `&database.DB{Conn: nil}` (with a comment falsely claiming
"Hermes routes never touch the Go DB"). Smoke tests survive only because they inject a
non-nil `fakeDB()`.
**Discriminating experiment:** `go test ./internal/api -run 'TestSmoke|TestRouteParity'` → 19
pass. If the green subset passes, your change is fine.

### Trap B — "It works, look, the resume got optimized!" (it's mock text)
With no LLM configured the engine returns hardcoded fake resumes/JSON that *look* like a real
optimization. You can burn an afternoon "verifying" a feature that never called a model.
**Discriminating experiment:** `curl -s http://localhost:8002/health` — if `model_status` is
`llm_not_configured` (or `active_engine` is `mock-fallback`), it's fake. Never accept AI
output as evidence without this check (`tayari-validation-and-qa`, `tayari-quality-signal-campaign`).

### Trap C — "docker compose up did nothing"
Because every service is profile-gated, a bare `up` exits 0 having started nothing, and the
next `curl` connection-refuses — which looks like a crash, not a no-op.
**Discriminating experiment:** `docker compose ps` shows an empty table.
**Fix:** always `--profile dev` (or `--profile prod`).

---

## 3. Where each layer's logs / signals live

| Layer | How to observe |
|---|---|
| Go gateway | stdout of the container/process; `docker compose --profile dev logs go-backend`; `GET /api/health/detailed` |
| Python AI | uvicorn stdout; `docker compose --profile dev logs python-ai`; `GET /health` → `model_status` |
| Celery worker | `docker compose --profile dev logs celery-worker`; Flower UI at `http://localhost:5555` (url-prefix `/flower`) |
| Frontend | browser devtools console + Network tab (white screen → console TDZ) |
| DB | `docker compose --profile dev logs postgres`; init from `backend/db/*.sql` |

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

Facts verified against the repo on **2026-07-08**. Re-verify:

```bash
# nil-DB panic mechanism
grep -n 'tenantMiddleware' backend/go/internal/api/middleware.go
grep -n 'Conn: nil' backend/go/internal/api/routes_hermes_test.go
cd backend/go && go test ./... ; echo "exit=$?"   # expect non-zero (16 fails) until fixed
cd backend/go && go test ./internal/api -run 'TestSmoke|TestRouteParity'  # expect 19 pass

# mock-masking
grep -n 'def llm_complete\|_mock_text\|MockProvider' backend/python/app/services/llm_service.py
grep -n 'model_status' backend/python/app/routes/health.py

# ollama detection substring
grep -n '11434\|ollama' backend/python/app/services/llm_service.py

# profile trap
grep -c 'profiles: \["dev", "prod"\]' docker-compose.yml   # expect 9

# vite manualChunks warning
grep -n 'manualChunks' vite.config.ts

# vite dev port vs VITE_API_URL default
grep -n 'port: 8080' vite.config.ts ; grep -n 'VITE_API_URL' src/api/index.ts
```

Update rows whose experiment stops reproducing, and bump the date. When Trap A is fixed
(green full suite), move it to `tayari-failure-archaeology` as RESOLVED and delete the row.
