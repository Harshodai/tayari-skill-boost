---
name: tayari-architecture-contract
description: >-
  The load-bearing design decisions of Tayari Skill Boost, WHY they exist, the invariants
  that must hold, and the known-weak points stated plainly. Load when making a design
  decision, adding a service or module boundary, changing data/control flow, deciding
  which layer new code belongs in, or when you need to understand why the system is shaped
  this way. Owns the request-flow map, the invariants (service separation, route parity,
  the never-crash LLM abstraction, the guardrails gate, dual auth, the reflexion loop), and
  the honest weak-points list. Facts verified 2026-07-08.
---

# Tayari Architecture Contract

The system's spine: what is load-bearing, why, and what will break if you violate it. This
skill explains *why* the system is shaped this way. It does not enforce rules (that's
`tayari-change-control`), configure things (`tayari-config-and-flags`), or operate the
stack (`tayari-run-and-operate`).

**Jargon defined once:**
- **Gateway** — the Go service; the single front door for all client traffic.
- **AI engine** — the Python/FastAPI service; the only place LLM/ML/scraping runs.
- **Reverse proxy** — the gateway forwards heavy AI calls to the engine over HTTP.
- **Reflexion loop** — generate → self-critique against a measurable gap report → refine.
- **Guardrails gate** — `PipelineGate`: truthfulness + keyword-stuffing + PII checks run
  before optimized text is emitted.
- **Mock-masking** — the engine returns fake text (never raises) when no LLM is configured.

---

## 1. Topology and request flow

Four first-class services plus async infra:

```
                         ┌─────────────────────────────────────────┐
  Browser (React/Vite)   │  src/  — calls ONLY the Go gateway       │
        │  /api/v1/...    │  (never the Python engine directly)      │
        ▼                 └─────────────────────────────────────────┘
  Go API gateway (Chi)  backend/go/  — auth, CRUD, DB, rate limits, tenant
        │  reverse-proxy AI calls (AI_SERVICE_URL=http://python-ai:8000)
        ▼
  Python AI engine (FastAPI)  backend/python/  — LLM, NLP, ATS, Hermes scraping
        │  enqueue heavy work
        ▼
  Redis  ──►  Celery worker  ──►  Postgres        (Flower observes the queue)
  Ollama (optional local LLM)  ◄── engine + worker call the LLM provider layer
```

Host ports (see `tayari-build-and-env` for the full table): frontend `8083`, Go `8085`,
Python `8002`, Postgres `5433`, Redis `6380`, Flower `5555`, Ollama `11435`.

**Why a Go gateway in front of a Python brain?** The gateway owns latency-sensitive,
security-sensitive concerns (JWT auth, CORS allowlist, rate limiting, tenant resolution,
CRUD) in a fast statically-typed service; the engine owns compute-heavy AI. This keeps AI
dependencies (LLM SDKs, scrapers, WeasyPrint, Playwright) out of the auth path and lets the
two scale and fail independently.

---

## 2. Invariants that must hold

Each: the rule, why, how it's enforced, what breaks if violated.

### 2.1 Service separation
- **Rule.** Go = routing/auth/CRUD/DB only. Python = ALL AI/NLP/scraping/Celery. Frontend
  calls the Go gateway only — never the Python engine directly.
- **Why.** Keeps AI deps out of the auth path; single audited front door; independent scaling.
- **Enforced by.** `.agents/AGENTS.md` (review discipline — not compiler-enforced).
- **Breaks if violated.** LLM logic in Go bloats the gateway and couples auth to AI failures;
  a direct frontend→Python call bypasses auth, CORS, and rate limiting.

### 2.2 Route parity (dual `/api` + `/api/v1` trees)
- **Rule.** Every route is registered under both `/api/...` and `/api/v1/...` (or is listed
  in `knownAsymmetric`).
- **Why.** The repo serves an archive-compatible tree and a versioned tree; they must not drift.
- **Enforced by.** `TestRouteParity_BidirectionalAliases` + `TestRouteParity_KnownAsymmetricStillExists`
  (`backend/go/internal/api/router_parity_test.go`). Details + idiom: `tayari-change-control`.
- **Breaks if violated.** A client hits a silent 404 that no test caught until parity was added.

### 2.3 The LLM abstraction never crashes (and that is a double-edged sword)
- **Rule.** All model calls go through `llm_complete`/`llm_json` in
  `backend/python/app/services/llm_service.py`. A single factory (`build_provider`) selects a
  provider by env priority (hermes → openrouter → nvidia_nim → auto-NIM → ollama → generic
  OpenAI-compatible → **MockProvider**). `llm_complete` wraps the call in try/except and
  returns `_mock_text(...)` on **any** exception or empty result — it NEVER raises.
- **Why.** Design intent: "the API never crashes"; the app degrades to plausible output.
- **Breaks if violated / the danger.** Because failures are swallowed, a **broken or absent LLM
  looks healthy** and produces fake results. This is the project's #1 correctness hazard — see
  Weak Point W1. Detect via `/health` `model_status`.

### 2.4 Guardrails gate before emit
- **Rule.** `PipelineGate.check(optimized_text, original_text, job_description)` runs
  truthfulness + keyword-stuffing + PII before optimized resume text is returned/stored.
- **Why.** Stops fabricated employers/dates/credentials and keyword-stuffed output.
- **Caveat (W3).** Truthfulness is **skipped** when `original_text` is not supplied (it's marked
  passed). The `/api/v1/guardrails/check` endpoint passes only `optimized_text`, so truthfulness
  never runs there. Domain detail: `resume-ats-llm-reference`.

### 2.5 Dual auth must stay consistent
- **Rule.** Go `USE_SUPABASE` and frontend `VITE_USE_SELF_HOSTED` select the same auth world
  (self-hosted JWT vs Supabase). `JWT_SECRET` is required (Go fatals without it).
- **Why.** The platform is self-hostable; the two halves must agree or login breaks.
- **Breaks if violated.** Tokens issued by one side are rejected by the other. Config:
  `tayari-config-and-flags`.

### 2.6 The reflexion loop is the flagship mechanism
- **Rule.** `optimize_with_reflection` generates a rewrite, scores it with a deterministic
  heuristic ATS engine + a fabrication-alignment check, and if `heuristic.score < SCORE_TARGET
  (=85)` OR alignment fails, re-prompts once with a concrete gap report, keeping pass-2 only if
  it's as good or better. Then buzzword-cleanup + humanize + guardrails.
- **Why.** Differentiator vs one-shot GPT: it critiques its own measurable output before emit.
- **Caveat (W2).** The gate it optimizes against is a **structural heuristic**, and it can run
  on the **mock** LLM. Do not read "score ≥ 85" as "recruiter-grade." See
  `tayari-quality-signal-campaign`.

---

## 3. Known weak points (state them plainly)

The honest section. None of these are secret; all are load-bearing risks.

| # | Weak point | Consequence | Where it's covered |
|---|---|---|---|
| **W1** | `llm_complete` swallows all errors → mock text | A broken LLM path looks healthy; results can be fiction | `tayari-quality-signal-campaign`, detect via `tayari-diagnostics-and-tooling` |
| **W2** | Quality gate = structural heuristic ATS (~7/10, gameable by grammar-word overlap) + TF-IDF (no synonyms) | "ATS score 85" is not a real Greenhouse/Workday score | `resume-ats-llm-reference` |
| **W3** | Truthfulness guardrail skipped when `original_text` absent | Fabrication can pass through the standalone guardrails endpoint | §2.4 |
| **W4** | `tenantMiddleware` couples EVERY route to a DB query (`s.DB.Conn`) | Any DB-less server (e.g. tests with `Conn: nil`) panics; source of the 16 red Go tests | `tayari-failure-archaeology` |
| **W5** | `tier` param ("fast"/"smart") is a near no-op — both resolve to the same provider | Callers that expect a cheaper/faster tier don't get one | `tayari-config-and-flags` |
| **W6** | Docs drift from reality (ports, `docker compose` profiles, corrupted README) | Newcomers curl wrong ports / start zero services | `tayari-build-and-env`, `tayari-docs-and-writing` |
| **W7** | CI is partly aspirational (references nonexistent Supabase services; profile-less compose) | "CI exists" ≠ "CI green" | `tayari-validation-and-qa` |

---

## 4. Contract checklist — before adding a feature

- [ ] **Which layer?** AI/NLP/scraping → Python. Auth/CRUD/routing → Go. UI → frontend (calling Go).
- [ ] **New route?** Register both `/api` and `/api/v1` (or `knownAsymmetric`). → `tayari-change-control`.
- [ ] **New page/major component?** Register a flag in `src/config/features.ts`.
- [ ] **Calls an LLM?** Go through `llm_complete`/`llm_json`; confirm a real engine before trusting output.
- [ ] **Emits resume text?** Route it through `PipelineGate`, and pass `original_text` so truthfulness runs.
- [ ] **Touches auth?** Keep `USE_SUPABASE`/`VITE_USE_SELF_HOSTED` consistent; keep `JWT_SECRET` required.
- [ ] **Heavy/long work?** Offload to Celery (`.agents/AGENTS.md`: no blocking loops in Go/Python request paths).

---

## When NOT to use this / use instead

| You want to… | Use |
|---|---|
| The rules a change must pass (gates) | `tayari-change-control` |
| Env vars / provider selection / flags | `tayari-config-and-flags` |
| Run or deploy the stack | `tayari-run-and-operate` |
| ATS/LLM/optimizer internals & formulas | `resume-ats-llm-reference` |
| The history behind a weak point | `tayari-failure-archaeology` |
| The deep fix campaign for the quality signal (W1/W2) | `tayari-quality-signal-campaign` |

---

## Provenance and maintenance

Facts verified against the repo on **2026-07-08**. Re-verify:

```bash
grep -n 'Service Separation\|never call the Python\|ALWAYS be used for AI' .agents/AGENTS.md
grep -n 's.Router.Use\|AI_SERVICE_URL\|PythonAIURL' backend/go/internal/api/router.go backend/go/internal/config/config.go
grep -n 'def build_provider\|def llm_complete\|MockProvider\|_mock_text' backend/python/app/services/llm_service.py
grep -n 'SCORE_TARGET\|optimize_with_reflection\|PipelineGate' backend/python/app/services/optimizer.py
grep -n 'def check' backend/python/app/guardrails/gate.py
grep -n 'tenantMiddleware' backend/go/internal/api/middleware.go     # W4
```

If a boundary or invariant changes (e.g. W4 is fixed, or `tier` becomes meaningful), update
the relevant section and bump the date.
