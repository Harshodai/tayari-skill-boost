# Job Tayari — 10/10 Implementation Plan

> Goal: become the one-stop autonomous career OS for software engineers: one profile, one command, transparent agent finds/tailors/approves/applies in a sandbox, with knowledge capture and interview-board intelligence.

This plan is written for agentic execution. Each phase is independent, testable, and ends with a passing gate. Follow the plan in order.

---

## Phase 0: Foundation Fixes (week 1)

These unblock everything downstream. No feature work starts until these are green.

### P0.1 Converge brand + fix copy schizophrenia
- Pick one product name: **Job Tayari**.
- Update `index.html`, `src/pages/Landing.tsx`, `src/components/Logo.tsx`, `src/components/pet/TayariPet.tsx` intro strings, footer copyright.
- Extend `src/config/branding.test.ts` to fail on `Tayari Skill Boost` or `Tay` as product name.
- Rewrite `Landing.tsx` hero to match `HeroSection.tsx`: `"The career platform built for outcomes."`
- Add 3-word subtitles to `Dashboard.tsx` feature cards and `FeaturesSection.tsx`.
- Rebuild `src/pages/NotFound.tsx` inside `Layout` with branded copy + CTAs.

### P0.2 Fix resume optimizer data loss
- Update Python `OptimizerRequest` in `backend/python/app/main.py` and `backend/python/app/api/ai_routes.py`:
  - Add `custom_instructions: Optional[str] = None`
  - Add `target_role: Optional[str] = None`
  - Add `jd_url: Optional[str] = None`
- Regular path `optimize_resume()` routes to `optimizer.optimize_resume_with_options()` when `jd_url` is supplied, else `optimize_with_reflection` with the new fields. Streaming path (`optimize_resume_stream`) forwards `custom_instructions` and `target_role` through `optimize_with_reflection`; `jd_url` is NOT part of the streaming Form contract — documented limitation (streaming URL scraping is out of scope). (current impl routes on `jd_url` only — this is the completion requirement for options-based routing)
- Update Go `handleOptimizeResume` in `backend/go/internal/api/routes_mvp.go` to read and forward `custom_instructions`, `target_role`, `jd_url`.
- Update `src/api/resumes.ts::optimizeResume()` signature to accept `{jobDescription, customInstructions, targetRole, jdUrl}`.
- Update `src/pages/ResumeUpload.tsx` to pass `customInstructions` and `jobPostUrl` through `navigate()` state.
- Update `src/pages/ResumeResults.tsx::handleOptimize()` to read and forward those values.
- Lower `canAnalyze` JD length gate when custom instructions are present.
- Add Go + Python tests for the new fields.

### P0.3 Persist career goal in canonical profile
- Add to `public.profiles` in `backend/db/migrations/` (new file `20260810_01_career_goal.sql`):
  - `transition_type TEXT CHECK (transition_type IN ('same_domain', 'cross_domain'))`
  - `current_title TEXT`
  - `target_level TEXT`
  - `current_industry TEXT`
  - `target_industry TEXT`
  - `transferable_skills TEXT[] DEFAULT '{}'`
- Copy migration to `supabase-local/volumes/db/init/22-20260810_career_goal.sql` and add the individual-file mount in `supabase-local/docker-compose.yml`'s `db:` service: `- ./volumes/db/init/22-20260810_career_goal.sql:/docker-entrypoint-initdb.d/migrations/zz-22-20260810_career_goal.sql:Z` (after the zz-21 mount).
- Update `backend/go/internal/models/profile.go`.
- Update `backend/go/internal/api/routes_mvp.go::handleGetProfile/handleUpdateProfile`.
- Update `src/pages/Profile.tsx` with "Career Goal" card + branch selector.
- Update `src/pages/Onboarding.tsx` `finish()` to call `updateProfile()` and only secondarily mirror to pet state.
- Add Go profile round-trip test.

### P0.4 Unify knowledge-hub data model
- Consolidate on `public.saved_sources` + `public.source_chunks`.
- Drop or deprecate `public.saved_posts` and update Go handlers in `routes_knowledge_hub.go` to use `saved_sources`.
- Ensure `source_chunks.embedding` is populated on ingest (add embedding generation in `omnisave_service.py`).
- Copy any missing schema to `supabase-local/volumes/db/init/`.

---

## Phase 1: Natural-Language Autopilot Intent (week 2)

Goal: user types a career sentence and the system proposes a run config.

### P1.1 Add `/api/v1/autopilot/intent` endpoint
- Python: `backend/python/app/api/ai_routes.py` or new `backend/python/app/api/autopilot_routes.py`.
- Request: `{ "goal": "I want to shift jobs and Google is my dream company" }`
- Response: `{ "dream_companies": ["Google"], "target_titles": [...], "locations": [...], "salary_floor": ..., "remote": ..., "reasoning": "..." }`
- Implement with LLM + output guardrails (JSON schema, refusal detection).

### P1.2 Go proxy route
- Add `POST /api/v1/autopilot/intent` and `/api/autopilot/intent` in `backend/go/internal/api/routes_app.go` proxying Python.
- Add route-parity test.

### P1.3 Frontend intent input
- Add chat-style input to `src/pages/AutoPilot.tsx`.
- Show proposed config for user edit/confirm before start.

### P1.4 Tests
- Python test: intent endpoint extracts expected fields from sample sentences.
- Go test: route forwards and returns JSON.

---

## Phase 2: Close the Approval → Sandbox Submit Loop (week 2–3)

Goal: after user approves a tailored resume/cover letter, the agent can actually submit the application in the sandbox.

### P2.1 Add `submission_mode` enum
- DB: `applications.submission_mode TEXT CHECK (submission_mode IN ('manual','auto')) DEFAULT 'manual'`.
- Update `autopilot_runs`, `review_queue`, `applications` tables as needed.

### P2.2 Update review-queue approval/submit flow
- `backend/go/internal/api/routes_review_queue.go::handleApproveReviewQueueItem`:
  - If `submission_mode == 'auto'` and user pre-approves, call Python browser automation to apply.
- `handleSubmitApplication`: when `submission_mode == 'auto'`, invoke Python apply and return attempt ID.

### P2.3 Python apply execution
- In `backend/python/app/services/automation_engine.py`, ensure `apply_job` is called when `auto_apply=True`.
- Use `TayariComputerSandboxExecutor` (`sandbox_executor.py`) for accessibility-snapshot-based form fills.
- Record result in `application_attempts`.

### P2.4 Remove hard-coded `auto_apply: false`
- `src/pages/AutoPilot.tsx:116` — make it a user toggle with default `false` but allow `true`.
- Show clear warning/approval UI when auto-apply is enabled.

### P2.5 Add per-ATS form schemas
- New directory: `backend/python/app/services/ats_forms/`.
- Schemas for Greenhouse, Lever, Workday, Ashby, BambooHR.
- Each schema maps accessibility snapshot fields to candidate profile fields.

### P2.6 Tests
- End-to-end eval against staging ATS forms (can be HTML fixtures).
- Go test for review-queue submit with `submission_mode=auto`.

---

## Phase 3: Real Sandbox + Safety (week 3)

Goal: Manus-computer-level trust and isolation.

### P3.1 Containerized browser sandbox
- New Docker service `browser-sandbox` based on `browserless/chromium` or Playwright + isolated network.
- `backend/python/app/services/sandbox_executor.py` calls the sandbox via HTTP/WebSocket, not local browser.
- Restrict egress to allow-list: job-board domains only.

### P3.2 PII / credential vault
- Use `platform_configs` + `user_sessions` tables.
- Encrypt credentials at rest.
- Add RLS so users can read only their own rows; superuser only for service account.

### P3.3 Action audit log
- New table `agent_action_log` with run_id, action, target_url, payload_hash, approval_id, result.
- Every external mutation (navigate, fill, click, submit) logged before execution.

### P3.4 Human-in-the-loop gating
- `agent_action_approvals` table already exists; wire it so every `submit_application` tool call requires an approval row.
- Frontend: live stream with per-action Approve/Reject in `AgentLiveView.tsx`.

---

## Phase 4: Platform Connectors — OmniSave + Gmail + Interview Board (week 4)

### P4.1 Substack connector
- RSS parser for `https://<author>.substack.com/feed`.
- Private newsletters via user-supplied session cookie stored in `platform_configs`.

### P4.2 Medium connector
- RSS parser for `https://medium.com/feed/@username`.

### P4.3 LinkedIn saved-posts connector
- Browser automation flow with exported cookies from extension.
- Capture saved-post list URL and titles.

### P4.4 Background sync
- New Celery task `sync_omnisave_sources` in `backend/python/app/tasks/automation.py`.
- Run every 6 hours per user with connected platforms.

### P4.5 Gmail interview board — production hardening
- Switch to `format=full` for job-related messages and parse `text/plain` + `.ics`.
- Add deterministic upsert key `(user_id, lower(company), lower(title))` and update stage on follow-up.
- Unify Python `InterviewBoardEngine` with Postgres `applications`.
- Register Gmail `users.me/watch` on OAuth callback; verify Pub/Sub push.
- Add periodic background sync Celery task.
- Fix `Settings.tsx` to use shared `dashboard.ts` Gmail helpers.

### P4.6 Vector RAG in Knowledge Hub
- Generate chunk embeddings on ingest.
- Replace recency-only retrieval with `match_job_knowledge()` or Python vector query.

---

## Phase 5: Chrome Extension + Daily Habit Surface (week 5)

### P5.1 Make extension a first-class capture tool
- One-click save current page to Knowledge Hub.
- One-click save job from any careers page to `saved_jobs`.
- Capture LinkedIn saved-post list when on `linkedin.com`.

### P5.2 New-tab dashboard
- Minimal daily digest: active applications, new matches, saved articles, next action.

### P5.3 Mobile responsive pass
- Audit all core pages on 375px, 768px, 1440px.
- Fix touch targets ≥44px, horizontal scroll, font scaling.

---

## Phase 6: Trust, Metrics, and Growth Loop (week 6)

### P6.1 Outcome tracking
- Track `interview_rate`, `response_rate`, `offer_rate` per user cohort.
- Surface in dashboard with honest confidence intervals.

### P6.2 Guardrail dashboard
- Show how many applications were blocked, why, and what changed.

### P6.3 Referral / invite loop
- Add "invite a fellow engineer" with 1-month premium.

### P6.4 Pricing clarity
- One free tier, one premium tier, one autonomous-apply tier.
- Value metric: number of agent actions / tailored applications.

---

## Phase 7: Hardening and Launch Readiness (week 7)

### P7.1 Security audit
- Dependency audit (`bun audit`, `pip-audit`, Go vulnerability scan: `govulncheck ./...` (provision via `go install golang.org/x/vuln/cmd/govulncheck@latest`; record output to a committed `security-reports/govulncheck.txt` artifact and fail the CI gate on findings)).
- Secrets scan.
- Rate-limit verification across all routes.

### P7.2 Legal / compliance
- Terms of service update for autonomous apply.
- Data retention policy for Gmail tokens.
- Cookie consent if needed.

### P7.3 Performance audit
- Bundle analysis; remove unused dependencies.
- API response time p95 <500ms.
- Browser automation p95 <30s per application.

### P7.4 Support and docs
- In-app help center links.
- Agent-ready runbooks in `docs/agents/`.

---

## Execution order for maximum impact

1. **P0** (week 1) — must be green before any feature work.
2. **P1 + P2** (weeks 2–3) — this is the core Manus-like differentiator.
3. **P3** (week 3) — safety and trust; required before any real auto-apply.
4. **P4** (week 4) — retention moat (OmniSave + Gmail).
5. **P5** (week 5) — distribution moat (extension + mobile).
6. **P6 + P7** (weeks 6–7) — metrics, pricing, launch readiness.

Total timeline: **7 weeks to 10/10 product** with a focused agentic team.
