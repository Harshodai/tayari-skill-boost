# Tayari Skill Boost — Ruthless End-to-End Audit Plan

**Goal:** Make this product actually usable when released. No silent mocks. No dead routes. No fake chains. No missing social graph. Every feature the UI advertises must work end-to-end or be explicitly gated off.

**Repo:** `/Users/harshodaikolluru/Public/tayari-skill-boost`
**Scope:** All features end-to-end **except interview prep** (Interview Board *is* in scope — only the prep/voice-coach sub-feature is out). Centerpiece: resume-optimization **quality signal** (gameable heuristic + silent mock-LLM fallback). Plus: in-browser popups, copilot automations (resume optimizer ↔ smart job search ↔ interview board) **which must work end-to-end, extension-free (server-side browser-use + Playwright), see 1.13-1.15**, LinkedIn/Facebook-style friends + shared interview questions, **Knowledge Graph + Ontology (skill taxonomy) — positioned as the platform's core backend, see 1.9 for reality-check**, the full advanced-feature long tail (career intelligence, negotiation/outreach copilots, recruiter intelligence, portfolio generator, skill-gap radar, offer calculator, predictive scorer, agent-reach hub, one-shot engine — see 1.10, corrected by 1.13), and all other backends.
**Mode:** Build mode (read+write+execute).
**Outputs:** `AUDIT_REPORT.md` + `AUDIT_DASHBOARD.html` in repo root, plus standalone competitive briefs: [`COMPETITIVE_BRIEF_KNOWLEDGE_GRAPH.md`](COMPETITIVE_BRIEF_KNOWLEDGE_GRAPH.md), [`COMPETITIVE_BRIEF_JOB_AUTOMATION.md`](COMPETITIVE_BRIEF_JOB_AUTOMATION.md).

---

## 0. Release-Readiness Definition of Done

A feature is **Release-Ready** iff ALL of:
1. **Frontend → Go → Python → DB** chain is wired with no 404s and no silent mock fallback.
2. Every LLM-touching endpoint either (a) returns real model output, or (b) returns an explicit `503 llm_not_configured` — **never** returns 200 with `_mock_text`.
3. Route parity holds: every `/api/...` has `/api/v1/...` alias and vice versa (CLAUDE.md invariant).
4. The feature is covered by at least one test that **fails** when the LLM is mock (the "mock ≠ passing" rule).
5. `check_llm_engine.sh` exits 0 in CI before any eval runs.
6. Prohibit real secrets in tracked files, client bundles, public logs, and release artifacts. Permitted environment-scoped secrets must be managed exclusively in protected runtime secret storage (never committed or recorded as live keys like OPENROUTER_API_KEY in tracked templates or git).
7. No unauthenticated admin surfaces (Flower) in the `prod` profile.

8. Docs that describe the feature are dated within 7 days of last code change.

Anything short of this = **not release-ready**. The audit names every gap.

---

## 0a. Release Confidence Scorecard (falsifiable gate — target ≥9.8/10)

**Two different numbers, don't conflate them:**
- **Holistic product score (2026-07-28, ruthless verbal review): 2/10.** Includes what already works (Review Queue, Hermes scrape, single-user Interview Board, self-hosted auth all verified E2E-Ready) weighed against the systemic fabrication pattern and dead feature surfaces below.
- **This scorecard: fix-completion confidence, starts at 0/10.** Tracks only whether the specific P0/P1 gaps found in this audit are *closed and independently verified* — not self-reported as done. 9.8/10 requires essentially every row below to pass its verification command, not just show a code diff.

| # | Category | Weight | Pass condition (must be independently run, not just claimed) | Status |
|---|---|---|---|---|
| A | **Silent fabrication eliminated — all 4 known instances** (§1.1 LLM mock fallback, §1.1 Go score-88/85 fallback, §1.13 One-Stop Proxy fake payload ~20 endpoints, §1.14 `Browser.apply_job` 3 false-`True` paths) | 4.0 | See "Ruthless Verification Prompts" below — every instance re-tested by forcing the failure and reading the raw response, not by review | 0/4.0 — none fixed yet |
| B | **Dead routes wired** (`routes_mvp.go` full set, `handleDeepATS`, `handleResumeKnowledgeGraph`) | 2.0 | `curl` every previously-404ing endpoint in both `/api` and `/api/v1` trees, confirm non-404 AND a real (non-fabricated per row A) response | 0/2.0 |
| C | **Autonomous auto-apply safe-by-default at the source**, not just at one caller | 1.0 | `grep` shows `auto_apply` defaults to `False` in the function/config-schema itself; a caller that omits the key gets safe behavior | 0.5/1.0 — caller-side override exists today, source-level default still unsafe |
| D | **Marketing claims match actual capability** (Knowledge Graph "$50K-750K/yr enterprise parity" in `README.md`/`PRODUCT_GRILL.md`) | 1.0 | Claim is either earned (ESCO/O*NET-seeded taxonomy + typed Pydantic contract + working route, per §6a) or explicitly softened in the docs | 0/1.0 |
| E | **Security hygiene** (`OPENROUTER_API_KEY` rotated, Flower auth gated in `prod`, `SupabaseAuth.VerifyToken` parity with Local) | 1.0 | Key rotated + old one confirmed dead; `curl` Flower endpoint unauthenticated in `prod` profile returns 401; `VerifyToken` has `WithIssuer`+`WithExpirationRequired` | 0.25/1.0 — self-hosted auth path already solid; the other three items open |
| F | **Tests that fail on mock/fabrication** (the "mock ≠ passing" rule, extended to §1.13/§1.14) | 1.0 | A test suite run that **fails** when the LLM is mock, when Python is down (One-Stop Proxy), and when `browser-use` is absent — not passing tests that don't discriminate | 0/1.0 |
| | **Total** | **10.0** | | **0.75/10 today** |

### Ruthless Verification Prompts (use these verbatim when re-auditing — don't accept a diff as proof)
- **Row A / One-Stop Proxy:** "Kill the `python-ai` container (`docker compose stop python-ai`). Hit every route in `routes_one_stop.go` with a valid auth token. Paste the raw HTTP status and body for each, not a summary. If **any** returns `200` with `truth_score`, `company_domain`, `year_1_total_comp`, or any of the other hardcoded fields from §1.13, this is not fixed — regardless of what else changed."
- **Row A / Browser automation:** "Call `apply_job()` three ways: (1) job dict with `url=''`, (2) with `browser-use` uninstalled in a scratch venv, (3) from inside a running `asyncio` event loop with a slow instruction. Show the actual return value each time and confirm whether a real browser session opened (screenshot or log, not a guess). If it returns `True`/`'applied'` in any of the three without a real submission having completed, this is not fixed."
- **Row A / LLM mock fallback:** "Unset `LLM_API_KEY`. Call the optimize endpoint. Paste the raw HTTP status. If it's `200`, this is not fixed — it must be `503 llm_not_configured`."
- **Row B:** "`curl -X POST` every endpoint listed in §1.2/§1.9 as 404. Paste the status code. `404` = not fixed. `200`/`4xx-other` with a real body = fixed."
- **Row D:** "Quote the exact sentence in `README.md`/`PRODUCT_GRILL.md` that claims enterprise-HR parity. State the current skill count in `skill_taxonomy.py` and whether `KnowledgeGraphResponse` still uses `Dict[str, Any]`. If the claim and the code still disagree, this is not fixed — either the code changed or the claim must."
- **General rule:** a fix "claimed done" without one of these prompts run against it stays at its current score. Self-report is not evidence for this scorecard — that's the entire reason the holistic review scored 2/10 while the code's own tests and docs claimed things worked.

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
- ~~DB creds hardcoded `tayari:tayari_dev` at compose lines 35,83,118,139,236.~~ **FIXED 2026-07-28 — see 1.16.**
- ~~Profile trap: every service declares `profiles:` — bare `docker compose up -d` starts nothing.~~ **FIXED 2026-07-28 — see 1.16** (this was also actively breaking contributor onboarding, not just a latent risk — three different docs told contributors three different, two of them broken, commands).
- `extension/package.json` missing from tree.

### 1.7 Docs trust
- Backend READMEs (`backend/README.md`, `backend/go/README.md`, `backend/python/README.md`) — 2026-02-01, ~6 months stale.
- `AGENT_SPEC.md`, `DEPLOYMENT.md`, `IMPLEMENTATION_SUMMARY.md`, `extension/README.md` — 2026-06-20, ~37 days stale.
- `backend/python/CLAUDE.md` — 2026-07-08, ~19 days stale.
- `README.md`, `CLAUDE.md`, `lessons.md` — fresh (within 5 days).

### 1.8 Web-search grounding (done)
- `@supabase/supabase-js` latest 2.110.9; repo on ^2.90.1 — behind but compatible. Node 20 EOL'd Apr 2026, dropped in 2.110.0.
- GitHub Advisory DB: no critical CVEs against the pinned stack in a quick scan — full per-dep CVE pass is Phase D.

### 1.9 Knowledge Graph / Ontology — reality check (spot-verified during plan review)
**Claim under test:** Knowledge Graph + Ontology serve as the platform's main backend. **Finding: not currently true — two disconnected, partially-dead systems, not one graph backend.**
- `backend/python/app/services/knowledge_graph.py` (139 lines) — `KnowledgeGraphExtractor.extract()` is regex/keyword matching against a hardcoded `COMMON_SKILLS` set + a few `re.compile` patterns for companies/titles/achievements. Returns a flat dict. **No graph structure (no nodes/edges), no persistence, no traversal.**
- Exposed **twice**, inconsistently:
  - `backend/go/internal/api/routes_mvp.go:1546` `handleResumeKnowledgeGraph` → proxies to Python `/api/v1/resume/knowledge-graph` (`main.py:547`). **Unrouted in `router.go` — same dead-code pattern as 1.2. Frontend's `extractResumeKnowledgeGraph()` (`src/api/index.ts:775` → `/v1/resumes/{id}/knowledge-graph`) 404s today.**
  - `main.py:547` also serves it directly — reachable from Python only, bypassing Go entirely if anything calls it straight.
- **Separate, unrelated "graph" system:** `backend/python/app/api/resume_graph.py` (router included at `main.py:614`) — CRUD API (`GET/POST/DELETE /v1/resume-graph/{run_id}` + `/export`) over a `resume_graphs` table (`backend/db/migrations/20260701_add_resume_graph_table.sql`) that is **one JSONB blob column**, not a graph schema (no separate nodes/edges tables, no graph queries).
  - `src/pages/ResumeGraph.tsx` calls this with **raw `fetch(\`/v1/resume-graph/${runId}\`)`** — no `API_URL`/`/api` prefix, unlike every other frontend call (`src/api/index.ts:83` prepends `API_URL` = `/api` or `VITE_API_URL`). This bypasses the Go gateway path convention entirely; whether it resolves depends on an nginx/dev-proxy rule for bare `/v1/*` that isn't obviously present. **Needs a runtime check, not an assumption.**
- **The one real ontology piece:** `backend/python/app/services/skill_taxonomy.py` (160 lines) — hand-curated canonical-skill → synonyms + adjacent-skill map ("ESCO/O*NET-inspired"), used by hybrid job matching. This is a legitimate lightweight ontology — but it's a static Python dict, not a queryable graph/ontology store, and it's disconnected from both "knowledge graph" systems above.
- **Verdict:** as shipped, calling this "the main backend" overstates it — it's marketing-named (`README.md:12`, `PRODUCT_GRILL.md` cite $50K–750K/yr enterprise-HR parity) but implemented as regex extraction + a JSONB blob + a static synonym dict, with one entry point already 404ing. Audit must verify or correct this claim with evidence, same as the ATS heuristic-scorer finding in 1.1 — don't let a second gameable/fake signal ship under a "graph" label unchallenged.

### 1.10 Advanced-feature long tail — CORRECTED by 1.13, most are wired, differently broken
`backend/python/app/services/` has ~50 service modules. Original framing here ("untraced, unknown status") was wrong for most of this list — re-checked during 1.13: `backend/go/internal/api/routes_one_stop.go`'s `RegisterOneStopRoutes` (registered at `router.go:102`) actually fronts most of these with full `/api`+`/api/v1` parity: `negotiation_copilot` (`/negotiation/generate`), `recruiter_intelligence` (`/recruiter/lookup`), `offer_calculator` (`/offer/calculate`), `skill_gap_radar`/`skill_gap_analyzer` (`/skill-gap/analyze`), `portfolio_generator` (`/portfolio/generate`), `outreach_copilot` (`/outreach/generate`), `ats_detector` (`/ats/detect`), `company_radar`/`legitimacy_checker` (`/radar/check`), `agent_reach*` (`/agent-reach/*`), `candidate_answer_bank` (`/candidate-answer-bank/match`), `one_shot_engine` (`/one-shot/execute`), `privacy_check` (`/privacy/check`), truth-check guardrail (`/guardrails/truth-check`). **They're wired. See 1.13 for what's actually wrong with them — it's worse than a 404.**
[SUPERSEDED / PREVIOUSLY CLASSIFIED AS UNTRACED]: `career_intelligence.py`, `linkedin_analyzer.py`, `portal_scanner.py`, `bandit_service.py`, `pattern_analyzer.py`, `preference_learning.py`, `variant_manager.py`, `email_classifier.py`, `followup_tracker.py`, `learning_recommender.py`, `memory_composer.py`, `ats_simulator.py`, `career_ops_evaluator.py`, `notifications.py`. `live_interview_copilot.py`/`voice_coach.py` excluded (out-of-scope carve-out). **TRACED 2026-07-28 — see full per-service results in Section 4's matrix.** Headline finding: `RegisterMemoryRoutes` (`backend/go/internal/api/routes_memory.go:27`) — the entire memory-layer proxy (conversations + preferences + feedback, ~16 routes) — is defined but **never invoked anywhere**, same dead-code shape as `routes_mvp.go`. Precise count on the original 1.2 claim: **34 of 51** handlers in `routes_mvp.go` are unregistered, not "the full set." Recurring pattern across this batch: most non-ready services break at the Go layer specifically — either a handler is defined and never registered, or Go silently substitutes its own hardcoded/raw-SQL logic instead of calling the real Python service that already exists and works (`career_intelligence`'s trending-skills endpoint, `bandit_service`) — the same "wired but differently broken" shape as §1.13's one-stop-proxy finding, not an unrelated bug class.

### 1.11 Pydantic contract gap (regex-fallback root cause)
**Finding:** the extraction layer isn't just regex — the Pydantic schema wrapped around it is a shell, not a contract.
- `backend/python/app/schemas.py:234-239` `KnowledgeGraphResponse` — fields are `entities: Dict[str, Any]`, `achievements: List[Dict[str, Any]]`, `timeline: List[Dict[str, Any]]`. `Dict[str, Any]` validates nothing; any shape passes. This is Pydantic in name only.
- `backend/python/app/main.py:547` `resume_knowledge_graph()` doesn't even declare `response_model=KnowledgeGraphResponse` — it returns `KnowledgeGraphExtractor.extract()`'s raw dict directly. The schema that does exist isn't wired to the one route that would use it.
- `resume_parser.py`, `knowledge_graph.py` — zero Pydantic imports; pure `re.compile` + dict construction.
- `requirements.txt` has `pydantic==2.10.4` only — no `instructor`, `pydantic-ai`, or equivalent structured-LLM-output library. Nothing enforces that an LLM (when one is actually configured — see 1.1) returns validated, typed entities; nothing retries on a malformed extraction.
- **Fix direction (web-verified 2026-07-28):** [Instructor](https://python.useinstructor.com/) is the standard library for this — built on Pydantic, patches the LLM client so the model is forced to emit fields matching a typed schema (`skill: str`, `years_experience: int`, `proficiency: Literal[...]`, etc.), auto-retries on validation failure, supports Anthropic directly (Claude has native structured-outputs support as of Feb 2026 per [pydantic.dev](https://pydantic.dev/articles/llm-intro)). Recommendation: replace `Dict[str, Any]` in `KnowledgeGraphResponse` with real typed fields (`skills: List[SkillEntity]`, `achievements: List[Achievement]`, each its own `BaseModel`), wire `response_model=` on the route, and use Instructor (or native Claude structured output) for the LLM path — with the regex extractor demoted to an explicit, labeled fallback only when no LLM is configured (never silently blended, per the 1.1 mock-fallback rule).

### 1.12 Competitive ground truth — Knowledge Graph / Ontology (web-verified 2026-07-28)
Requested by user to ground the "unique" and "main backend" claims before they ship. Findings:
- **Eightfold.ai** — deep-learning matching engine trained on 1.6B career profiles, ~1.6M inferred skills; reasons about adjacent/acquirable skills, not keyword match. Full talent-lifecycle platform (external hire + internal mobility + workforce planning), not a resume tool. [Knowlee](https://www.knowlee.ai/blog/ai-talent-intelligence) · [hraitoolskit](https://hraitoolskit.com/articles/eightfold-ai-review/)
- **Beamery** — real ontology: RDF/semantic-web knowledge graph, ~16,000 canonical skills normalized from ~20M raw unnormalized skill strings, strongly-typed schema, provenance-tracked. This is the closest existing analog to what Tayari's "Knowledge Graph" claims to be — and it's a materially bigger, differently-architected system (graph DB + RDF, not a JSONB blob). [Beamery skills eng blog](https://medium.com/hacking-talent/skills-beamery-part-1-representing-skills-for-today-and-the-unknown-of-tomorrow-d87e114771a3) · [ODSC](https://odsc.com/speakers/a-global-knowledge-graph-of-people-skills-and-companies-how-ontology-design-is-key-to-enabling-ai-solutions-in-hr/)
- **Phenom** — Talent Experience platform with skills-graph-driven gap analysis; enterprise pricing ~$10K/mo+ ($7-13 PEPM, $100K+/yr contracts), 1,000+ employee target. [paraform](https://www.paraform.com/blog/phenom-pricing-2025) · [selecthub](https://www.selecthub.com/p/talent-acquisition-software/phenom/)
- **LinkedIn Skills Graph** — 39K skills, 875M people, 59M companies as graph nodes; taxonomists manually assign parent/child "knowledge lineages" (ML-assisted, human-curated) — i.e. even the biggest player in the space doesn't fully automate ontology curation. [LinkedIn eng blog](https://www.linkedin.com/blog/engineering/skills-graph/building-linkedin-s-skills-graph-to-power-a-skills-first-world)
- **ESCO** (EU, free/open) — 13,939 skills + 3,007 occupations, multilingual, versioned, downloadable JSON-LD/API. **O\*NET** (US, free/open) — task-inventory taxonomy, public API. Tayari's hand-rolled `skill_taxonomy.py` has **88 canonical skills** — roughly 1/158th of ESCO's, built from scratch instead of seeded from a free, internationally-recognized source.
- **Teal / Jobscan / ResumeWorded** ($10-50/mo tier) — confirmed none of them market a knowledge graph or ontology; they compete on keyword/ATS match rate and price. This is real whitespace — *if* Tayari ships an actual graph, it would be the only tool in the $10-50/mo tier with one.
- **Verdict:** "unique" is achievable — no consumer-tier competitor has a real skills ontology. But today's implementation (88 hand-written skills, `Dict[str,Any]` schema, regex extraction, one dead route) is smaller and less rigorous than the free public taxonomies (ESCO/O*NET) it doesn't use, and structurally nothing like the graph-DB/RDF systems (Beamery, LinkedIn) it's implicitly compared against via the $50K–750K/yr enterprise-parity claim in `README.md`/`PRODUCT_GRILL.md`. The differentiator is real and unclaimed by anyone in Tayari's actual price tier — but only once it's (a) seeded from ESCO/O*NET instead of a hand-typed 88-skill dict, (b) backed by a real graph/typed-relationship store instead of a JSONB blob, and (c) extracted via Pydantic/Instructor-validated LLM output instead of regex. Ship the claim after those three, not before.

### 1.13 One-Stop Proxy silently fabricates success on backend failure (NEW P0 — same class as 1.1, arguably worse)
`backend/go/internal/api/routes_one_stop.go` — the generic reverse-proxy fronting ~20 advanced-feature endpoints (see 1.10). Both `handleOneStopProxy` (POST, line ~131) and `handleOneStopProxyGET` (GET, line ~113): when `s.AI.PostJSONWithHeaders(...)` to the Python backend errors for **any** reason, the handler does not return an error status — it logs `"Using fallback for %s"` and returns **HTTP 200 with a hardcoded, fabricated JSON payload**, identical regardless of which endpoint or user asked:
```
truth_score: 100, passed: true          // guardrails/truth-check never ran, but reports "passed"
company_domain: "stripe.com", suggested_emails: ["alex.rivera@stripe.com"]   // fake, for ANY user
year_1_total_comp: 390400, annualized_4yr_npv: 350000                        // fake salary numbers
star_framework: { a canned "Black Friday outage" story }                    // fake, for ANY resume
vendor: "workday", displayName: "Workday ATS"                               // fake ATS-detection result
```
This means: if the Python engine is down, slow, or errors, a user asking Tayari to verify their resume's truthfulness gets told **"passed": true** unconditionally; a user asking for salary negotiation guidance gets **someone else's fabricated $390,400 offer**; ATS-vendor detection reports "Workday" regardless of the actual posting. This is not a stub — it is fabricated, plausible-looking data presented as a real result, on the exact code path meant to protect users (`guardrails/truth-check`) as well as the ones giving them financial guidance (`offer/calculate`, `negotiation/generate`). Same root defect as the Section 1.1 score-88/score-85 fallbacks and the ATS-gameable-heuristic finding — a systemic pattern across this codebase of "fail silently, fabricate confidently" — but this instance fabricates specific numbers and a false "passed" guardrail verdict, which is worse than a generic fallback score.
**Fix:** both handlers must return `502`/`503` with an explicit error body on backend failure — never a 200, never fabricated field values. No exceptions for any of the ~20 endpoints behind this proxy.

### 1.14 Extension-free automation chain — reliability bar (user-requested, ruthless brainstorm)
Confirmed: `applyChain.ts` and `AutoPilot.tsx` have **zero** dependency on the Chrome extension already — the "search + apply without an extension" architecture the user wants already exists as the intended design (server-side via `browser_library.py` → `browser_automation/agent.py`, using `browser-use==0.1.34` + `playwright==1.49.1`, both real deps in `requirements.txt`). It is broken by **implementation bugs, not architecture**:
1. **Dead HTTP routes** (1.2) — `handleJobSearch`, `handleAutopilotStart`, etc. never registered.
2. **`browser_library.py:17-66` `Browser.apply_job()` returns `True` (claims success) in three failure modes:** (a) no job URL provided — returns `True` with just a warning log; (b) **any** exception, including `ImportError` if `browser-use`/`playwright` fail to import — caught and returns `True` with `"Defaulting to true stub"` in the log; (c) when called inside an already-running event loop, it schedules `asyncio.create_task(run_browser_agent(...))` and returns `True` **immediately, without awaiting the task** — success is reported before the browser automation has even started running, let alone finished.
3. **`automation_engine.py:391` `config.get("auto_apply", True)`** — the function's own default is auto-submit **on**. Production is safe today only because `AutoPilot.tsx:116` explicitly passes `auto_apply: false`. Any other caller (a script, a test, a future route) that omits the key gets live, unattended job-application submission by default.
4. **Ban-risk ground truth (web-verified 2026-07-28):** LinkedIn's Mar-2026 transparency report flagged 23.5M automated sessions in one quarter; ToS bans "unattended automation" specifically, not all automation — tools acting on user-initiated clicks inside a real session are treated differently than autonomous background bots. Full unattended auto-submit to LinkedIn/Indeed/Workday postings carries real account-ban risk for the *user's* job-search account, not just a reliability question. See [`COMPETITIVE_BRIEF_JOB_AUTOMATION.md`](COMPETITIVE_BRIEF_JOB_AUTOMATION.md) for the category's ban-risk and reputation data (LazyApply ~2.1/5 Trustpilot, ban complaints).
5. **Brainstorm verdict (ruthless, taking a position):** don't ship full unattended autonomy as the default. The category's lowest-risk, best-reviewed pattern (Simplify Copilot: "free autofill, user stays in control") and the ToS ground truth both point the same direction — human-in-the-loop review before submit. Tayari already has this half-built and marked **E2E-Ready** in the matrix: the **Review Queue**. The correct target shape is: automate search + tailor + draft, queue for review, human clicks submit (or opt-in, clearly-labeled, to autonomous submit for users who accept the risk) — not "fix the routes and ship full autopilot by default." Fixing 1-3 above is required regardless of this decision; the autonomy-level decision is separate and should be made explicitly, not left as an unexamined `True` default in a config dict.

### 1.15 Competitive ground truth — Job Search Automation (web-verified 2026-07-28)
Full brief: [`COMPETITIVE_BRIEF_JOB_AUTOMATION.md`](COMPETITIVE_BRIEF_JOB_AUTOMATION.md). Headline findings: LazyApply ($99-249/yr) ~2.1/5 Trustpilot with ban-risk and refund complaints; Sonara ($23.95/4wk) has a billing-complaint pattern; Simplify Copilot (free, autofill-only, human-submits) is reviewer-rated as the lower-risk option *because* it isn't autonomous; JobCopilot has discretionary-refund terms matching the LazyApply trust-gap pattern. This is a genuinely low-trust category — a working, honest, review-queue-first tool is a real differentiator against it, but only if 1.13/1.14's fabrication and false-success bugs are fixed first.

### 1.16 Docker / contributor-setup — FIXED (2026-07-28, user-reported: "contributors not able to setup")
Root cause was worse than the already-known profile trap alone — three separate setup docs actively disagreed, and two were flat-out broken:
- **`CLAUDE.md:16`** and **`DEPLOYMENT.md:11`** both documented a bare `docker compose up -d` — since every service declares `profiles:`, this starts **zero containers**, no error, no explanation.
- **`CONTRIBUTING.md:18`** documented `--profile eval`, labeled "Local Development Quickstart" — that profile only starts `postgres`+`python-ai`+`go-backend`. No frontend, no Redis, no Celery. A contributor following this literally gets no UI to open and a Python AI service pointed at a Redis host (`REDIS_URL=redis://redis:6379/0`) that isn't running.
- **`.env.example` was stale/wrong**, describing a different, unused architecture: self-hosted Supabase (`kong`/`db` hosts, port 8008) that only exists in the separate, optional `supabase-local/` stack — not this `docker-compose.yml`. Its `POSTGRES_USER`/`PASSWORD`/`DB`/`DATABASE_URL` vars had **zero effect** (compose hardcoded `tayari`/`tayari_dev` directly, ignoring them entirely). Wrong ports throughout (4175/5173/8008 vs actual 8083/8085/8002). No `COMPOSE_PROFILES` at all.
- **Real wiring bug:** `USE_SUPABASE` (the Go-side auth-mode switch documented in `CLAUDE.md`'s Conventions section) was never passed into `go-backend`'s container environment in `docker-compose.yml` — setting it in `.env` silently did nothing under Docker; the Go gateway always ran self-hosted-JWT mode regardless.

**Fixed:**
1. `docker-compose.yml` — templated Postgres creds + `DATABASE_URL` from env vars in all 5 places (previously hardcoded, ignoring `.env` entirely); added the missing `USE_SUPABASE=${USE_SUPABASE:-false}` passthrough to `go-backend`.
2. `.env.example` — full rewrite matching the actual compose file: `COMPOSE_PROFILES=dev` added, ports corrected, dead self-hosted-Supabase-stack refs removed/clarified, previously-undocumented-but-consumed vars added (`LLM_*`, `HERMES_*`, `CADDY_*`, etc.).
3. `CLAUDE.md`, `DEPLOYMENT.md`, `CONTRIBUTING.md` — all three now consistently document `docker compose --profile dev up -d --build`, matching README.md (which was already correct).

**Verified (not just diffed):** copied the new `.env.example` to a scratch env file with no real secrets, ran `docker compose --env-file <scratch> config --services` — resolves to all 10 intended services, both with `--profile dev` passed explicitly and relying on `COMPOSE_PROFILES` from the file alone. `docker compose config` validates with no errors. Full `docker compose up --build` (actual image pull/build) not yet run in this session — Docker daemon was unresponsive when attempted (`docker version`/`docker info` hung); pending a Docker Desktop restart to complete that last verification step.

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
| 12 | **Knowledge Graph & Ontology reality** | Trace both KG systems (extraction + resume-graph storage) + skill taxonomy; verify or correct the "main backend" claim; fix the 404 + bypassed-Go-proxy findings; replace `Dict[str,Any]` schema with typed Pydantic + Instructor-validated extraction; seed taxonomy from ESCO/O*NET | **Centerpiece-adjacent** |
| 13 | **Advanced-feature long tail** | F→Go→Py→DB trace for the ~14 still-untraced services in 1.10 (most of the rest are wired via one-stop proxy — see #15) | Standard |
| 14 | **Competitive positioning (Knowledge Graph)** | Web-grounded brief vs Eightfold/Beamery/Phenom/LinkedIn (enterprise) and Teal/Jobscan/ResumeWorded (consumer tier); confirm what's genuinely unclaimed whitespace vs overclaimed parity | Standard |
| 15 | **One-Stop Proxy fabrication audit** | Hit every one of the ~20 `handleOneStopProxy`/`handleOneStopProxyGET` endpoints (1.13) with the Python backend killed; confirm each returns the same hardcoded fake payload instead of a 502/503; fix all of them, not just one | **P0** |
| 16 | **Extension-free automation reliability** | Fix `Browser.apply_job()`'s three false-`True` paths (1.14); fix `auto_apply` unsafe default; decide + document autonomy-level product stance (review-queue-first vs opt-in autonomous) before calling the chain "working end-to-end" | **P0** |
| 17 | **Competitive positioning (Job Automation)** | Web-grounded brief vs LazyApply/Sonara/Simplify Copilot/JobCopilot; ban-risk/ToS ground truth; position "review before submit" as a trust differentiator | Standard |

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
9a. `curl -X POST localhost:8085/api/v1/resumes/{id}/knowledge-graph` → expect 404 (`handleResumeKnowledgeGraph` unrouted, 1.9).
9b. `curl localhost:8002/api/v1/resume/knowledge-graph` (Python direct) vs `curl localhost:8083/v1/resume-graph/{run_id}` (frontend origin, no `/api` prefix) → confirm whether the bare `/v1/resume-graph/*` path used by `ResumeGraph.tsx` actually resolves through any proxy, or if it's silently broken.
10. Load extension in Chrome → exercise popup + floating panel → capture which backend calls fail.
11. Playwright smoke: load `/resume`, `/jobs`, `/interview`, `/jobs/autopilot` → capture console errors / 404s.
11a. Trace each service in 1.10's untraced list (F→Go→Py→DB) far enough to classify E2E-Ready/Partial/Stub/Missing — doesn't need full depth, just enough to fill Section 4 rows.
11b. Stop the Python container (`docker compose stop python-ai`), then hit every `handleOneStopProxy`/`handleOneStopProxyGET` route in `routes_one_stop.go` (§1.13) — confirm each returns the fabricated 200 payload instead of erroring, and confirm it's the *same* hardcoded blob regardless of endpoint. Restart Python after.
11c. Call `apply_job()` (`job_application_automation.py`) with a job dict missing `url`, then with `browser-use` uninstalled/broken, then from inside a running event loop — confirm all three return `True` (§1.14) without a real application having been submitted.

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
| Review Queue | ✅ `AutoPilot.tsx:124-150` | ✅ `/v1/review-queue` | n/a | ✅ | **E2E-Ready** | — Correct target foundation for 1.14's human-in-the-loop recommendation |
| Hermes scrape | ✅ | ✅ `/v1/hermes/*` | ✅ `HermesScraper` | ✅ | **E2E-Ready** | — |
| Browser automation (extension-free auto-apply) | ❌ no dedicated UI (used by Autopilot) | ✅ `/v1/browser/automation` | ✅ `run_browser_agent`, real `browser-use`+`playwright` deps | n/a | **Partial — worse than "silent fallback"** | `Browser.apply_job()` (§1.14) returns `True` on missing URL, on any exception incl. `ImportError`, AND on fire-and-forget task scheduling without awaiting it — 3 distinct false-success paths, not 1 |
| Interview Board (single-user) | ✅ `InterviewBoard.tsx` | ✅ `/v1/applications` | ✅ `interview_ai.py` | ✅ `applications` | **E2E-Ready** | — |
| Interview Board (shared) | ❌ | ❌ | ❌ | ❌ | **Missing** | Greenfield — see build plan |
| Social graph / friends | ❌ | ❌ | ❌ | ❌ | **Missing** | Greenfield — see build plan |
| Browser extension | ✅ | ⚠️ partial (`/extension/capture`, `/extension/quick-ats` work; `/autopilot/applications`, `/review-queue/queue`, `/stats` 404) | n/a | ✅ | **Partial** | 3 dead endpoints |
| Auth (self-hosted) | ✅ | ✅ | n/a | ✅ `auth.users` | **E2E-Ready** | — |
| Auth (Supabase) | ✅ | ✅ | n/a | ✅ | **Partial** | VerifyToken weaker than Local |
| Billing | ✅ | ✅ `routes_billing.go` | n/a | ✅ | (verify) | — |
| Knowledge Graph (extraction) | ✅ `extractResumeKnowledgeGraph()` | ❌ `handleResumeKnowledgeGraph` unrouted | ✅ `KnowledgeGraphExtractor` | n/a | **Stub** | 404 — dead route (1.9) |
| Resume Graph (storage/viz) | ✅ `ResumeGraph.tsx` | ⚠️ bypasses Go — raw `fetch` to bare `/v1/resume-graph/*` | ✅ `resume_graph.py` router live | ✅ `resume_graphs` (JSONB blob) | **Partial** | Not a graph schema; Go-bypass unverified (1.9) |
| Skill Taxonomy (ontology) | n/a (backend-only) | n/a | ✅ `skill_taxonomy.py` static dict | n/a | **Partial** | Real but tiny/hand-curated, disconnected from both KG systems above |
| Negotiation / Outreach / Recruiter Intel / Portfolio Gen / Skill-Gap / Offer Calc / Agent Reach / One-Shot Engine / ATS-detect / Privacy-check / Truth-check guardrail (~14 services, one-stop proxy) | ✅ (mostly) | ✅ wired via `RegisterOneStopRoutes`, both `/api`+`/api/v1` | ✅ files exist, called via proxy | ✅ (mostly) | **Partial — wired but fabricates on failure** | Not dead routes (corrected from earlier framing) — but §1.13: any Python-side error returns a hardcoded fake success payload instead of an error, for all ~20 endpoints |
| Career Intelligence (skills-gap/learning-path/salary) | ✅ `CareerRoadmap.tsx` | ✅ `routes_career_intelligence.go` | ✅ `career_intelligence.py` | ✅ `user_skill_analyses` | **E2E-Ready** | — |
| Career Intelligence (trending skills) | ✅ `CareerIntelligence.tsx:38` | ⚠️ `handleGetTrendingSkills` returns hardcoded data | ✅ `trending_skills()` exists, unreachable | n/a | **Partial** | Go never calls the real Python fn — same "Go substitutes its own logic" pattern as §1.13 |
| LinkedIn Analyzer | ✅ `LinkedInImport.tsx:29` | ❌ `handleLinkedInAnalyze` defined, never registered | ✅ `main.py:477` real | n/a | **Stub** | 404 — dead route |
| Portal Scanner | ✅ `CareerOpsDashboard.tsx` | ✅ `routes_career_ops.go` | ✅ `career_ops_routes.py` | ✅ `user_portals` | **E2E-Ready** | — |
| Bandit Service (predictive job-match) | ❌ no caller | ❌ Go uses raw SQL on `ab_testing_bandit` instead of proxying | ✅ `predictive.py` real, unreachable from product path | ✅ `ab_testing_bandit` (bypassed) | **Partial** | Real Thompson-sampling logic exists and works if hit directly, but nothing in the actual request path calls it |
| Pattern Analyzer | ✅ `CareerOpsDashboard.tsx:140` | ✅ `routes_career_ops.go` | ✅ `pattern_analyzer.py` | ✅ reads `applications` | **E2E-Ready** | — |
| Preference Learning | ✅ `src/api/index.ts:469-491` | ❌ `RegisterMemoryRoutes` defined, **never called from router.go** | ✅ `preference_routes.py` real | ⚠️ `user_job_feedback` table only in `supabase/migrations/`, **absent from `backend/db/migrations/`** (the folder `init.sh` actually applies) | **Stub** | Double break: dead Go proxy AND the table isn't even in the migration path this compose stack runs |
| Variant Manager | ❌ | ❌ | ❌ never imported by any route | n/a | **Missing** | Zero callers anywhere; unrelated to Go's own separate `resume_variants` A/B feature |
| Email Classifier | ❌ | ❌ | ❌ test-only | n/a | **Missing** | Only referenced by its own unit test, no route, no caller |
| Followup Tracker | ✅ `CareerOpsDashboard.tsx` | ✅ `routes_career_ops.go` | ✅ `career_ops_routes.py` | ✅ reads/writes `applications` | **E2E-Ready** | — |
| Learning Recommender | ✅ `CareerRoadmap.tsx:114-115` | ✅ (shares route with Career Intelligence skills-gap) | ✅ `LearningRecommender.get_recommendations` | n/a | **E2E-Ready** | — |
| Memory Composer (job-search context) | ✅ `src/api/index.ts` `/jobs/search`, `/jobs/agent-search` | ❌ `handleJobSearch`/`handleAgentSearch` defined, never registered (same as §1.2) | ✅ `job_agent.py`/`main.py:363,712` real | n/a | **Stub** | Python logic real and would run if hit directly; frontend's actual path 404s at Go first |
| ATS Simulator | ⚠️ `simulateAtsParsing()` defined, called from **zero** pages | ❌ no Go route at all (not even dead code — never existed) | ✅ `main.py:982-987` real | n/a | **Stub** | No route + no UI caller; the api-client function itself is unused |
| Career Ops Evaluator | ❌ no frontend call site anywhere | ✅ `routes_career_ops.go` registered | ✅ `career_ops_routes.py` real, writes DB | ✅ writes `applications.evaluation_report` | **Partial** | Fully wired Go+Python+DB, but nothing in the UI ever calls it — dead end at the frontend only |
| Notifications | ❌ | ❌ | ❌ test-only (SMTP re-engagement scaffolding) | n/a | **Missing** | Zero production caller |

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
  CHECK (requester_id <> addressee_id)
);
-- Enforce a single row for each unordered user pair, preventing both (A, B) and (B, A)
CREATE UNIQUE INDEX IF NOT EXISTS idx_connections_unordered_pair
  ON public.connections (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
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
  -- Validation requirement: endpoint must validate that application_id belongs to requesting user_id before inserting, preventing cross-user references.
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

## 6a. Knowledge Graph / Ontology Fix Campaign (1.9, 1.11, 1.12 findings)
1. **Route `handleResumeKnowledgeGraph`** in both `/api` and `/api/v1` trees (same class of fix as Section 8 P0), or delete it + `extractResumeKnowledgeGraph()` frontend call.
2. **Fix or confirm `ResumeGraph.tsx`'s bare `fetch('/v1/resume-graph/...')`.** Either it's silently 404ing (bug — route it through `API_URL` like every other call), or a proxy rule makes it work (document why this one call is special-cased).
3. **Seed `skill_taxonomy.py` from ESCO and/or O\*NET** instead of the current 88 hand-written entries — both are free, versioned, internationally-recognized taxonomies (ESCO: 13,939 skills / 3,007 occupations). Don't hand-roll what already exists for free.
4. **Replace `Dict[str, Any]` in `KnowledgeGraphResponse` (`schemas.py:234-239`) with real typed models** (`SkillEntity`, `Achievement`, `TimelineEvent` as their own `BaseModel`s) and wire `response_model=` on `main.py:547`. Add `instructor` (or native Claude structured outputs) to `requirements.txt` so the LLM path returns schema-validated, auto-retried extraction instead of an untyped blob.
5. **Keep the regex extractor only as an explicit, labeled no-LLM fallback** — never silently blended with the LLM path (same principle as the 1.1 mock-fallback rule: a caller must be able to tell which path produced the result).
6. **Decide the "main backend" / enterprise-parity claim before it ships in marketing copy again.** Per 1.12: the whitespace is real (no $10-50/mo competitor has a graph), but the claim isn't earned until 3-5 above land. Either invest `knowledge_graph.py` + `resume_graph.py` + `skill_taxonomy.py` into one coherent, typed, ESCO-seeded graph, or soften the claim in `README.md`/`PRODUCT_GRILL.md` until it is one.
7. **Merge or explicitly separate `knowledge_graph.py` (extraction) and `resume_graph.py` (storage).** Right now they share a name and a topic but no code path — confusing for anyone tracing "the knowledge graph."

---

## 6b. One-Stop Proxy + Extension-Free Automation Fix Campaign (1.13, 1.14, 1.15 findings — user-requested, ruthless)
1. **P0 — Kill the fabricated-fallback payload in `handleOneStopProxy`/`handleOneStopProxyGET`** (`routes_one_stop.go`). On `s.AI.PostJSONWithHeaders` error, return `502 Bad Gateway` (or `503` if it's a known-down state) with a real error body — never the hardcoded `truth_score:100/passed:true/stripe.com/$390,400` blob. Applies to all ~20 endpoints behind this proxy; audit each one individually, don't assume fixing one fixes all (they share the same two handler functions, but verify).
2. **P0 — Fix `Browser.apply_job()`'s three false-`True` return paths** (`browser_library.py`): return `False`/raise on missing URL instead of `True`; let exceptions propagate (or return `False` with the real error) instead of `except Exception: return True`; and either `await` the browser-automation task before reporting status, or return a distinct "queued/pending" state — never `True` for a task that hasn't run yet.
3. **P0 — Move `auto_apply`'s safe default into the function/config-schema itself**, not just the one caller. `automation_engine.py`'s `config.get("auto_apply", True)` should default to `False` at the source, so a future caller that omits the key doesn't get live auto-submit by accident.
4. **P1 — Decide and document the autonomy-level product stance** before wiring `routes_mvp.go`'s dead handlers (Section 8). Per 1.14's brainstorm: default to review-queue-first (draft → human reviews → human submits), make full autonomous auto-submit an explicit, separately-labeled opt-in with its own risk disclosure — don't let "wire the dead routes" silently ship full-autopilot-by-default as a side effect of the P0 route-parity fix.
5. **P2 — Position "review before you submit" in marketing** as the trust differentiator against the LazyApply/JobCopilot ban-risk reputation (see `COMPETITIVE_BRIEF_JOB_AUTOMATION.md`) — this is earned once 1-3 above land, not before.

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

**Status:** Plan written. Ready to execute on approval. **Release Confidence Scorecard (§0a): 0.75/10 as of 2026-07-28 — do not represent this product as release-ready to anyone until §0a reads ≥9.8/10 with every row independently verified via the Ruthless Verification Prompts, not self-reported.**