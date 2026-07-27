# Tayari Skill Boost — Ruthless End-to-End Audit Plan

**Goal:** Make this product actually usable when released. No silent mocks. No dead routes. No fake chains. No missing social graph. Every feature the UI advertises must work end-to-end or be explicitly gated off.

**Repo:** `/Users/harshodaikolluru/Public/tayari-skill-boost`
**Scope:** All features end-to-end **except interview prep** (Interview Board *is* in scope — only the prep/voice-coach sub-feature is out). Centerpiece: resume-optimization **quality signal** (gameable heuristic + silent mock-LLM fallback). Plus: in-browser popups, copilot automations (resume optimizer ↔ smart job search ↔ interview board), LinkedIn/Facebook-style friends + shared interview questions, and all other backends.
**Mode:** Build mode (read+write+execute).
**Outputs:** `AUDIT_REPORT.md` + `AUDIT_DASHBOARD.html` in repo root.

---

## 0. Release-Readiness Definition of Done

A feature is **Release-Ready** iff ALL of:
1. **Frontend → Go → Python → DB** chain is wired with no 404s and no silent mock fallback.
2. Every LLM-touching endpoint either (a) returns real model output, or (b) returns an explicit `503 llm_not_configured` — **never** returns 200 with `_mock_text`.
3. Route parity holds: every `/api/...` has `/api/v1/...` alias and vice versa (CLAUDE.md invariant).
4. The feature is covered by at least one test that **fails** when the LLM is mock (the "mock ≠ passing" rule).
5. `check_llm_engine.sh` exits 0 in CI before any eval runs.
6. No real secrets in any tracked or gitignored-but-local file.
7. No unauthenticated admin surfaces (Flower) in the `prod` profile.
8. Docs that describe the feature are dated within 7 days of last code change.

Anything short of this = **not release-ready**. The audit names every gap.

---

## 1. Evidence Base (already gathered, read-only)

Five parallel explore agents mapped the repo. Findings that anchor the plan:

### 1.1 Quality signal is untrustworthy (CENTERPIECE)
- `backend/python/app/services/llm_service.py:385-388` — `llm_complete()` silently returns `_mock_text()` on any provider exception OR empty result. No exception raised.
- `llm_service.py:413-430` — `_mock_text()` optimize branch returns a full `<<<META>>>/<<<RESUME>>>` formatted senior-engineer resume that passes `_parse_marked_output` (line 238) and flows through the **entire** optimizer + guardrails + ATS re-score as if real.
- `llm_service.py:280` — `HermesProvider.complete()` falls back to `_mock_text()` on any error.
- `backend/go/internal/api/routes_resume_extra.go:62-86` — `handleAnalyzeText` returns hardcoded score-88 fallback on AI failure. **Silent.**
- `routes_resume_extra.go:122-142` — `handleAnalyzeResume` returns hardcoded score-85 fallback. **Silent.**
- `backend/python/eval/runner.py:36-37` — `_safe_optimize` "may use mock LLM"; `tayari_resume_v1` eval **passes against MockProvider**. Green eval ≠ real model works.
- `backend/python/app/services/ats_engine.py:242` — `heuristic_ats_score` is a deterministic weighted checklist (contact, sections, skills, bullets, action verbs, quantified achievements, keyword match). Gameable by keyword stuffing.
- **Designed gate exists but isn't enforced:** `.claude/skills/tayari-diagnostics-and-tooling/scripts/check_llm_engine.sh` exits 1 on mock — not wired into CI.

### 1.2 Smart Job Search + Autopilot HTTP surface is completely unwired in Go
- `backend/go/internal/api/routes_mvp.go:116-846` — every handler (`handleJobSearch`, `handleSaveJob`, `handleListSavedJobs`, `handleAutopilotStart`, `handleListAutopilotRuns`, `handleGetAutopilotRun`, `handleCreateApplication`, `handleListApplications`, `handleDeleteApplication`, `handleDownloadApplicationResume`, schedule CRUD) is **dead code**. No `routes*()` function registers them. `router.go` never calls a wiring function for them.
- Frontend calls that **404 today**: `searchJobs` (`/jobs/search`), `agentSearch` (`/jobs/agent-search`), `saveJob` (`/jobs/save`), `listSavedJobs` (`/jobs/saved`), `startAutopilot` (`/autopilot/start`), `listAutopilotRuns` (`/autopilot/runs`), `getAutopilotRun` (`/autopilot/runs/{id}`), all `/autopilot/applications` + `/autopilot/schedules`.
- Extension calls that **404**: `handleTrackApplication` → `/v1/autopilot/applications` (`extension/background.js:166`); `handleQueueForReview` → `/v1/review-queue/queue` (`:202`); popup stats → `/v1/stats` (`extension/popup.js:146`).
- `routes_applications_extra.go:42-54` registers `/api/v1/applications` (Kanban) which **shadows** the dead `handleListApplications`/`handleCreateApplication` — so the Kanban board works, but the autopilot applications path does not.

### 1.3 Two parallel "apply" chains, not unified
- **Frontend `applyChain.ts`** (commit fb50398, `src/lib/automation/applyChain.ts:28-91`) — real, 4 steps: saveJob → optimizeResume → generateCoverLetter → createApplication. No quality gate. Triggered from `JobSearch.tsx:258` and `Dashboard.tsx:107`.
- **Backend `run_autopilot`** (`backend/python/app/services/automation_engine.py:226`) — server-side: LOAD → SEARCH → SELECT → TAILOR → SCORE → LETTER → QUALITY_GATE → APPLY (auto_apply off by default, lands in review queue). Triggered only from `AutoPilot.tsx:90-122`.
- `JobSearch.tsx:268-275` `handleQueueAutoPilot` is a **fake** — calls `startRun` preview, toasts "AutoPilot is a preview — nothing was submitted."
- **No cross-feature glue**: job-search hits don't trigger resume re-optimize; resume optimization doesn't re-query jobs; interview board has no inbound automation from either chain.

### 1.4 Interview Board is single-user only; social graph is entirely absent
- `src/pages/InterviewBoard.tsx` — Kanban, per-user. AI questions stored as JSONB on `applications.interview_research` (`backend/db/migrations/20260625_archive_integration.sql:34`). No sharing, no visibility column, no `interview_questions` table.
- **Zero social-graph infra**: no `connections`/`friends`/`follows`/`shares`/`feed_items` tables; no Go routes; no Python services; no frontend pages. `Profile.tsx` is self-edit only.
- Auth model is ready: both self-hosted JWT (`internal/auth/local.go`) and Supabase (`internal/auth/supabase.go`) key on `auth.users.id` UUID. A friends graph hangs off it without auth changes.

### 1.5 Duplicate scorers/guards + dead routes
- Two ATS scorers: `ats_engine.heuristic_ats_score` (used by optimizer + eval + `/api/v1/ats/deep`) vs `app.scoring.ats_scorer.ATSScorer` (used by `routes/ats.py` `/api/v1/ats/analyze`). Different logic.
- Two truth-check guards: `guardrails/truthfulness.py:check_truthfulness` (used by `PipelineGate`) vs `guardrails/truth_gate.py:verify_resume_truthfulness` (used by `typst_builder` + `/api/v1/guardrails/truth-check`). Different return types.
- `handleDeepATS` (`routes_mvp.go:922`) defined, proxies to Python `/api/v1/ats/deep`, but **never routed**. Frontend `deepATS()` (`src/api/index.ts:350`) 404s. Python endpoint exists (`main.py:345`).
- `verifyResumeTruthfulness` (`src/api/index.ts:1153`) defined in frontend, **never called from any page**.

### 1.6 Security / infra flags
- Real `OPENROUTER_API_KEY` in gitignored `/.env:50` (`sk-or-v1-...`). **Rotate.**
- `SupabaseAuth.VerifyToken` (`backend/go/internal/auth/supabase.go:42-68`) lacks `WithIssuer`/`WithExpirationRequired` — weaker than Local (`local.go:168`). Manually checks `exp`, doesn't validate issuer.
- `.env` has `VITE_USE_SELF_HOSTED=true` AND `USE_SUPABASE=true` simultaneously — opposite intents; shared JWT_SECRET makes tokens interop but the pairing is unusual.
- `docker-compose.yml:116` — `FLOWER_UNAUTHENTICATED_API=true` ships in `prod` profile. Unauthenticated Celery dashboard.
- `backend/python/requirements.txt:35` — `slowapi` is the only unpinned Python dep.
- `Dockerfile.ai` (python:3.12) vs `backend/python/Dockerfile` (python:3.11) — drift; only the latter is used by compose.
- `docker-compose.yml:141` — `JWT_SECRET=${JWT_SECRET:-tayari-dev-secret-change-me}` dev fallback committed.
- DB creds hardcoded `tayari:tayari_dev` at compose lines 35,83,118,139,236.
- Profile trap: every service declares `profiles:` — bare `docker compose up -d` starts nothing. Requires `COMPOSE_PROFILES=dev` (set in `.env:8`).
- `extension/package.json` missing from tree.

### 1.7 Docs trust
- Backend READMEs (`backend/README.md`, `backend/go/README.md`, `backend/python/README.md`) — 2026-02-01, ~6 months stale.
- `AGENT_SPEC.md`, `DEPLOYMENT.md`, `IMPLEMENTATION_SUMMARY.md`, `extension/README.md` — 2026-06-20, ~37 days stale.
- `backend/python/CLAUDE.md` — 2026-07-08, ~19 days stale.
- `README.md`, `CLAUDE.md`, `lessons.md` — fresh (within 5 days).

### 1.8 Web-search grounding (done)
- `@supabase/supabase-js` latest 2.110.9; repo on ^2.90.1 — behind but compatible. Node 20 EOL'd Apr 2026, dropped in 2.110.0.
- GitHub Advisory DB: no critical CVEs against the pinned stack in a quick scan — full per-dep CVE pass is Phase D.

---

## 2. Audit Dimensions (the report spine)

| # | Dimension | Method | Weight |
|---|---|---|---|
| 1 | **Per-feature readiness matrix** | F→Go→Py→DB trace per feature; rate E2E-Ready / Partial / Stub / Missing; name the exact break | Spine |
| 2 | **Resume-optimization quality signal** | `check_llm_engine.sh` + `ats_probe.py` + `tayari_resume_v1` eval real-vs-mock; document every silent-mock path; gameability test | **Centerpiece** |
| 3 | **In-browser popups (extension)** | Manifest/content/popup review; hit every extension endpoint; confirm which 404 | Standard |
| 4 | **Copilot automations (resume↔search↔interview)** | Trace `applyChain.ts` + `run_autopilot`; document two-track split; identify glue gaps | Standard |
| 5 | **Social graph + interview-board sharing** | Gap analysis + build plan (DB schema, Go routes w/ parity, Python feed, frontend pages) | Standard |
| 6 | **Security** | JWT/CORS/secrets/auth-switch; rotate OpenRouter key; harden Supabase VerifyToken | Standard |
| 7 | **Dependencies & CVEs** | Per-dep web search vs GitHub Advisory DB + OSV.dev | Standard |
| 8 | **Infra & build** | docker-compose profile trap, Dockerfile drift, healthchecks, port mapping | Standard |
| 9 | **Route parity** | `go_green_subset.sh` + spot-check missing `/jobs/*` `/autopilot/*` | Standard |
| 10 | **Docs trust** | Doc-of-record freshness vs last code change | Standard |
| 11 | **Frontend UI quality** | a11y/perf/theming/responsive/anti-patterns static scan of key pages | Standard |

---

## 3. Execution Plan

### Phase A — Runtime spin-up (state-changing)
1. `docker compose --profile dev up -d --build` (respect the profile trap).
2. `curl localhost:8085/api/health` and `curl localhost:8002/health` — capture `active_engine` / `model_status`.
3. Run `.claude/skills/tayari-diagnostics-and-tooling/scripts/check_llm_engine.sh` → expect exit 1 (mock) unless `LLM_BASE_URL` set.
4. Run `.claude/skills/tayari-diagnostics-and-tooling/scripts/ats_probe.py` → deterministic ATS baseline.
5. Run `.claude/skills/tayari-diagnostics-and-tooling/scripts/go_green_subset.sh` → confirm wiring intact.
6. `cd backend/python && python -m pytest eval/runner.py -v` → confirm eval passes against mock (the "green lies" finding).

### Phase B — Feature E2E probes (curl + browser)
7. `curl -X POST localhost:8085/api/v1/jobs/search` → expect 404 (dead-route finding).
8. `curl -X POST localhost:8085/api/v1/autopilot/start` → expect 404.
9. `curl -X POST localhost:8085/api/v1/resumes/{id}/ats-deep` → expect 404 (`handleDeepATS` unrouted).
10. Load extension in Chrome → exercise popup + floating panel → capture which backend calls fail.
11. Playwright smoke: load `/resume`, `/jobs`, `/interview`, `/jobs/autopilot` → capture console errors / 404s.

### Phase C — Quality-signal deep dive (CENTERPIECE)
12. Set `LLM_BASE_URL` to OpenRouter (rotated key). Run optimizer on a sample resume+JD → capture real output.
13. Unset `LLM_API_KEY` → run same input → confirm 200 with `_mock_text` content (proves silent flow).
14. Diff real vs mock outputs; show `tayari_resume_v1` eval passes **both** ways (proves eval doesn't discriminate).
15. Gameability test: feed `heuristic_ats_score` a keyword-stuffed resume → show score inflates past 80 (proves gameability).
16. Document every silent-mock entry point with file:line in the report.

### Phase D — Web search (ruthless)
17. Per-dep CVE search: Go modules (`go.mod`), Python (`requirements.txt`), npm (`package.json`), extension — vs GitHub Advisory DB + OSV.dev.
18. Stack best-practices: FastAPI 0.115.x, Chi v5, Vite 5, shadcn/ui, JWT/Supabase auth current guidance, Ollama integration, browser-use/Playwright patterns.
19. Competitor benchmarks: Jobscan, ResumeWorded, Teal, Sonara, LazyApply — ATS-scoring approaches + resume-optimizer SaaS patterns for the novel-vs-known claims table.

### Phase E — Synthesis & report
20. Build the per-feature readiness matrix (Section 1 of report).
21. Write the quality-signal deep section (Section 2): gameability + silent-mock + eval-blindness + recommended fix campaign (gate `check_llm_engine.sh` in CI, make mock fallback explicit 503, add a real-LLM eval dataset, replace/augment heuristic scorer with semantic).
22. Social-graph build plan (Section 5): DB schema (`connections`, `shared_interview_questions`, optional `feed_events`), Go routes with `/api`+`/api/v1` parity, Python feed service, frontend pages (`Network.tsx`, `SharedInterviewBoard.tsx`), feature flag.
23. Cross-cutting findings (Sections 6-10) with P0–P3 severity.
24. Frontend UI audit (Section 11) per the `audit` skill: a11y/perf/theming/responsive/anti-patterns, scored 0-4 per dimension.
25. Generate `AUDIT_REPORT.md` + `AUDIT_DASHBOARD.html`.

---

## 4. Per-Feature Readiness Matrix (target — to be filled during execution)

| Feature | Frontend | Go route | Python | DB | Status | Break |
|---|---|---|---|---|---|---|
| Resume Optimizer | ✅ `ResumeResults.tsx` | ✅ `/v1/resumes/{id}/optimize` | ✅ `optimizer.py` | ✅ `resumes` | **Partial** | Silent mock fallback; gameable scorer |
| ATS Deep Score | ✅ `deepATS()` | ❌ `handleDeepATS` unrouted | ✅ `/v1/ats/deep` | n/a | **Stub** | 404 on frontend call |
| Free ATS Scan | ✅ `FreeAtsScan.tsx` | ✅ `/v1/public/analyze-text` | ✅ `analyze_resume` | n/a | **Partial** | Silent mock fallback |
| Smart Job Search | ✅ `JobSearch.tsx` | ❌ `handleJobSearch` unrouted | ✅ `job_agent.smart_search` | n/a | **Stub** | 404 — dead route |
| Saved Jobs | ✅ `listSavedJobs` | ❌ `handleListSavedJobs` unrouted | n/a | ✅ `saved_jobs` | **Stub** | 404 |
| Autopilot (server) | ✅ `AutoPilot.tsx` | ❌ `handleAutopilotStart` unrouted | ✅ `run_autopilot` | ✅ `autopilot_runs` | **Stub** | 404 — dead route |
| Autopilot (frontend chain) | ✅ `applyChain.ts` | (uses other routes) | n/a | ✅ | **Partial** | No quality gate; `handleQueueAutoPilot` is fake |
| Review Queue | ✅ `AutoPilot.tsx:124-150` | ✅ `/v1/review-queue` | n/a | ✅ | **E2E-Ready** | — |
| Hermes scrape | ✅ | ✅ `/v1/hermes/*` | ✅ `HermesScraper` | ✅ | **E2E-Ready** | — |
| Browser automation | ❌ no UI | ✅ `/v1/browser/automation` | ✅ `run_browser_agent` | n/a | **Partial** | `browser_library.py:66` silently returns True on failure |
| Interview Board (single-user) | ✅ `InterviewBoard.tsx` | ✅ `/v1/applications` | ✅ `interview_ai.py` | ✅ `applications` | **E2E-Ready** | — |
| Interview Board (shared) | ❌ | ❌ | ❌ | ❌ | **Missing** | Greenfield — see build plan |
| Social graph / friends | ❌ | ❌ | ❌ | ❌ | **Missing** | Greenfield — see build plan |
| Browser extension | ✅ | ⚠️ partial (`/extension/capture`, `/extension/quick-ats` work; `/autopilot/applications`, `/review-queue/queue`, `/stats` 404) | n/a | ✅ | **Partial** | 3 dead endpoints |
| Auth (self-hosted) | ✅ | ✅ | n/a | ✅ `auth.users` | **E2E-Ready** | — |
| Auth (Supabase) | ✅ | ✅ | n/a | ✅ | **Partial** | VerifyToken weaker than Local |
| Billing | ✅ | ✅ `routes_billing.go` | n/a | ✅ | (verify) | — |

---

## 5. Social Graph + Shared Interview Board — Build Plan

### 5.1 DB (new migration `backend/db/migrations/20260728_social_graph.sql`)
```sql
CREATE TABLE IF NOT EXISTS public.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  CHECK (requester_id <> addressee_id),
  UNIQUE (requester_id, addressee_id)
);
CREATE INDEX idx_connections_addressee_status ON public.connections (addressee_id, status);
CREATE INDEX idx_connections_requester_status ON public.connections (requester_id, status);

CREATE TABLE IF NOT EXISTS public.shared_interview_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  question_text text NOT NULL,
  category text,
  why_asked text,
  how_to_answer text,
  visibility text NOT NULL DEFAULT 'connections' CHECK (visibility IN ('private','connections','public')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_shared_questions_user ON public.shared_interview_questions (user_id, created_at DESC);
CREATE INDEX idx_shared_questions_visibility ON public.shared_interview_questions (visibility, created_at DESC);
```
Enable RLS; policies: users see their own rows + rows from accepted connections where `visibility='connections'` + all `visibility='public'`.

### 5.2 Go gateway (new `backend/go/internal/api/routes_social.go`)
Register **both** trees (route parity):
- `POST /api/v1/connections` + `/api/connections` — request
- `POST /api/v1/connections/{id}/accept` + alias — accept
- `DELETE /api/v1/connections/{id}` + alias — decline/remove
- `GET /api/v1/connections` + alias — list accepted
- `GET /api/v1/connections/pending` + alias — list pending
- `POST /api/v1/applications/{id}/share-questions` + alias — promote JSONB `interview_research` to `shared_interview_questions` rows
- `POST /api/v1/interview-questions` + alias — create standalone
- `GET /api/v1/feed/interview-questions` + alias — aggregate from connections' shared questions
All handlers enforce connection-acceptance before returning another user's data (existing handlers are `WHERE user_id=$1` only).

### 5.3 Python engine (new `backend/python/app/services/social_feed.py`)
Optional feed-ranking service; or compute feed on-the-fly via `connections` join in Go. If LLM-summarized feed wanted: `POST /api/v1/feed/summarize` endpoint.

### 5.4 Frontend (new)
- `src/pages/Network.tsx` — search users, send/accept requests, list connections.
- `src/pages/SharedInterviewBoard.tsx` (or tab in `InterviewBoard.tsx`) — connections' shared questions feed.
- Share affordance in `InterviewBoard.tsx:890-1001` AI Interview Prep tab — "Share with connections" button per question.
- API client additions in `src/api/index.ts`.
- Nav entries in `Header.tsx` + `AppSidebar.tsx`, gated via `src/config/features.ts` (`socialGraph: [true, true]`).

### 5.5 Tests
- Go: `routes_social_test.go` — request/accept/list/feed with auth + non-connection rejection.
- Python: feed aggregation test.
- Eval: a `social_feed_v1` case asserting a user cannot see a non-connection's `visibility='connections'` question.

---

## 6. Quality-Signal Fix Campaign (centerpiece recommendations)

1. **Make mock fallback explicit.** Replace every `_mock_text()` return in `llm_service.py:280,291,385-388` with `raise LLMNotConfiguredError()`. Go proxy converts to `503 {"error":"llm_not_configured"}`. Frontend shows "Configure an LLM provider to use this feature."
2. **Remove Go-side hardcoded fallbacks.** `routes_resume_extra.go:62-86, 122-142` — return 502 on AI failure, not score-88.
3. **Gate CI on `check_llm_engine.sh`.** Add as a required step before `pytest eval/`. Exit 1 blocks merge.
4. **Add a real-LLM eval dataset.** `tayari_resume_v1_real` — same cases, but asserts the optimized output differs structurally from `_mock_text()` (e.g., contains user-specific facts from input). Fails on mock, passes on real.
5. **Augment the heuristic scorer.** `heuristic_ats_score` is gameable by keyword stuffing. Add a semantic component (embedding cosine vs JD) with a non-trivial weight, and a stuffing-detector that caps score at 70 when `check_keyword_stuffing` fails.
6. **Unify the duplicate scorers/guards.** Pick one ATS scorer and one truth-check guard; delete the other or document why both exist.
7. **Route `handleDeepATS`.** Add `r.Post("/resumes/{id}/ats-deep", s.handleDeepATS)` in both trees, or delete the handler + frontend call.

---

## 7. Security Fixes (P0/P1)
- **P0 Rotate `OPENROUTER_API_KEY`** in `/.env:50`. Move to a secret manager; never in a file the agent reads.
- **P1 Harden `SupabaseAuth.VerifyToken`** (`supabase.go:42`) — add `WithIssuer("tayari-backend")`, `WithExpirationRequired()` to match Local.
- **P1 Reconcile `VITE_USE_SELF_HOSTED=true` + `USE_SUPABASE=true`** — verify intentional or pick one.
- **P1 Flower auth** — gate behind `--basic-auth` or drop from `prod` profile.
- **P2 Pin `slowapi`** in `requirements.txt`.
- **P2 Reconcile `Dockerfile.ai` (py3.12) vs `backend/python/Dockerfile` (py3.11)** — delete the unused one.
- **P2 Add `extension/package.json`** or document why it's absent.

---

## 8. Route-Parity & Dead-Code Fixes (P0)
- **P0 Wire `routes_mvp.go` handlers** — create a `routesMVP()` function, call it from `router.go`, register every `/jobs/*`, `/autopilot/*`, `/stats` route in **both** `/api` and `/api/v1` trees. This unblocks Smart Job Search, Autopilot, Saved Jobs, and the extension's 3 dead endpoints.
- **P0 Route `handleDeepATS`** or delete it + the frontend call.
- **P0 Delete `handleQueueAutoPilot` fake** in `JobSearch.tsx:268-275` or wire it to real `startAutopilot`.
- **P1 Delete or wire `verifyResumeTruthfulness`** in frontend (unused).
- **P1 Unify the two apply chains** — either give `applyChain.ts` a quality gate or document that it's the "lite" path and `AutoPilot` is the "gated" path.

---

## 9. Docs Fixes (P2)
- Refresh `backend/README.md`, `backend/go/README.md`, `backend/python/README.md` (6 months stale).
- Verify `DEPLOYMENT.md` port/profile instructions match current compose.
- Verify `extension/README.md` matches v2.0.0 manifest.
- Update `backend/python/CLAUDE.md` re: eval/pytest deps.

---

## 10. Frontend UI Audit (Section 11 of report)
Per the `audit` skill, score 0-4 each:
1. **Accessibility** — contrast, ARIA, keyboard nav, semantic HTML, alt text, form labels.
2. **Performance** — layout thrash, animation props, lazy loading, bundle size, re-renders.
3. **Theming** — hard-coded colors, dark mode, token consistency.
4. **Responsive** — fixed widths, touch targets, horizontal scroll, breakpoints.
5. **Anti-Patterns** — AI slop tells (AI palette, gradient text, glassmorphism, hero metrics, card grids, generic fonts).
Target pages: `JobSearch.tsx`, `ResumeResults.tsx`, `InterviewBoard.tsx`, `AutoPilot.tsx`, `Dashboard.tsx`, `Profile.tsx`, landing page.

---

## 11. Severity Definitions
- **P0 Blocking** — prevents release (silent mocks, dead routes, real secrets, unwired features the UI advertises).
- **P1 Major** — significant difficulty or WCAG AA violation (weak auth, gameable scorer, duplicate scorers, fake chains).
- **P2 Minor** — annoyance, workaround exists (stale docs, unpinned dep, Dockerfile drift).
- **P3 Polish** — nice-to-fix, no real user impact.

---

## 12. Outputs
- `AUDIT_REPORT.md` — full dimensioned report with matrix, quality-signal deep section, social-graph build plan, cross-cutting findings, severity tags, recommended actions.
- `AUDIT_DASHBOARD.html` — visual summary (per-feature readiness heatmap, quality-signal risk meter, severity counts, dimension scores).

---

## 13. What I will NOT do during the audit
- I will not fix anything. The audit documents; fixes are separate tasks.
- I will not `docker compose down -v` or drop the Postgres volume.
- I will not commit changes unless you explicitly ask.
- I will not print secret values — only note their presence and recommend rotation.

---

## 14. Open decision (resolved by user at execution time)
Runtime spin-up scope: full stack incl. Ollama / stack minus Ollama + OpenRouter for real-LLM probe / host-run Go+Python. Default if unspecified: **stack minus Ollama, OpenRouter for real-LLM probe** (fastest path to the centerpiece evidence).

---

**Status:** Plan written. Ready to execute on approval.