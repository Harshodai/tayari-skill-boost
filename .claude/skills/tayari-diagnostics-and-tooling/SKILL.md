---
name: tayari-diagnostics-and-tooling
description: >-
  How to MEASURE Tayari Skill Boost instead of eyeballing it. Load when you need
  a number or a hard pass/fail: is the LLM real or a mock ("llm_not_configured"),
  what is the deterministic ATS score for a resume vs a JD, is the green Go test
  subset still passing, is a service actually healthy, did guardrails fire. Owns
  the diagnostic-surface catalog (Go + Python health endpoints, active_engine()
  labels, the ATS probe, the guardrails probe, the eval report, the Go test
  green subset) WITH interpretation guides (what each number means, thresholds),
  plus three runnable, portable scripts: check_llm_engine.sh, ats_probe.py,
  go_green_subset.sh. Triggers: "is the LLM real", "detect mock", "what's the ATS
  score", "run the eval", "are the go tests green", "is python-ai up",
  model_status, active_engine, health check, mock-fallback. Facts verified 2026-07-08.
---

# Tayari Skill Boost — Diagnostics & Tooling

Purpose: turn "it looks fine" into a measured fact. Every AI endpoint in this
project silently falls back to a **mock** when no LLM is configured (it returns
plausible fake resume/JSON and never errors), so "the demo worked" proves
nothing until you have measured *what actually ran*. This skill catalogs the
diagnostic surfaces and gives you scripts + interpretation for each.

Golden rule: **A green run against the mock engine is not evidence.** Confirm the
engine is real (below) before you trust any AI output. (Verified 2026-07-08.)

Host ports used here (host → container): Python AI `8002 → 8000`, Go gateway
`8085 → 8080`. Inside the compose network use `python-ai:8000`, `go-backend:8080`.
Full port table lives in `tayari-build-and-env`.

---

## The three scripts (run these first)

All live in `scripts/` beside this file. They are portable: they locate the repo
root from their own path, take no hardcoded machine paths, and accept overrides.

```bash
# 1) Is the Python AI engine running a REAL LLM or a mock? (CI-gateable)
./scripts/check_llm_engine.sh                 # default http://localhost:8002/health
#    exit 0 = real (model_status=loaded) · exit 1 = mock · exit 2 = unreachable/unknown
TAYARI_PY_HEALTH_URL=http://python-ai:8000/health ./scripts/check_llm_engine.sh  # inside compose

# 2) Deterministic ATS score for a resume vs a JD (no server, no LLM)
cd backend/python                              # canonical CWD so `app` imports
python3 ../.claude/skills/tayari-diagnostics-and-tooling/scripts/ats_probe.py           # built-in sample
python3 .../scripts/ats_probe.py --resume resume.txt --jd jd.txt
python3 .../scripts/ats_probe.py --json        # raw engine dict

# 3) Is the DB-free GREEN Go test subset passing? (full `go test ./...` is expected-red)
./scripts/go_green_subset.sh                   # exit 0 = the 19 smoke+parity tests pass
```

Why exit codes matter: `check_llm_engine.sh` exits **1** on mock so you can gate
a pipeline — `./scripts/check_llm_engine.sh && run_the_eval` refuses to "prove"
quality against fake output.

---

## Diagnostic surface #1 — Health endpoints (the primary mock detector)

### Python AI engine — `GET /health` (also `/api/health`)
Source: `backend/python/app/routes/health.py`. Returns:
```json
{"status":"ok","service":"python-ai-engine","version":"1.0.0","model_status":"loaded"}
```
INTERPRET `model_status` — **this is the remote mock detector**:
- `"loaded"` → `active_engine() != "mock-fallback"` → a real provider is wired.
  AI results reflect a real model.
- `"llm_not_configured"` → `MockProvider` is active. Every LLM endpoint returns
  fake text. **Do not trust any AI output.**

```bash
curl -s http://localhost:8002/health | jq .model_status
# or just: ./scripts/check_llm_engine.sh
```

### Go gateway — `GET /api/health` and `GET /api/health/detailed`
Source: `backend/go/internal/api/router.go` (`handleHealth`, `handleHealthDetailed`).
`/api/health` returns `{status, service:"go-backend", agent_engine, go_version, uptime, db, ai_service}`.
INTERPRET:
- `db: "connected"|"disconnected"` — is the Go gateway's Postgres reachable. If
  `disconnected`, expect the `tenantMiddleware` DB call to fail on every route
  (see `tayari-failure-archaeology` for the nil-DB panic story).
- `ai_service: "connected"|"disconnected"` — can Go reach the Python engine
  (`AI_SERVICE_URL`/`PYTHON_AI_URL`, default `http://python-ai:8000` in compose).
  `disconnected` here means the frontend's AI calls will 502 at the gateway.
```bash
curl -s http://localhost:8085/api/health | jq '{db, ai_service, agent_engine}'
```
`/api/health/detailed` is deliberately minimal (`{status, service, db, ai_service}`)
— it omits go_version/uptime on purpose so the deployment can't be fingerprinted.

---

## Diagnostic surface #2 — `active_engine()` labels

Source: `backend/python/app/services/llm_service.py`. `active_engine()` returns a
label the `/health` endpoint maps to `model_status`. Any label **other than
`mock-fallback`** maps to `loaded`. Labels and what they mean:

| Label | Provider | Config that produces it |
|-------|----------|--------------------------|
| `mock-fallback` | MockProvider (FAKE) | nothing configured (no `LLM_BASE_URL`, no provider keys) |
| `ollama-<model>` | OllamaProvider (`/api/generate`) | `LLM_BASE_URL` containing `ollama` or `11434` |
| `openrouter/<model>` | OpenRouterProvider | `LLM_PROVIDER=openrouter` + `OPENROUTER_API_KEY`/`LLM_API_KEY` |
| `nvidia-nim/<model>` | NVIDIANIMProvider | `LLM_PROVIDER=nvidia_nim` (or auto) + `NVIDIA_NIM_API_KEY` |
| `openai-compatible (<model>)` | OpenAICompatibleProvider (`/chat/completions`) | generic `LLM_BASE_URL` set |
| `hermes-<model>` | HermesProvider | `HERMES_AGENT_URL` set (tier `hermes`) |

TRAP (Ollama host port): auto-detect keys on the substring `ollama` **or**
`11434` in `LLM_BASE_URL`. Pointing the host at Ollama via `http://localhost:11435`
(the compose HOST port) contains neither → it falls through to the generic
OpenAI-compatible provider, which POSTs `/chat/completions` (wrong path for
Ollama). Inside compose use `http://ollama:11434`. See `tayari-config-and-flags`.

`/health` exposes only `model_status`, not the raw label. To read the exact
label the *running server* would emit, check its logs, or reflect **local** env
(only meaningful if your shell env matches the server's):
```bash
cd backend/python && python3 -c "from app.services.llm_service import active_engine; print(active_engine())"
```

---

## Diagnostic surface #3 — Deterministic ATS probe

Source: `backend/python/app/services/ats_engine.py::heuristic_ats_score`. Pure
Python, no LLM, fully reproducible. Two ways to run it:

```bash
# Local, direct (fastest — no server needed):
cd backend/python
python3 ../.claude/skills/tayari-diagnostics-and-tooling/scripts/ats_probe.py --resume r.txt --jd jd.txt

# Over HTTP (needs the stack up):
curl -s -X POST http://localhost:8002/api/v1/ats/deep \
  -H 'Content-Type: application/json' \
  -d '{"resume_text":"...","job_description":"..."}' | jq '{score, sections_found, keyword_match_pct}'
```
Both call the same function. Return shape (verified):
```
{ score:int 0-100, ats_score, checks:[{name,passed,weight,detail}], sections_found:[...],
  word_count, keyword_match_pct, matched_keywords, missing_keywords, per_ats, pii_check }
```

INTERPRETATION GUIDE:
- `score = 100 * (sum of PASSED check weights) / (sum of all weights)`. Deterministic.
- 14 checks when a JD is given (12 without — the JD-only `Job keyword match` and
  `Job title alignment` are absent). Highest-weight checks (fix these first for
  the biggest jump): **Experience section 12, Skills section 12, Quantified
  achievements 10, Job keyword match 10, Contact email 8, Education 8, Length 8,
  Bullets 8, Action verbs 8**.
- `keyword_match_pct` = `0.7*token_overlap% + 0.3*bigram_overlap%` vs the JD. The
  `Job keyword match` check passes at `>= 45%`.
- `per_ats` re-weights the *same* checks for workday/greenhouse/icims and adds a
  confidence band (`±10` wide when no JD, narrowing to `±6` when signals converge).
  It is an estimate, **not** a real parser.
- Bands (mirror engine constants `ATS_SCORE_HIGH=80`, `ATS_SCORE_MEDIUM=60`):
  `>=80` High (above 80 the bottleneck is interview signal, not keywords) ·
  `60-79` Good · `<60` Needs work.

HONEST LIMITS: **structural only (~7/10 confidence)** — sections, contact, length,
bullets, verbs, metrics, dates, recency, keyword/phrase overlap. It is **NOT** a
real Greenhouse/Workday score, and a grammar-heavy resume can reach ~90% on word
overlap alone. TF-IDF `semantic_similarity_score` misses synonyms. For what each
check means and how the ATS layer relates to the LLM layer, see
`resume-ats-llm-reference`. For acceptance thresholds, see `tayari-validation-and-qa`.

---

## Diagnostic surface #4 — Guardrails probe

Source: `backend/python/app/guardrails/` (`PipelineGate`). Endpoint
`POST /api/v1/guardrails/check` (`app/main.py`). Return shape (verified):
```json
{"all_passed": true,
 "results": {
   "truthfulness":    {"passed": true, "violations": ["original_text not provided — truthfulness skipped"]},
   "keyword_stuffing":{"passed": true, "density_score": 0.0, "flagged_keywords": []},
   "pii":             {"passed": true, "pii_found": []}}}
```
```bash
curl -s -X POST http://localhost:8002/api/v1/guardrails/check \
  -H 'Content-Type: application/json' -d '{"resume_text":"..."}' | jq '{all_passed, results}'
```
**WARN (major trap):** the `/api/v1/guardrails/check` endpoint passes **only**
`optimized_text`. With no `original_text`, `truthfulness` is **SKIPPED and marked
passed** (see the "skipped" note in its `violations`). So `all_passed: true` from
this endpoint means *keyword-stuffing + PII passed*; it says **nothing** about
fabrication. To actually exercise the truthfulness check you must call
`PipelineGate().check(optimized_text=..., original_text=...)` with both texts
(that path runs inside the optimizer, not this endpoint). What each sub-check
flags: truthfulness (invented years/dates/degrees, changed email, ≥3 dropped
employers, or optimized <30% of original length); keyword_stuffing (single-word
density >15%, bigram >10%, a high-risk keyword ≥5×, or a word 3+× in one
sentence); pii (`check_pii`).

---

## Diagnostic surface #5 — Eval report

Source: `backend/python/eval/runner.py` (pytest-compatible). Datasets:
`eval/datasets/ats_scoring_v1.yaml` (ATS cases) and
`eval/datasets/tayari_resume_v1.yaml` (resume-opt cases).

```bash
cd backend/python
python -m pytest eval/runner.py -v            # as tests (assertions)
python -m pytest eval/runner.py -v -k "ats_"  # ATS cases only
python eval/runner.py                          # prints a JSON report to stdout
```
**Prereq:** `pytest` and `pyyaml` are **NOT** in `requirements.txt` — install them
separately (`pip install pytest pyyaml`). `runner.py` imports `pytest` at module
top, so even the direct `python eval/runner.py` run needs it. NLTK is optional.

INTERPRET HONESTLY:
- The ATS cases are deterministic (no LLM) — they meaningfully test scoring bands.
- The **resume-optimization** cases run the optimizer, which uses the **MOCK LLM
  unless a real provider is configured**. Worse, `runner.py._safe_optimize`
  **swallows exceptions** (returns the original text + an `_error` field). So a
  "green" resume-opt eval against the mock proves almost nothing about real
  optimization quality; `test_resume_optimizer_guardrails` passes trivially
  because mock output is short and clean.
- Therefore: **always run `check_llm_engine.sh` first.** If it says mock, treat
  optimizer eval results as "harness ran," not "quality verified." See
  `tayari-quality-signal-campaign` for building a real quality signal, and
  `tayari-validation-and-qa` for the evidence bar.

---

## Diagnostic surface #6 — Go test signal (green subset vs expected-red full suite)

Source of truth: `backend/go/internal/api`. Verified 2026-07-08:
- `cd backend/go && go build ./...` → **succeeds**.
- `cd backend/go && go test ./...` → **FAILS (exit 1)**. 16 tests in
  `tayari-backend/internal/api` panic: `nil pointer dereference` in
  `database/sql.(*DB).QueryContext`. Root cause: the global `tenantMiddleware`
  runs on every route and calls `s.DB.Conn.QueryRowContext(...)`; the Hermes /
  social-auth route tests build the server with `&database.DB{Conn: nil}` →
  nil-deref before the handler runs. Status: OPEN. Full story in
  `tayari-failure-archaeology`.
- **DB-free GREEN subset** (smoke + route-parity build the server with a *non-nil*
  fake DB, so they survive): `go test ./internal/api -run 'TestSmoke|TestRouteParity'`
  → **19 passed**. This is the honest "gateway wiring + route parity intact" signal.

```bash
./scripts/go_green_subset.sh   # runs exactly that subset; exit 0 = green
```
INTERPRET: `go_green_subset.sh` green = wiring and `/api ↔ /api/v1` parity are
intact. If it goes **red**, that is a *real* regression (it is not the known
nil-DB panic — smoke/parity use a non-nil fake DB). CI note: the `go-build` job
runs `go test -race ./...` with no database, so **CI Go is EXPECTED-RED** until
the nil-DB harness bug is fixed — do not read a red CI Go job as a new failure,
but do verify the live GitHub Actions status rather than assuming. Route parity
rules: `tayari-change-control`. Test inventory: `tayari-validation-and-qa`.

---

## Fast triage cheat-sheet

| Question | Command | Read this |
|----------|---------|-----------|
| Is the LLM real? | `./scripts/check_llm_engine.sh` | exit 0 real · 1 mock · 2 down |
| Is Python AI up + real? | `curl -s :8002/health \| jq .model_status` | `loaded` vs `llm_not_configured` |
| Can Go reach Python/DB? | `curl -s :8085/api/health \| jq '{db,ai_service}'` | `connected`/`disconnected` |
| ATS score of a resume? | `ats_probe.py --resume r.txt --jd jd.txt` | score, FAILED high-weight checks |
| Did guardrails fire? | POST `/api/v1/guardrails/check` | truthfulness is SKIPPED there |
| Go wiring/parity intact? | `./scripts/go_green_subset.sh` | exit 0 green (full suite expected-red) |
| Eval numbers real? | `check_llm_engine.sh` **then** `pytest eval/runner.py -v` | mock ⇒ opt eval proves little |

---

## When NOT to use this skill / use instead

- **You have a symptom (crash, 500/502, blank screen, CORS, panic) and need the
  cause** → this skill measures state, it does not triage failures. Use
  `tayari-debugging-playbook` (symptom → cause → discriminating experiment).
- **You need to decide whether a result is "good enough" to ship / acceptance
  thresholds / definition of done** → `tayari-validation-and-qa`.
- **You need the history of a failure ("has this been investigated?")** →
  `tayari-failure-archaeology`.
- **You need to set up the environment, install toolchains, or the port table** →
  `tayari-build-and-env`. **Config/flags/provider env vars** →
  `tayari-config-and-flags`. **Running the stack** → `tayari-run-and-operate`.
- **You need what an ATS check actually measures / ATS↔LLM architecture** →
  `resume-ats-llm-reference`. **Building a real (non-mock) quality signal** →
  `tayari-quality-signal-campaign`.

This skill answers *"what is the number / is it real?"* — not *"why did it break"*
or *"is the number good enough."*

---

## Provenance and maintenance

- All facts and return shapes verified 2026-07-08 against the repo at build time.
  Primary sources (re-open these if a script or interpretation looks stale):
  `backend/python/app/routes/health.py` (model_status mapping),
  `backend/python/app/services/llm_service.py` (`active_engine`, `build_provider`,
  `MockProvider`), `backend/python/app/services/ats_engine.py`
  (`heuristic_ats_score` shape + weights + `ATS_SCORE_HIGH/MEDIUM`),
  `backend/python/app/main.py` (`/api/v1/ats/deep`, `/api/v1/guardrails/check`),
  `backend/python/app/guardrails/` (`PipelineGate` shape),
  `backend/python/eval/runner.py` (`generate_report`, `_safe_optimize`),
  `backend/go/internal/api/router.go` (`handleHealth`/`handleHealthDetailed`),
  `backend/go/internal/api` tests (green subset 19 / full-suite 16 panics).
- Scripts tested from this repo before shipping: `check_llm_engine.sh` (loaded→0,
  mock→1, unreachable→2), `ats_probe.py` (built-in sample scored 84/100; runs from
  backend/python and from any CWD), `go_green_subset.sh` (`ok ... internal/api`,
  exit 0). The scripts hardcode no machine paths — they resolve the repo root from
  their own location and accept `REPO_ROOT` / `TAYARI_PY_HEALTH_URL` overrides.
- MAINTENANCE — re-verify and re-date-stamp when any of these change:
  - The `/health` `model_status` mapping (`"loaded"` vs `"llm_not_configured"`) —
    it is the load-bearing mock detector for `check_llm_engine.sh`.
  - ATS check names/weights or `ATS_SCORE_HIGH/MEDIUM` — the interpretation bands
    and `ats_probe.py`'s "biggest wins" ranking depend on them.
  - The Go nil-DB test panic — when fixed, `go test ./...` becomes green and the
    "expected-red full suite" note here and in `go_green_subset.sh` must change.
  - Host ports (8002/8085) — keep in sync with `tayari-build-and-env`.
