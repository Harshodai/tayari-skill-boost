---
name: tayari-validation-and-qa
description: >-
  Tayari Skill Boost evidence bar — what counts as proof that a change "works,"
  and the certified test/eval inventory. Load WHEN deciding whether a result is
  real vs mock, running or reading the test/eval suites, adding a Go or Python
  test, judging whether a green check is meaningful, interpreting CI status, or
  writing a "definition of done." Owns: the mock≠passing rule, the verified
  green/red map (Go DB-free subset green, full `go test ./...` red), route-parity
  gate, the eval datasets (ats_scoring_v1 / tayari_resume_v1) and their
  assertions, acceptance thresholds, how to add a test without breaking parity or
  hitting the tenantMiddleware panic, and a done checklist. Facts verified
  2026-07-08.
---

# Tayari Skill Boost — Validation & QA

**Purpose.** Define the *evidence bar*: what a green check actually proves here,
which suites are certified, and how to add a test without breaking the one real
gate (route parity) or hitting a known panic. This skill is about *judging and
producing evidence*. It is deliberately brutal about what the suite does **not**
prove.

All facts below verified against the repo on **2026-07-08**. Re-run the commands
before you trust a number — this repo's "green" is partial.

---

## 0. When NOT to use this skill (use instead)

| You want to… | Use instead |
|---|---|
| Measure/inspect a running service, read `/health`, detect the active LLM engine, time a request | **tayari-diagnostics-and-tooling** |
| Run the deep, campaign-style quality push (bigger datasets, adversarial cases, scoring rubric) | **tayari-quality-signal-campaign** |
| Decide whether a code change is *allowed* to merge (route parity, service separation, flag registration, secret hygiene, minimal-change rule) | **tayari-change-control** |
| Understand *why* the heuristic ATS score is only structural, or its confidence ceiling | **resume-ats-llm-reference** |
| Debug a specific failing test or panic root-cause | **tayari-debugging-playbook** / **tayari-failure-archaeology** |

This skill answers: **"Is this result real, and does the suite actually back it up?"**

---

## 1. THE "MOCK ≠ PASSING" RULE (non-negotiable)

**A green test or a 200 response is NOT evidence the real product worked.** Two
failure modes silently manufacture fake "success" in this repo:

### 1a. The mock LLM masks everything
The Python LLM layer (`app/services/llm_service.py`) returns **mock text on any
exception or empty result, and never raises**. With no LLM configured, the
provider factory falls through to `MockProvider` ("mock-fallback"). So:

- The optimizer produces a plausible-looking optimized resume with **no real
  model behind it**.
- AI endpoints return **200 with mock content**.
- Eval cases about "optimization quality" pass against mock output that was never
  optimized.

**How to know a real engine ran (remote check):** hit the Python health endpoint
and read `model_status`.

```bash
curl -s http://localhost:8002/health        # host port; container-internal is 8000
```

- `model_status: "loaded"`  → a real provider is wired (`active_engine()` is
  something other than `mock-fallback`, e.g. `ollama-<model>`,
  `openrouter/<model>`, `nvidia-nim/<model>`, `openai-compatible (<model>)`,
  `hermes-<model>`).
- `model_status: "llm_not_configured"` → **mock mode. Any AI result is fake.**

For the full engine-detection / provider-selection detail, see
**tayari-diagnostics-and-tooling** and **tayari-config-and-flags**.

### 1b. Swallowed exceptions turn errors into "passes"
`eval/runner.py._safe_optimize(...)` wraps `optimize_with_reflection` in
`try/except` and, **on any exception, returns the original resume text** plus an
`_error` key — then the test proceeds against that unchanged text. A blown-up
optimizer therefore does **not** fail the section/guardrail/ATS assertions; it
quietly degrades to "the input passed." Always check for `_error` in the report
(`generate_report()` surfaces it) before believing an eval result.

**Rule of thumb:** before you write "verified" or "works," answer:
1. Did a **real engine** run? (`model_status == "loaded"`)
2. Did the code path actually **execute**, or did an exception get swallowed?
3. Is the assertion checking a **real behavior**, or a structural artifact the
   mock also satisfies?

If any answer is "no/unknown," downgrade the claim to *"green against mock; real
quality unverified."*

---

## 2. WHAT "GREEN" ACTUALLY MEANS TODAY (verified 2026-07-08)

### Go gateway (`backend/go/`)

| Command | Result | Meaning |
|---|---|---|
| `cd backend/go && go build ./...` | **OK (exit 0)** | Compiles clean. |
| `cd backend/go && go test ./...` | **RED (exit 1)** | 16 tests in `internal/api` **panic** — do not treat as passing. |
| `cd backend/go && go test ./internal/api -run 'TestSmoke\|TestRouteParity'` | **GREEN (19 pass)** | The **DB-free certified subset**. This is the real green you can rely on locally. |

**Why the full suite is red (root cause, verified):** the global
`tenantMiddleware` (in `internal/api/middleware.go`) runs on **every** request and
calls `s.DB.Conn.QueryRowContext(...)` unconditionally. The Hermes and
social-auth tests build the server with `&database.DB{Conn: nil}`
(`newHermesServer` in `routes_hermes_test.go`), and its comment *"Hermes routes
never touch the Go DB"* is **false** because of that middleware. With a nil conn,
the first served request nil-derefs:

```
panic: runtime error: invalid memory address or nil pointer dereference
  database/sql.(*DB).QueryContext.func1
```

Failing set (16): `TestSocialAuthRoutes_ProviderInjection` (+ subtests) and every
Hermes route test (`TestHermesScrape_*`, `TestHermesJobsBoard_*`,
`TestHermesRunsList_*`, `TestHermesRunDetail_*`, `TestHermesUnknownRoute_404`,
`TestHermesUnauthenticated_401`). **Status: OPEN as of 2026-07-08.**

**Why smoke/parity survive:**
- `handlers_smoke_test.go` builds the server with `&database.DB{Conn: fakeDB()}` —
  a **non-nil** stdlib fake driver, so `QueryRowContext` returns a *swallowed
  error* instead of panicking.
- `router_parity_test.go` uses `Conn: nil` too, but only calls `chi.Walk` to walk
  the route tree — it **never serves a request**, so the middleware never runs.

### Python AI engine (`backend/python/`)

| What | Where | Notes |
|---|---|---|
| Unit tests (8 files) | `app/tests/` — `test_optimizer_enhanced.py`, `test_resume_graph.py`, `test_resume_graph_endpoint.py`, `test_resume_graph_extended.py`, `test_resume_graph_storage.py`, `test_resume_parser.py`, `test_career_intelligence.py`, `test_job_application_automation.py` | Run: `cd backend/python && python -m pytest app/tests -v` |
| Eval harness | `eval/runner.py` (pytest-style) | Run: `cd backend/python && python -m pytest eval/runner.py -v`. Filter ATS-only: `-k "ats_"`. |
| Direct module smoke | — | `cd backend/python && python3 -c "from app.services import ats_engine; print(ats_engine.heuristic_ats_score('...','...'))"` — **must run from `backend/python/`** or `app` won't import. |

**Critical gotchas:**
- `pytest` and `pyyaml` are **NOT in `requirements.txt`** — install them
  separately (`pip install pytest pyyaml`) or the eval suite won't even collect.
- The eval **optimization** tests (`test_resume_optimizer_*`) run against the
  **mock LLM** unless a real provider is configured, and swallow exceptions (§1b).
  They prove almost nothing about real optimization quality.
- The **ATS** eval tests (`test_ats_score`, `test_ats_checks`) call
  `heuristic_ats_score` directly — **deterministic, no LLM** — so those *are*
  meaningful (they test the structural scorer, see §4/§5).

### Frontend (`src/`, `e2e/`)

| Command | Covers | Meaning |
|---|---|---|
| `bun run test` | **Only** `src/test/ResumeGraph*.test.tsx` (3 files, hardcoded in `package.json` `test` script) | Do **not** read its green as "the frontend passes." It touches one feature. |
| `bun run lint` | ESLint over repo | Static only. |
| `bun run build` | Vite production build | Compile/bundle only. |
| `bun run test:e2e` | Playwright specs in `e2e/` | **Requires the full stack running** on host ports (see below). Will not pass against nothing. |

`e2e/smoke.spec.ts` targets `http://127.0.0.1:8083` (frontend),
`http://127.0.0.1:8085/api` (Go), `http://127.0.0.1:8002/health` (Python). It uses
**`127.0.0.1`, not `localhost`** (IPv6 timeout avoidance). It registers/logs in a
test user and exercises career-ops CRUD, story-bank, communication suggestions,
route parity, and 401-without-auth. It needs a live DB-backed stack — bring it up
with a profile (`docker compose --profile dev up -d --build`); see
**tayari-run-and-operate**.

---

## 3. CI REALITY — do NOT equate "CI config exists" with "CI green"

Two overlapping workflows both trigger on push + PR to `main`:

- **`.github/workflows/ci.yml`** — jobs: `go-build`, `python-build`,
  `frontend-build`, `docker-compose`, `performance`.
- **`.github/workflows/deploy.yml`** — pytest w/ `--cov-fail-under=80`, `yarn
  lint`, `yarn tsc --noEmit`, `bun test --coverage`, `yarn build`, docker build,
  **placeholder** helm deploy (`echo "Deploy step would run helm upgrade here"`).

**Known-broken / aspirational, verified against the repo:**

| Check | Problem |
|---|---|
| `ci.yml` → `go-build` → `go test -race ./...` | Hits the **same 16 nil-ptr panics** as §2 (no DB in CI). **Expected-red.** |
| `ci.yml` → `docker-compose` → `docker compose up -d --wait` | Passes **no profile**. All 9 services in `docker-compose.yml` are gated behind `profiles: ["dev","prod"]`, so bare `up` starts **zero** services. |
| `ci.yml` → `docker-compose` → health-check `localhost:8008` (supabase-kong) and `localhost:3005` (supabase-studio) | **Those services do not exist** in the current `docker-compose.yml`. The job cannot go green as written. |
| `ci.yml` → `performance` | Runs `scripts/perf_check.sh`, a **simulated placeholder** (sleeps ~1s, writes `perf_time.txt`). Not a real benchmark. |
| coverage ≥80% gates (Go/Python/frontend, both workflows) | Aspirational; the frontend coverage grep is fragile and the Go job can't reach the gate because tests panic first. |

**Rule:** never write "CI is green." Write: *"CI is partly aspirational; several
jobs cannot pass as written; verify the live GitHub Actions status before
claiming anything."* Check the actual run, not the YAML.

---

## 4. CERTIFIED / GOLDEN INVENTORY (the eval datasets)

Two YAML datasets under `backend/python/eval/datasets/`, consumed by
`eval/runner.py`.

### `ats_scoring_v1.yaml` — 15 ATS cases (`ats-001` … `ats-015`)
Deterministic; no LLM. Each case:

| Field | Meaning |
|---|---|
| `id` | e.g. `ats-002` |
| `resume_text`, `job_description` | inputs |
| `expected_min_score`, `expected_max_score` | acceptable score band (0–100) |
| `expected_checks` | check names that **must pass** |
| `expected_failures` | check names that **must fail** |

Check names used across the dataset (the engine reports ~14 checks total; these 12
are asserted): `Contact email`, `Phone number`, `Experience section`, `Education
section`, `Skills section`, `Summary / objective`, `Optimal length`, `Bullet
points`, `Action verbs`, `Quantified achievements`, `Dates present`, `Recent
experience visible`.

Assertions in `runner.py`:
- `test_ats_score` → `expected_min_score <= score <= expected_max_score`.
- `test_ats_checks` → each name in `expected_checks` is `passed==True`; each in
  `expected_failures` is `passed==False`.

These are **real, meaningful tests** of the structural scorer (see §5 for what
that scorer can and can't claim).

### `tayari_resume_v1.yaml` — 20 resume-optimization cases (`rso-001` … `rso-020`)
Stratified by `category`: `fresh_grad`, `mid_career`, `senior_exec`,
`career_change`, `gap_resume`, `non_standard`. Each case:

| Field | Meaning |
|---|---|
| `id`, `category` | e.g. `rso-005`, `senior_exec` |
| `resume_text`, `job_description` | inputs |
| `expected_tags` | e.g. `[truthful, keyword_stuffing, pii_clean, length_ok]` (label set; not all directly asserted) |
| `expected_min_ats_score` | floor for the **optimized** resume's ATS score |
| `expected_sections` | sections that must survive optimization, e.g. `[summary, experience, education, skills]` |

Assertions in `runner.py` (all run through `_safe_optimize`, so **mock-tainted** —
see §1b):
- `test_resume_optimizer_sections` → every `expected_sections` entry appears
  (lowercased) in `optimized_text`.
- `test_resume_optimizer_guardrails` → `PipelineGate().check(optimized_text,
  original_text).all_passed is True`. **Caveat:** with mock output (short, clean)
  this passes trivially. Also note truthfulness only runs when `original_text` is
  passed (it is, here) — but the mock text is so short it rarely trips anything.
- `test_resume_optimizer_ats_score` → `heuristic_ats_score(optimized_text) >=
  expected_min_ats_score`.

**Honest read:** the ATS-dataset tests are trustworthy; the resume-optimization
tests are structural + guardrail sanity that **the mock also satisfies**. Treat
green on `rso-*` as "the pipeline didn't crash and produced something
structurally plausible," not "the optimizer is good."

---

## 5. ACCEPTANCE-THRESHOLD DISCIPLINE

Numbers you'll see, and exactly what they measure:

| Threshold | Where | What it means | What it does NOT mean |
|---|---|---|---|
| ATS `score` **≥80 = passing, ≥90 = excellent** | cv-tailor convention over `heuristic_ats_score` | A **structural** completeness/keyword heuristic (contact info, sections, bullets, action verbs, quantified achievements, length, dates). Deterministic, ~7/10 confidence. | Not a real Greenhouse/Workday/Taleo score. ~91% is reachable from grammar-word overlap if stopwords are weak. |
| Keyword coverage **≥80%** | `_phase2_keyword_matrix` / `categorize_jd_keywords` | Fraction of JD hard/soft/domain keywords present in the resume. | Literal token/bigram presence — **no synonym matching** (TF-IDF cosine, pure stdlib). |
| `SCORE_TARGET = 85` | `optimizer.py` reflexion loop | Below this (or if not aligned), the optimizer re-prompts **once** and keeps pass-2 only if score ≥ pass-1 or it fixed alignment. | An internal target for the heuristic, not an external quality guarantee. |
| Coverage **≥80%** | CI gates (`ci.yml`, `deploy.yml`) | Line-coverage floor the jobs *try* to enforce. | Aspirational (§3); currently unmet / unreachable in Go. |

**Discipline:** when you report a score, name the metric and its ceiling. Say
*"heuristic ATS 84/100 (structural; not a real-ATS score)"*, never *"84% ATS
pass."* For the full breakdown of the scorer's limits, see
**resume-ats-llm-reference**.

---

## 6. HOW TO ADD A TEST

### 6a. Go table-test (in `internal/api`)

**Avoid the panic:** build the server with a **non-nil** fake DB, never
`Conn: nil`. The helper already exists — `newSmokeServer(t)` in
`handlers_smoke_test.go` wraps `NewServer(&hermesMockAuth{}, &config.Config{},
&database.DB{Conn: fakeDB()})`. `fakeDB()` registers a stdlib no-op driver whose
queries return errors (swallowed by `tenantMiddleware`) instead of nil-derefing.

Pattern:

```go
func TestSmoke_MyRoute(t *testing.T) {
    srv := newSmokeServer(t)            // non-nil fake DB → tenantMiddleware passes
    req := httptest.NewRequest(http.MethodGet, "/api/v1/my/route", nil)
    req.Header.Set("Authorization", "Bearer tok") // hermesMockAuth accepts any non-empty token
    w := httptest.NewRecorder()
    srv.Router.ServeHTTP(w, req)
    if w.Code != http.StatusOK {
        t.Fatalf("want 200, got %d (body=%s)", w.Code, w.Body.String())
    }
}
```

**Do not break route parity.** If your feature adds a route, register **both**
`/api/...` and `/api/v1/...` in `router.go` (change-control rule). The parity
tests will fail otherwise:
- `TestRouteParity_BidirectionalAliases` — every `/api` route needs its `/api/v1`
  counterpart and vice versa, unless listed in `knownAsymmetric`.
- `TestRouteParity_KnownAsymmetricStillExists` — stale allowlist entries fail.

If asymmetry is **intentional**, add a one-line `"METHOD /api/v1/…": true` entry
to `knownAsymmetric` in `router_parity_test.go` (and leave a `// ponytail:`
rationale if the choice is non-obvious). See **tayari-change-control** for the
full parity doctrine.

Run your new test with the DB-free subset so you don't drown in the 16 known
panics:

```bash
cd backend/go && go test ./internal/api -run 'TestSmoke|TestRouteParity' -v
```

### 6b. Python eval case

Add a case to the appropriate YAML with the required `expected_*` fields:

- **ATS case** → `eval/datasets/ats_scoring_v1.yaml`, under `dataset.cases`:
  needs `id`, `resume_text`, `job_description`, `expected_min_score`,
  `expected_max_score`, `expected_checks`, `expected_failures`. Pick check names
  from the list in §4. This is deterministic, so choose the score band by actually
  running `heuristic_ats_score` on your text first.
- **Resume-opt case** → `eval/datasets/tayari_resume_v1.yaml`: needs `id`,
  `category`, `resume_text`, `job_description`, `expected_tags`,
  `expected_min_ats_score`, `expected_sections`. Remember these run against the
  **mock LLM** unless a real provider is configured — keep `expected_min_ats_score`
  realistic for structural output.

Verify locally:

```bash
cd backend/python && python -m pytest eval/runner.py -v -k "ats_"     # ATS-only
cd backend/python && python -m pytest eval/runner.py -v               # all
```

### 6c. Always compile-check Python before you commit

`AGENT_SPEC.md` makes `py_compile` a required validation gate:

```bash
cd backend/python && python -m py_compile app/**/*.py   # (or the specific files you touched)
```

---

## 7. DEFINITION OF DONE (checklist before you claim a change "works")

Run the ones relevant to what you touched. Do not claim "works" on "should work."

- [ ] **Compiles / builds.** Go: `cd backend/go && go build ./...`. Frontend:
      `bun run build`. Python: `python -m py_compile` on changed files.
- [ ] **Real behavior exercised, not mock.** If the change touches an AI path,
      confirm `model_status: "loaded"` at `curl http://localhost:8002/health`
      before trusting output. If it's mock, say so explicitly.
- [ ] **No swallowed exception hid a failure.** For eval runs, check the report
      for `_error` keys (`generate_report()` surfaces them).
- [ ] **Go DB-free subset green:**
      `cd backend/go && go test ./internal/api -run 'TestSmoke|TestRouteParity'`
      → **19 pass**. (Full `go test ./...` is expected-red; note it, don't be
      surprised by it.)
- [ ] **Route parity intact** if you added/changed a route — both prefixes
      registered, or `knownAsymmetric` updated. Covered by the parity subset above.
- [ ] **Python unit/eval** relevant to your change:
      `cd backend/python && python -m pytest app/tests -v` and/or
      `python -m pytest eval/runner.py -v` (install `pytest pyyaml` first).
- [ ] **Frontend**, if touched: `bun run lint`; `bun run test` (remember it only
      covers ResumeGraph*); e2e only if the full stack is up.
- [ ] **Claims are scoped honestly.** Every score names its metric and ceiling
      (§5). No "CI green," no "beats real ATS," no "recruiter-grade" without
      evidence.
- [ ] **State what you did NOT verify.** Explicitly list untested paths.

---

## Provenance and maintenance

- **Verified 2026-07-08** against the repo by re-opening and/or running:
  `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`,
  `backend/python/eval/runner.py`,
  `backend/python/eval/datasets/ats_scoring_v1.yaml` (15 cases),
  `backend/python/eval/datasets/tayari_resume_v1.yaml` (20 cases),
  `backend/go/internal/api/router_parity_test.go`,
  `backend/go/internal/api/handlers_smoke_test.go`,
  `backend/go/internal/api/routes_hermes_test.go`, `package.json`,
  `e2e/smoke.spec.ts`, `backend/python/CLAUDE.md`.
- **Live-confirmed commands (2026-07-08):**
  `go test ./internal/api -run 'TestSmoke|TestRouteParity'` → **19 pass**;
  `go test ./internal/api/` → **panic** (`database/sql.(*DB).QueryContext`,
  nil-ptr) with `TestSocialAuthRoutes_ProviderInjection` and the `TestHermes*`
  set failing.
- **Re-verify when:** the tenantMiddleware / nil-DB panic is fixed (the 16-fail
  set should shrink and `go test ./...` may go green — update §2/§3/§7); eval
  datasets gain/lose cases (counts in §4); `package.json` `test` script changes
  which files it runs (§2); CI workflows are corrected (the supabase-kong/studio
  health checks or the missing compose profile — §3); or `heuristic_ats_score`
  check names change (§4).
- **Sibling skills:** gating rules → **tayari-change-control**; measuring/health
  tooling → **tayari-diagnostics-and-tooling**; the deep quality push →
  **tayari-quality-signal-campaign**; ATS heuristic limits →
  **resume-ats-llm-reference**; running the stack → **tayari-run-and-operate**;
  debugging a failure → **tayari-debugging-playbook** /
  **tayari-failure-archaeology**.
