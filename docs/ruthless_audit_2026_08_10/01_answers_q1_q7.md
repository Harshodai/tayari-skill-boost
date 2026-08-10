# Tayari Skill Boost — Ruthless Audit: Answers to Q1–Q7

Audited from latest main via subagent code inspection. No .md files were trusted.

> **Provenance:** Pre-change baseline audit (2026-08-10, commit 925d16d). The P0 fixes (2026-08-10, commits 4fb6382..f64ee3e) resolved: single product name "Job Tayari" (Landing.tsx, branding gate), branded 404 in Layout, optimizer custom_instructions/target_role/jd_url forwarding, career-goal persistence, backend platform_name cleanup. Findings below describe the state BEFORE those fixes.

---

## Q1. Does the platform look professional and use catchy, easy-to-adopt UX copy?

**Verdict: NO — 6/10.**

Visually credible, but the product **does not know its own name** and speaks engineering slang at users.

### Exact failures
- `index.html:7` — `"Job Tayari — AI-Native Career Platform"`
- `src/pages/Landing.tsx:19` — `"Tayari Skill Boost"`
- `src/components/Logo.tsx` — renders `"JobTayari"`
- `src/components/pet/TayariPet.tsx` — companion calls itself `"Tay"`
- `src/pages/Landing.tsx:46` — hero `"Autonomous Career Intelligence & Tayari Computer Automation"` — buzzword soup, no human meaning
- `src/pages/Onboarding.tsx` — `"Branching Onboarding Wizard"`, `"Configure your personal agentic career operations strategy"`, `"Skill-Gap Translation"`, `"Level Advancement"`, `"ATS match scoring"`
- `src/pages/Dashboard.tsx` — assaults new users with every module simultaneously
- `src/pages/NotFound.tsx` — plain text raw `<a>`, breaks immersion

A professional product has one name, one voice, and copy written for the user. Tayari has four names and copy written for the engineering team.

### Evidence
1. **Brand name schizophrenia** — `Job Tayari` in `index.html`, `Tayari Skill Boost` in `src/pages/Landing.tsx`, `JobTayari` in `src/components/Logo.tsx`, companion `Tay` in `src/components/pet/TayariPet.tsx`. Users see 3–4 names for one product.
2. **Landing headline is over-engineered** — `"Autonomous Career Intelligence & Tayari Computer Automation"` (Landing.tsx:46). Uses invented terms before the user understands the product.
3. **Index hero is stronger** — `"The career platform built for outcomes."` (HeroSection.tsx:68), but the badge says `"Now with Hermes AI Agent"` (internal codename).
4. **Onboarding uses internal vocabulary** — `"Branching Onboarding Wizard"`, `"Configure your personal agentic career operations strategy"`, `"Skill-Gap Translation"`, `"Level Advancement"`, `"ATS match scoring"` (Onboarding.tsx).
5. **Dashboard is dense** — advertises every tool at once; no progressive disclosure for new users.
6. **Invented product names need subtitles** — `"One-Shot Autopilot Console"`, `"Omnisave AI"` appear without immediate human-readable descriptions.
7. **404 page breaks immersion** — `src/pages/NotFound.tsx` is plain text with a raw `<a>`, not inside `Layout`.

### What "yes" looks like
- One product name everywhere.
- Hero = user transformation in one sentence + one concrete outcome.
- Every feature card uses `[Action] [object] [outcome]` phrasing.
- Dashboard starts empty and teaches, rather than listing every module.

---

## Q2. Is the resume optimizer fully working for (a) resume + pasted JD, (b) resume + JD link, (c) custom instructions?

| Mode | Working | Confidence | Why |
|---|---:|---:|:---|
| (a) Resume + pasted JD | **Y** | 9/10 | Fully wired UI → Go → Python `/api/v1/optimizer/optimize`. |
| (b) Resume + JD link | **BROKEN** | 7/10 | Import endpoint fills the paste box only. The optimizer API has no `jd_url` field. The Python path that supports `jd_url` is **unreachable via HTTP.** |
| (c) Custom instructions | **BROKEN** | 8/10 | Collected in UI, sent to analysis, **dropped before the actual optimize call.** |

### Exact failure points
- `backend/go/internal/api/routes_mvp.go:handleOptimizeResume` reads only `JobDescription` from the JSON body.
- `backend/python/app/api/ai_routes.py:OptimizerRequest` lacks `custom_instructions`, `target_role`, and `jd_url`.
- `src/pages/ResumeResults.tsx::handleOptimize()` calls `optimizeResume(resumeId, jobDescription)` with **two arguments**, ignoring custom instructions.
- `src/pages/ResumeUpload.tsx` does not carry `customInstructions` or `jobPostUrl` through `navigate()` state.

### Key code paths
- Frontend: `src/pages/ResumeUpload.tsx`, `src/pages/ResumeResults.tsx`, `src/api/resumes.ts`.
- Go: `backend/go/internal/api/routes_mvp.go:handleOptimizeResume`, `backend/go/internal/api/routes_resume_extra.go`.
- Python: `backend/python/app/api/ai_routes.py`, `backend/python/app/services/optimizer.py`.

### Fix summary
- Extend `OptimizerRequest` with `custom_instructions`, `target_role`, `jd_url`.
- Forward those fields through Go and the frontend optimize call.
- Carry `customInstructions` and `jobPostUrl` through the analysis → results navigation state.

---

## Q3. Does onboarding capture job-change vs domain-change, and can users edit that goal later?

**Verdict: NO — 8/10 confidence.**

The onboarding UI has a beautiful branch selector, then **throws the answer away.**

### Exact failure
- `src/pages/Onboarding.tsx` writes `transitionType` to:
  1. `localStorage["tayari_onboarding"]`
  2. `pet_preferences.state.onboarding` JSON blob
- It does **NOT** write to the canonical `public.profiles` table.
- `public.profiles` has no `transition_type`, `current_title`, `target_level`, `current_industry`, `target_industry`, or `transferable_skills` columns.
- `src/pages/Profile.tsx` has no career-goal editing section.
- The rest of the product infers intent from `desired_roles[0]`, ignoring the explicit user choice.

**User promise:** "Tell us your career goal so we can tailor everything."  
**Reality:** The goal is a frontend-only sticky note.

### Key locations
- Onboarding capture: `src/pages/Onboarding.tsx`.
- Canonical profile table: `public.profiles` — no transition/current/target fields.
- Profile API: `backend/go/internal/api/routes_mvp.go:handleGetProfile/handleUpdateProfile` — reads/writes only `headline, summary, skills, desired_roles, locations, experience_years, open_to_remote, links`.
- Profile page: `src/pages/Profile.tsx` — no goal editing.

### Fix summary
- Add `transition_type`, `current_title`, `target_level`, `current_industry`, `target_industry`, `transferable_skills` to `public.profiles`.
- Update Go profile model/handler, `Profile.tsx`, and onboarding `finish()` to write to the canonical table.
- Copy migration into `supabase-local/volumes/db/init/` with correct prefix + mount.

---

## Q4. Do we have a Manus-computer-like setup for job applying with sandbox, safety, profile, and end-to-end browser UI?

**Verdict: NO — 6/10.**

Browser automation exists. A real **sandbox** does not.

| Capability | Verdict | Confidence |
|---|---:|---:|
| Browser agent (browser-use / Playwright) | Yes — partial | 7/10 |
| Sandbox isolation | **NO** | 6/10 |
| Safety guardrails | Partial | 7/10 |
| Profile-driven apply | Partial | 6/10 |
| Approval UI | Yes | 8/10 |
| Job-board connectors | Partial | 7/10 |
| New-job monitoring | Partial | 6/10 |

### Exact failure
- Browser runs **in-process**, not in an isolated container/VM.
- No network egress allow-list beyond SSRF guard.
- No filesystem isolation.
- No action audit log.
- No credential vault for platform sessions.

**Manus is a reasoning agent in a controlled workspace. Tayari is a Playwright script with safety comments in the code.**

### Key files
- Browser agent: `backend/python/app/services/browser_automation/agent.py`, `backend/python/app/agent/browser_operator.py`.
- Go browser routes: `backend/go/internal/api/routes_browser.go`.
- AutoPilot engine: `backend/python/app/services/automation_engine.py`, `autopilot_graph.py`.
- Review queue: `src/pages/ReviewQueue.tsx`, `backend/go/internal/api/routes_review_queue.go`.
- Scheduler: `backend/python/app/services/scheduler.py`, `backend/python/app/tasks/automation.py`.

---

## Q5. Is the pipeline automated end-to-end: user says "I want to shift jobs and Google is my dream company" → scan portals → optimize → approve → sandbox apply, for existing and new jobs?

**Verdict: NO — 5/10 confidence.**

The single-command closed-loop pipeline **does not exist.**

| Step | Status | Truth |
|---|---|---|
| Understand NL goal | **BROKEN** | `AutoPilot.tsx` is a form with `query`, `location`, `maxJobs`. No intent parser. |
| Scan portals | Partial | `scan_portals` covers Greenhouse/Lever/Ashby/Workday/BambooHR. Google's scraping is brittle. |
| Optimize resume | Works | Called inside `automation_engine.run_autopilot`. |
| Approval UI | Works | `ReviewQueue` is solid. |
| Sandbox apply | **BROKEN** | `auto_apply: false` is hard-coded at `src/pages/AutoPilot.tsx:116`. Approval sets `status='saved'`. `handleSubmitApplication` only updates DB to `applied`. The browser is never invoked. |
| New-job monitoring | Partial | `job_watches` + hourly beat exist, but dedupe/notification is unproven. |

**User promise:** "Tell us your dream company and we'll apply for you."  
**Reality:** It prepares an application. It will not submit it.

**This is not a Manus-level autopilot. It is a preparation queue with a disabled trigger.**

---

## Q6. Is there an OmniSave AI-like page for Substack, Medium, LinkedIn saved posts with AI auto-tagging, Q&A, citations?

**Verdict: PAGE EXISTS — FEATURE DOES NOT — 8/10 confidence.**

The UI is there. The plumbing is not.

### What exists
- `src/pages/Omnisave.tsx` — beautiful dashboard.
- `src/pages/KnowledgeHub.tsx` — URL save, summary, tags.
- Go routes: `backend/go/internal/api/routes_knowledge_hub.go`.
- Python service: `backend/python/app/services/omnisave_service.py`.
- DB schema: `public.saved_sources`, `public.source_chunks`.

### What is broken
- **No Substack connector** — only manual URL extraction. No RSS.
- **No Medium connector** — only manual URL extraction. No feed.
- **No LinkedIn saved-posts connector** — only profile text analyzer.
- **No end-to-end sync** — `sync_agent_reach_posts` skips platforms without a manual URL.
- **Embeddings never populated** — RAG uses recency-only retrieval.
- **Two competing tables** — `saved_sources` vs `saved_posts`, not reconciled.
- **Self-hosted schema missing** — `saved_sources`/`source_chunks` are not copied to `supabase-local/volumes/db/init/`. On self-host, those tables do not exist.
- **No background sync** — no Celery task.

**The page looks like OmniSave. The data flow does not.**

---

## Q7. Is the Gmail connector working? Does it read only required emails for smart loading of the interview board?

**Verdict: NO — 7/10 confidence.**

OAuth is wired. Smart loading is **not.**

### What exists
- OAuth flow in `backend/go/internal/api/routes_gmail.go` with `gmail.readonly` scope.
- Token storage in `gmail_tokens`.
- Keyword pre-filter: `subject:(offer OR interview OR application OR applied OR reject)`.
- LLM classifier via `backend/python/app/services/llm_service.py:parse_application_email()`.
- Insert into `applications` table with `ON CONFLICT DO NOTHING`.
- `src/pages/InterviewBoard.tsx` UI.

### What is broken
1. **Only subjects are scanned.** Full body and `.ics` calendar invites are dropped. `interview_date`, `meeting_link`, `contact`, `summary` cannot be reliably extracted.
2. **Deduplication is broken.** `ON CONFLICT DO NOTHING` without a deterministic `(user_id, company, title)` key creates duplicate cards.
3. **Two interview boards exist.** Python `InterviewBoardEngine` returns in-memory **demo** cards. The real UI reads Postgres `applications`. They are not the same.
4. **Python `EmailConnector` is fake.** Contains only hardcoded simulated emails.
5. **Pub/Sub webhook is unregistered.** No `users.me/watch` call. No real-time push.
6. **No periodic sync.** User must click a button.
7. **Settings page duplicates OAuth flow** with raw `fetch` and `localhost:8080` fallback.

**This is not smart loading. This is keyword subject loading with a coat of paint.**

### Fix summary
- Fetch full message body + `.ics` attachments.
- Add deterministic upsert key and dedupe logic.
- Unify interview-board data: have Python agent read/write Postgres `applications`.
- Register Gmail watch on OAuth callback, verify Pub/Sub push.
- Add Celery background sync.

---

*Next document: gap matrix + 10/10 build plan.*
