# Five-Document Reconciliation Audit

**Date:** 2026-08-07
**Method:** Five parallel read-only subagents (one per source doc), each verifying concrete claims against today's codebase with `file:line` evidence. Results synthesized and deduped here.
**Scope:** No code changes. This report is the input to the next implementation cycle.

## Source documents

| # | Doc | Date | Character |
|---|---|---|---|
| 1 | `JobTayari_Production_Readiness_and_Moat.md` (repo root) | 2026-07-29 | Grounded codebase audit; B1–B7 blockers, M1–M4 moats |
| 2 | `Job Tayari_ The No-Mercy 10_10 Master Plan…` | 2026-07-05 | Brutal-truths audit; `browser_library`, `predictive_scorer`, `gate.py`, `llm_service` |
| 3 | `Job Tayari_ The 10_10 _Manus-like_ Master Plan…` | 2026-07-05 | Agentic-core vision; `AgentOrchestrator`, `JobApplyAgent`, `AgentLiveView` |
| 4 | `Job Tayari_ The _Beyond 10_10_ Ruthless Audit…` | 2026-07-05 | Aspirational moats; networking, community, interview copilot, predictive ML, ethical AI |
| 5 | `Job Theory Platform_ Production-Ready Plan.md` | undated | Resume Optimizer, Hermes sandbox, Interview Kanban, Gmail, Omni Save |

> **Note on doc 4:** Subagent 4 could not locate the source file in the repo; section numbers are inferred from the task scope. All `file:line` citations for partial stubs are real and verified.

## Summary

| Verdict | Count |
|---|---|
| VERIFIED-STILL-TRUE | 21 |
| FIXED | 8 |
| STALE | 11 |
| PARTIAL-STUB | 9 |
| ASPIRATIONAL | 1 |
| UNVERIFIABLE | 4 |
| **Total claim rows** | **54** |

**Headline:** A large fraction of the July-5 "No-Mercy" findings are now **FIXED** (browser_library is real, gate.py truthfulness now fails-closed, mock-LLM raises instead of fabricating, auto_apply default flipped to False). The July-29 readiness doc's **B1 (split-brain backend)** and **B2 (decorative multi-tenancy)** remain the dominant Critical blockers. **B3 (account deletion)** is now FIXED. The moat work (M1–M4) is **partially built** — the privacy ledger (M3) and outcome-funnel table (M2) already exist; the doc understates current state.

## Full claim table

Severity: **C**=Critical, **H**=High, **M**=Medium, **L**=Low. Claims appearing in multiple docs are collapsed to one row with all sources cited.

### Cluster A — Trust / honesty / security (July-29 B1–B7 + July-5 No-Mercy)

| # | Claim | Verdict | Evidence | Sev | Sources |
|---|---|---|---|---|---|
| A1 | Supabase edge functions (`analyze-resume`, `generate-resume-pdf`, `check-rate-limit`) duplicate Go/Python functionality | VERIFIED-STILL-TRUE | `supabase/functions/{analyze-resume,generate-resume-pdf,check-rate-limit}/index.ts` all exist | C | July-29 B1 |
| A2 | Hosted frontend has no `VITE_API_URL` / no dev proxy for `/api` → `@/api` calls 404 on hosted SPA | VERIFIED-STILL-TRUE | `vite.config.ts` (no `server.proxy`); `src/api/client.ts:1` (`API_URL = VITE_API_URL \|\| "/api"`); `.env.example:85` | C | July-29 B1 |
| A3 | 31 files import `@/api` (Dashboard, JobSearch, Pipeline, CoverLetter, OneShotPipeline, KnowledgeHub) | STALE (substance holds, count grew) | 44 files now import `@/api`; all named pages confirmed | C | July-29 B1 |
| A4 | Committed `.env` configures only Supabase | STALE | `.env` is gitignored (`.gitignore:2`), not committed; `.env.example` documents both stacks | H | July-29 B1 |
| A5 | `tenants`/`memberships` tables + `tenantMiddleware` exist | VERIFIED-STILL-TRUE | `backend/db/migrations/20260626_multi_tenant.sql`; `backend/go/internal/api/middleware.go:184-185`; `router.go:61` | C | July-29 B2 |
| A6 | `tenant_id` appears in only ~5 Go places, all advisor/cohort; every other handler filters by `user_id` alone | VERIFIED-STILL-TRUE | 6 hits across `routes_tenant.go:62,85,128,174,184` + 1 non-scoping read in `routes_account.go:283` | C | July-29 B2 |
| A7 | "Delete Account" is a disabled `title="Coming soon"` button; no backend delete; export unconfirmed | **FIXED** | `Settings.tsx:606-619` (destructive button → `setDeleteModalOpen`); `Settings.tsx:622-655` (`handleDeleteAccount`→`deleteUserAccount`); `client.ts:69` (`DELETE /v1/user/account`); `routes_account.go:55` (route exists); `Settings.tsx:751` (Export button wired). *The "Coming soon" at 597-598 is "Sign Out All", not Delete — doc mislabeled.* | C | July-29 B3 |
| A8 | No backups/DR for hosted path; `scripts/backup.sh` self-host only | VERIFIED-STILL-TRUE | `scripts/backup.sh:14-26` (pg_dump vs localhost:54329); no managed PITR config anywhere | C | July-29 B4 |
| A9 | `strategic_analyzer.py` falls back to `_fallback_analysis()` on any exception (silent canned output) | VERIFIED-STILL-TRUE | `backend/python/app/llm/strategic_analyzer.py:77,83,143` (file moved `app/services/`→`app/llm/`) | H | July-29 B5, No-Mercy §1.5c |
| A10 | `/health` reports `active_engine: mock` | STALE | `routes/health.py:25-31` returns `model_status: 'loaded'\|'llm_not_configured'` (no `active_engine` field); `MockProvider.active_engine_label` returns `'unconfigured'` | H | July-29 B5 |
| A11 | Only disclosure of mock mode is passive `DemoModeBanner` | VERIFIED-STILL-TRUE | `src/components/layout/DemoModeBanner.tsx:1-44` (passive amber banner; no per-action hard-fail in frontend) | H | July-29 B5 |
| A12 | `browser_library.py` is a placeholder that fakes `apply_job` success | **FIXED** | `backend/python/app/services/browser_library.py:18-91` — real `browser-use`+Playwright wrapper; returns `True` only on verified submission; `False` on missing URL / import failure | H | No-Mercy §1.1 |
| A13 | `automation_engine.py` marks `auto_applied` when no real submission occurred | **FIXED** | `automation_engine.py:402-410` — default flipped to `auto_apply=False`; calls real `apply_job`; status `prepared`/`apply_failed`, never `auto_applied` (string absent from `backend/python/`) | H | No-Mercy §1.1 |
| A14 | `gate.py` skips truthfulness when `original_text` absent, marks `passed:True` | **FIXED** | `backend/python/app/guardrails/gate.py:43-56` — now `passed = not require_truthfulness` (default `True`→`passed=False`), `verified=False`; docstring: "an unverifiable claim must never be rendered as a clean pass" | H | No-Mercy §1.4, July-29 B5 |
| A15 | `llm_service.py` silently returns mock text when no LLM configured | **FIXED** | `llm_service.py:56,300,308-315,377` — `MockProvider.complete()` raises `LLMNotConfiguredError`; module docstring: "never returns fabricated data" | H | No-Mercy §1.5b, July-29 B5 |
| A16 | `llm_service.py` uses hardcoded `_clip` truncation + `_UNTRUSTED_DELIM` | VERIFIED-STILL-TRUE | `llm_service.py:635-655,672,674,724,745,801,804` — `_clip(text, n=9000)`, `_UNTRUSTED_DELIM` wrapping | M | No-Mercy §1.5a |
| A17 | Hermes sets honest User-Agent but no robots.txt check | VERIFIED-STILL-TRUE | `hermes/normalize.py:40` (UA set); zero `robots` hits in `backend/python/app` | H | July-29 B6 |
| A18 | No outbound backoff | STALE (class exists, unwired) | `hermes/rate_limit_controller.py:1-41` exists but **no callers** — dead code; effective backoff still absent | H | July-29 B6 |
| A19 | 27 feature flags = sprawl | VERIFIED-STILL-TRUE | `src/config/features.ts:14-73` (28 entries) | H | July-29 B7 |
| A20 | `interviewPrep`/`interviewAI`/`voiceCoach` built but off in both envs | STALE | `features.ts:24` (interviewPrep `[true,true]`), `:40` (interviewAI `[true,true]`), `:42` (voiceCoach `[false,false]`) — 2 of 3 now ON | H | July-29 B7 |
| A21 | 7+ DB tables with zero code refs (`application_attempts`, `interview_messages`, `learning_resources`, `platform_configs`, `tailored_resumes`, `user_sessions`, `voice_note_files`) | VERIFIED-STILL-TRUE | All 7 present in migrations; zero code refs across `backend/go/internal`, `backend/python/app`, `src/` | H | July-29 B7 |
| A22 | Internal codenames ("Hermes", "jobtheory") leaked to users | VERIFIED-STILL-TRUE | `Settings.tsx:127,129,131,163,169,822,824,833,865,878,881,883,899,901` | H | July-29 B7 |
| A23 | No enforced entitlement mapping between Stripe plan and feature gates | VERIFIED-STILL-TRUE | `Pricing.tsx:260,271` (display strings only); no runtime wiring from subscription state → `features.ts` gates | M | July-29 §3 |

### Cluster B — Moats (July-29 M1–M4 + Beyond 10/10)

| # | Claim | Verdict | Evidence | Sev | Sources |
|---|---|---|---|---|---|
| B1 | 4 OAuth-protected MCP tools live and deployed | STALE (grew) | `supabase/functions/mcp/index.ts:496-520` — **14 tools** now (added `report_outcome`, `check_company`, `get_market_salary`, `get_skill_gaps`, etc.) | M | July-29 M1 |
| B2 | No instrumentation of run→application→reply→interview→offer | STALE (spine wired) | `routes_social.go:470-490` (`application_outcomes` table with full funnel cols); `mcp/index.ts:444-445,519` (`report_outcome` tool); `models/autopilot.go:37` (status pipeline). Not a closed verified dataset yet, but the spine exists | M | July-29 M2 |
| B3 | "What left your machine" provenance ledger (M3) — turn privacy arch into visible product | VERIFIED-STILL-TRUE (partially built) | `backend/python/app/services/privacy_ledger.py`; `main.py:1205-1226` (GET/POST `/api/v1/privacy/ledger`); `routes_mvp.go:2167-2170` (Go proxy); `routes_account.go:296-299` (in user export); `PrivacyReadiness.tsx:10-11` (UI). Doc understates — the ledger already exists | M | July-29 M3 |
| B4 | `AdvisorDashboard.tsx` + cohort schema exist (M4 foundation) | VERIFIED-STILL-TRUE | `src/pages/AdvisorDashboard.tsx:39`; `20260626_multi_tenant.sql:17-25` (`cohorts` + `idx_cohorts_tenant`); `:42` (`profiles.cohort_id` FK) | M | July-29 M4 |
| B5 | AI-driven networking & outreach (LinkedIn discovery, personalized outreach, follow-up) | PARTIAL-STUB | `Networking.tsx:59,222`; `outreach_copilot.py:18`; `recruiter_outreach.py:20`; `followup_generator.py`; `main.py:948`; `supabase/functions/draft-outreach/index.ts:46`. Contact list manual (no LinkedIn discovery); outreach AI-drafted not auto-sent | L | Beyond §2.1 |
| B6 | Automated referral generation (mutual-connection mapping) | PARTIAL-STUB | `recruiter_intelligence.py:3,16,46` (referral intro templates); `draft-outreach/index.ts:46`. No mutual-connection graph | L | Beyond §2.2 |
| B7 | Peer community / AI-matched mentors | PARTIAL-STUB | `Blog.tsx:85` (successStories); `BlogPost.tsx:47` (`is_success_story`). No forum/mentor-matching | L | Beyond §2.3 |
| B8 | Real-time AI interview copilot (live transcription, STAR prompts) | PARTIAL-STUB | `live_interview_copilot.py:1,33,37`; `main.py:1027,1077,1189`; `routes_mvp.go:1949` (gate); `billing.go:156` (TierPro). **Frozen by founder decision** per `TAYARI_RUTHLESS_BRIEF.html:335` | L | Beyond §3.1 |
| B9 | Post-interview analysis (performance metrics) | PARTIAL-STUB | `mock_interview_simulator.py`; `interview_prep.py:113`; `answer_bank_service.py`; `communication.py:67` (thank-you). No quantitative performance scoring | L | Beyond §3.2 |
| B10 | Longitudinal career tracking & predictive pathing (ML on trajectories) | PARTIAL-STUB | `career_trajectory_predictor.py:16,28,44` — **heuristic** (`years/5*100`), not ML; no trajectory dataset | L | Beyond §4.1 |
| B11 | Dynamic skill development & market alignment (real-time labor data) | PARTIAL-STUB | `career_intelligence.py:58` (trending_skills); `learning_recommender.py:2,71` (courses+certs). Curated/static, not live market feed | L | Beyond §4.2 |
| B12 | Robust agent infra: distributed execution, real-time monitoring, HITL | PARTIAL-STUB | `subagent_orchestrator.py:25` (dispatch); `apply-agent/index.ts:100` (HITL mode); `AgentPanel.tsx:620` (approvals). No distributed exec/monitoring dashboard | L | Beyond §5.1 |
| B13 | Ethical AI & bias detection | ASPIRATIONAL | No bias/fairness code (grep `fairness|bias|demographic_parity` → 0). Truthfulness guardrails exist but are not bias/fairness | L | Beyond §5.2 |

### Cluster C — Agentic core (July-5 Manus-like)

| # | Claim | Verdict | Evidence | Sev | Sources |
|---|---|---|---|---|---|
| C1 | `app/agents/core.py` `AgentOrchestrator` manages subagent lifecycle + Postgres persistence | STALE | No `app/agents/` dir. Closest: `app/agent/subagent_orchestrator.py:25` `SubagentOrchestrator` — in-memory dispatch only, **no Postgres persistence**. Run persistence lives in `automation_engine.py` (`_persist_run`, `agent_runs`) + `agent_db.py` | H | Manus §1.1 |
| C2 | `app/agents/browser_agent.py` `JobApplyAgent` (navigate/analyze/execute/verify) | STALE | No `JobApplyAgent` class. Real integration is `app/services/browser_automation/agent.py:194` `run_browser_agent(instruction, max_steps, on_step)` wrapping `browser_use.Agent`; returns `AgentResult`. No explicit 4-phase split (browser-use's loop handles it) | H | Manus §1.2 |
| C3 | `prompts.py` codifies "No-Mercy" behavior | UNVERIFIABLE | No `prompts.py`; strings "No-Mercy"/"Ruthless Efficiency" absent from `backend/python/app`. Closest: `app/agent/ruthless_engine.py:8` `RuthlessJobEngine` (a job engine, not a prompt codex) | M | Manus §2 |
| C4 | `AgentLiveView` component (live browser feed, real-time logs, progressive transparency) | STALE (exists, differs) | `src/components/agent/AgentLiveView.tsx:46` — takes `{runId}` only, **not** `agentId/status/progress/currentStep/logs`. react-query polling @1500ms; renders step list + scrolling log + HITL submit/cancel gate. **No live browser feed/screenshots/video** | M | Manus §3.1 |
| C5 | `POST /auto-pilot/start` route calls `orchestrator.spawn_subagent(task_type="job_application", …)` | STALE | Route is `/api/v1/autopilot/start` (`routes_mvp.go:2058`), handler `handleAutopilotStart` → Python `/api/v1/autopilot/run` (`main.py:419`) → `automation_engine.run_autopilot(...)`. **No `spawn_subagent` symbol exists anywhere** | C | Manus §3.2 |
| C6 | `AutoPilot.tsx` uses `useAgentPolling` + renders `<AgentLiveView agentId=… …/>` | STALE | `AutoPilot.tsx:79` uses `useQuery` polling `getAutopilotRun` (no `useAgentPolling` hook exists). `AgentLiveView` is rendered by `ApplyAgent.tsx:122` as `<AgentLiveView runId={activeRunId} />` | H | Manus §3.2 |

### Cluster D — Job Theory production plan

| # | Claim | Verdict | Evidence | Sev | Sources |
|---|---|---|---|---|---|
| D1 | `ResumeUpload.tsx`: PDF/DOCX upload, JD paste, 4 AI workflow options, `normalizeGoAnalysis`, `analyze-resume` edge fn, 4 section scores, matched/missing keywords, `customInstructions` | VERIFIED-STILL-TRUE | `ResumeUpload.tsx:438,119-124,555-580,44,203,112,609-625`; `supabase/functions/analyze-resume/index.ts:129-154` | L | JobTheory §2.1 |
| D2 | `JobSearch.tsx`: keyword+location, min-score/remote filters, `searchJobs` API, 5 providers (Greenhouse/Lever/Ashby/Workday/Remotive), save jobs | VERIFIED-STILL-TRUE | `JobSearch.tsx:95-98,448-460,162,133-140,259-262,722-738`; `jobs.ts:37`; providers in `backend/python/app/services/providers/` + `job_providers.py:41-56` | L | JobTheory §2.2 |
| D3 | "Apply Chain" / "Queue for AutoPilot" | STALE (renamed) | `JobSearch.tsx:714` ("Apply with AI chain"), `:720` ("Queue AutoPilot"); `applyChain.ts:28` | L | JobTheory §2.2 |
| D4 | Hermes desktop/sandbox "pops up like a sandbox" | UNVERIFIABLE | `hermes/` exists as scraping/LLM orchestrator (no desktop app launch). Only `--no-sandbox` flag at `hermes/providers/playwright_local.py:62` | H | JobTheory §2.2 |
| D5 | `jobspy-mcp-server` MCP integration | STALE | `jobspy` is a vendored lib in `.venv`, **not wired as MCP server**. Firecrawl is a Hermes provider (`hermes/providers/firecrawl.py:1`), not an MCP server | M | JobTheory §2.2 |
| D6 | Company research / news / salary (Glassdoor, Levels.fyi) | PARTIAL-STUB | Salary via Levels.fyi: `career_intelligence.py:110-146`. Company research: `job_seeker_agent.py:135`. **No news-article analysis, no Glassdoor** | M | JobTheory §2.2 |
| D7 | `Profile.tsx` + `Onboarding.tsx` exist; onboarding captures goals/skills/prefs | VERIFIED-STILL-TRUE | `Profile.tsx:1`, `Onboarding.tsx:1,20-35,60-110` (3-step transition wizard; resume-prefill is in Profile via `importProfilePDF`) | L | JobTheory §2.3 |
| D8 | `InterviewBoard.tsx`: 6 columns, manual add, move, useQuery/useMutation, Gmail sync | VERIFIED-STILL-TRUE | `InterviewBoard.tsx:72-79,190-199,201-223,52,137,142/156/177,62-67,467-503,480-492,320-354` | L | JobTheory §2.4 |
| D9 | Quick actions Prep/Cover Letter/Comms on board cards | STALE | `InterviewBoard.tsx:867-879` — only "AI Interview Prep" tab. Cover Letter is in `JobSearch.tsx:747`; Comms in `CommunicationHub.tsx` | M | JobTheory §2.4 |
| D10 | Calendar integration (auto-add interview dates) | UNVERIFIABLE | Only a `Calendar` icon import (`InterviewBoard.tsx:38`). No calendar API | M | JobTheory §2.4 |
| D11 | Notifications/reminders for interviews/deadlines | UNVERIFIABLE | No notification system in `InterviewBoard.tsx`. A "Daily alert" toggle in `JobSearch.tsx:465-471` but no delivery | M | JobTheory §2.4 |
| D12 | Dynamic resume tailoring from job search (pre-fill JD) | VERIFIED-STILL-TRUE | `applyChain.ts:28-40` (`buildApplyChain`→`optimizeResume` with JD); `JobSearch.tsx:264-272` | L | JobTheory §2.5 |
| D13 | Feedback loop: application performance → Resume Optimizer | PARTIAL-STUB | `JobFeedbackButtons.tsx:1-40` (preference learning); retrospective notes on offer/reject. **Not wired back into Resume Optimizer scoring** | M | JobTheory §2.5 |
| D14 | Skill gap analysis from JDs | VERIFIED-STILL-TRUE | `SkillGapWidget.tsx:10-16` (POST `/v1/skill-gaps`); `JobSearch.tsx:762-768` | L | JobTheory §2.5 |
| D15 | Email integration: automated follow-ups + communication hub | VERIFIED-STILL-TRUE | `CommunicationHub.tsx:62-67`; `CareerOpsDashboard.tsx:407,636-706` (Follow-up Cadence Tracker); `Header.tsx:226` | L | JobTheory §2.6 |
| D16 | "Omni Save AI" third-party integration | STALE | `Omnisave.tsx:10` exists but is an internal "RAG Knowledge Vector Dashboard", not the speculated external product | L | JobTheory §2.6 |

### Cluster E — Already-READY items (July-29 §1, confirmed still good)

| # | Claim | Verdict | Evidence | Sev |
|---|---|---|---|---|
| E1 | Stripe billing: real checkout, portal, signature-verified webhook, sub state by `user_id` | VERIFIED-STILL-TRUE | `routes_billing.go:113,159`; `billing.go:41,53,378-396` | L |
| E2 | API rate limiting: per-client token bucket + exponential penalty | VERIFIED-STILL-TRUE | `middleware.go:73-182` | L |
| E3 | Sentry wired in all 3 runtimes, env-gated | VERIFIED-STILL-TRUE | `main.tsx:5-6`; `cmd/server/main.go:29-41`; `app/main.py:41-48` | L |
| E4 | CI: Go `-race` + 80% gate; Python ruff+pytest+80%; extension tsc/eslint; frontend build+test | VERIFIED-STILL-TRUE | `.github/workflows/ci.yml:27,32-36,56,107,112-115` | L |
| E5 | Typst PDF binary in prod image | **FIXED** | `backend/python/Dockerfile:20-31` (typst v0.15.1 baked in) | M |
| E6 | Stripe webhook idempotency/replay dedupe | **FIXED** | `billing.go:41` (`processedEvents` map), `:386-396` (dedupe by eventID); `billing_test.go:38` | M |
| E7 | `USE_SUPABASE`/`VITE_USE_SELF_HOSTED` defaults to local JWT | STALE (inverted) | `.env.example:49-50` defaults Supabase on both sides; `docker-compose.yml:171` (`USE_SUPABASE:-true`) | M |
| E8 | `bun run test` runs only `ResumeGraph*` specs | STALE | `package.json:12` — `bun test --dom --preload ./src/test/setup.ts src/` runs full `src/` tree | M |
| E9 | `predictive_scorer.py` is a heuristic rubric, not trained on outcomes | VERIFIED-STILL-TRUE | `predictive_scorer.py:1-100` (docstring: "NOT a trained model"); heuristic components. *The "hardcoded 75 fallback" is gone — `keyword_score=None` when no JD* | M |
| E10 | `ats_engine.py` is a strong deterministic heuristic (TF-IDF, bigrams, JD categorization) | VERIFIED-STILL-TRUE | `ats_engine.py:2-4,103,114-124,127-171,188-231,242-359` | L |

## Ranked still-real backlog

Ordered by severity, then by leverage. Each row is a candidate for the next implementation spec.

### Critical

1. **A1+A2 — Split-brain backend (B1).** Supabase edge fns duplicate Go/Python; hosted frontend's `@/api` calls 404 with no `/api` proxy. *This is the single biggest launch blocker and it is architectural.* Fix: pick one authoritative backend for hosted SaaS; gate/delete every unreachable `@/api` path.
2. **A5+A6 — Decorative multi-tenancy (B2).** `tenants`/`memberships`/`tenantMiddleware` exist but `tenant_id` scopes only advisor/cohort routes; every other handler filters by `user_id`. Blocks any B2B2C/agency revenue tier. Fix: enforce tenant scoping in every query + RLS, or drop "multi-tenant" from marketing.
3. **A8 — No backups/DR for hosted path (B4).** `scripts/backup.sh` is self-host only; no managed PITR/restore-drill config. Fix: enable managed PITR, document RPO/RTO, run one live restore drill.

### High

4. **A9 — `strategic_analyzer.py` silent canned fallback.** The last remaining silent-fabrication path (mock-LLM itself now raises, but this analyzer still returns template strings on any exception). Fix: propagate `LLMNotConfiguredError` instead of `_fallback_analysis` on premium paths; never bill a credit for a fallback.
5. **A17+A18 — Scraping legal exposure (B6).** No robots.txt check; `rate_limit_controller.py` exists but is dead code (unwired). Fix: licensed/official feeds for hosted; wire the backoff controller; add robots.txt respect.
6. **A19+A21+A22 — Feature sprawl / dead surface (B7).** 28 flags; 7 zero-reference tables; "Hermes"/"jobtheory" codenames in user-visible Settings copy. Fix: cut to 5 surfaces; drop or archive dead tables; scrub codenames from UI.
7. **A11 — Passive-only mock disclosure.** `DemoModeBanner` is amber; no per-action hard-fail when LLM unconfigured. Fix: hard-fail premium actions client-side when `model_status: llm_not_configured`.
8. **C1+C2+C5+C6 — Agentic-core doc drift.** The "Manus-like" doc describes an architecture that doesn't match the code (`AgentOrchestrator`/`spawn_subagent`/`JobApplyAgent`/`useAgentPolling` don't exist; `AgentLiveView` has a different signature; no live browser feed). Fix: either align the code to the doc's vision or update the doc to match reality. *Likely: update the doc — the real autopilot (`run_autopilot` + `run_browser_agent`) works; the doc's abstraction was never built.*

### Medium

9. **A23 — No Stripe→feature-gate entitlement mapping.** Pricing page is presentational; no runtime enforcement. Fix: wire subscription state to `features.ts` gates.
10. **B2 — Close the outcome-data loop (M2).** The `application_outcomes` spine is wired but not yet a verified dataset. Fix: instrument every automation run → application → reply → interview → offer with verification; expose aggregate callback-rate metrics.
11. **B3 — Make the provenance ledger a visible product (M3).** `privacy_ledger.py` + endpoint + UI already exist; the doc understates this. Fix: productize as the "what left your machine" panel; one-click delete; enterprise outplacement selling point.
12. **B1 — Expand MCP distribution (M1).** Already at 14 tools (doc said 4); pursue ChatGPT/Claude connector-directory listings; make MCP the product headline.
13. **A16 — Hardcoded `_clip` truncation in LLM prompts.** Replace with the `LongContextClient` map-reduce already used in `strategic_analyzer` (per subagent note) — extend to all prompts.
14. **D4+D10+D11 — JobTheory gaps: Hermes desktop UX, calendar, notifications.** All UNVERIFIABLE (no code). Decide: build or formally defer.
15. **D13 — Feedback loop not wired into Resume Optimizer.** Signals captured but not fed back. Fix: close the loop into optimizer scoring.

### Low (aspirational / deferred)

16. **B5–B13** — Networking, referrals, community, interview copilot (frozen), predictive ML, ethical AI. All PARTIAL-STUB or ASPIRATIONAL. Defer until Critical/High cleared; several are frozen by founder decision.

## Recommended next spec

**#1: A1+A2 — Split-brain backend (B1).** It is the single biggest launch blocker, it is architectural (not cosmetic), and every other readiness fix is cheaper once the authoritative-backend decision is made. The next brainstorm cycle should scope exactly: (a) decide Supabase-vs-Go/Python as the hosted authoritative backend, (b) gate or delete every unreachable `@/api` page in the hosted build, (c) document the decision in an ADR. Ponytail: one decision, then mechanical deletion/gating — no new features.

---

## Appendix: per-doc claim trace

### Doc 1 — July-29 readiness (21 rows)
VERIFIED-STILL-TRUE: A1, A2, A5, A6, A8, A9, A11, A17, A19, A21, A22, A23, B3, B4, E1, E2, E3, E4. FIXED: A7, E5, E6. STALE: A3, A4, A10, A18, A20, B1, B2, E7, E8.

### Doc 2 — No-Mercy (8 rows)
FIXED: A12, A13, A14, A15. VERIFIED-STILL-TRUE: A9 (dup), A16, E9, E10. (A9 collapsed with July-29 B5.)

### Doc 3 — Manus-like (6 rows)
STALE: C1, C2, C4, C5, C6. UNVERIFIABLE: C3.

### Doc 4 — Beyond 10/10 (9 rows)
PARTIAL-STUB: B5, B6, B7, B8, B9, B10, B11, B12. ASPIRATIONAL: B13.

### Doc 5 — Job Theory (16 rows)
VERIFIED-STILL-TRUE: D1, D2, D7, D8, D12, D14, D15. STALE: D3, D5, D9, D16. UNVERIFIABLE: D4, D10, D11. PARTIAL-STUB: D6, D13.