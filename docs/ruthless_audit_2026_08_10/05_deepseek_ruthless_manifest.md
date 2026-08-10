# DEEPSEEK RUTHLESS MANIFEST — Job Tayari

> For your DeepSeek run. No sugar. No optimism. Read every line as a failing test.

---

## EXECUTIVE SLAUGHTER

The product is a **collection of partially implemented features masquerading as a platform.**

Every core capability the user asked about is **broken at the final inch**:

- Resume optimizer: powerful engine, **dropping user inputs before execution.**
- Autopilot: has a review queue, **but never actually submits.**
- Onboarding: asks the right questions, **then throws the answers away.**
- OmniSave: has a beautiful page, **but no real platform sync.**
- Gmail: has OAuth, **then parses only subject snippets and calls it smart.**

This is not a 10/10 product. It is not even a 7/10 product. It is a **6/10 demo with 10/10 ambitions.**

The good news: the foundation is real. The bad news: **foundations do not retain users. Finished workflows do.**

---

## POST-CHANGE STATUS (2026-08-10) — what the P0 fixes already resolved

The Q1–Q7 verdicts below are pre-change findings, now partially resolved by the P0 fixes (commits 4fb6382..f64ee3e, 41da91d, a34af6a, a929ae4, dae8c8b, b92ff19, c961f4f, 4351568):

- **Q1 branding:** single name "Job Tayari" everywhere, incl. AgentReachHub labels, tayari-ui header, branded 404 in Layout; branding gate now rejects bare "Tayari" (allowlist for legacy identifier files).
- **Q2 optimizer:** custom_instructions/target_role/jd_url forwarded end-to-end; jd_url now SSRF-guarded via `_validate_public_url` + IP pinning on scrape; target_role propagates through the URL path.
- **Q3 onboarding:** career goal persisted in `public.profiles`; onboarding error-surfaced, sample data removed; Profile cancel restores saved form.
- **Still open (unchanged by P0):** sandbox apply gating (P1/P2), Gmail full-body parsing + Pub/Sub watch, OmniSave platform connectors + embeddings (P0.4 task), NL autopilot intent.

---

## RUTHLESS ANSWERS — THE TRUTH, NOT THE HOPE

The verdicts below describe the PRE-FIX state (baseline 925d16d). See POST-CHANGE STATUS above for what the 2026-08-10 fixes resolved.

### Q1. Does it look professional and use catchy, adoptable copy?

**Verdict: NO — 6/10 at best.**

A professional product has one name. Tayari has at least four:
- `Job Tayari` — index.html
- `Tayari Skill Boost` — Landing.tsx
- `JobTayari` — Logo.tsx
- `Tay` — companion pet

A professional product speaks the user's language. Tayari speaks engineering slang:
- `"Autonomous Career Intelligence & Tayari Computer Automation"`
- `"Branching Onboarding Wizard"`
- `"Configure your personal agentic career operations strategy"`
- `"Skill-Gap Translation"`, `"Level Advancement"`, `"ATS match scoring"`

A professional dashboard teaches new users. Tayari's dashboard **assaults them with every module at once** like a feature checklist.

**The landing page hero is worse than the index hero.** A product that cannot decide its own headline is not ready to launch.

---

### Q2. Is the resume optimizer fully working?

**Verdict: NO — it is 60% broken for the user's stated use cases.**

| Mode | Status | Why it fails |
|---|---|---|
| Resume + pasted JD | Works | Fully wired. |
| Resume + JD link | **BROKEN** | Import endpoint exists, but only fills the paste box. The actual optimizer API has no `jd_url` field. The Python path that supports `jd_url` is **unreachable via HTTP.** |
| Custom instructions | **BROKEN** | Collected in UI. Sent to analysis. **Dropped before the actual optimize call.** The optimizer engine supports them; the API contracts and Go handler do not. |

**Exact failure points:**
- `backend/go/internal/api/routes_mvp.go:handleOptimizeResume` reads only `JobDescription`.
- `backend/python/app/api/ai_routes.py:OptimizerRequest` has no `custom_instructions`, `target_role`, or `jd_url`.
- `src/pages/ResumeResults.tsx::handleOptimize()` calls `optimizeResume(resumeId, jobDescription)` with **two arguments**, ignoring custom instructions.
- `src/pages/ResumeUpload.tsx` does not carry `customInstructions` or `jobPostUrl` through `navigate()` state.

**User promise:** "Optimize my resume with custom instructions and a job link."  
**Reality:** Only "paste text" works.

---

### Q3. Does onboarding capture job-change vs domain-change and allow editing?

**Verdict: NO — 8/10 confidence.**

The onboarding UI has a beautiful branch selector:
- `"Job Change (Same Domain)"` → `transitionType: "same_domain"`
- `"Domain Change (Cross-Industry)"` → `transitionType: "cross_domain"`

Then it writes this critical career signal to:
1. `localStorage`
2. A JSON blob inside `pet_preferences.state.onboarding`

**It does NOT write to the canonical `public.profiles` table.**

The Profile page (`src/pages/Profile.tsx`) has:
- Full name
- Headline
- Summary
- Skills
- Desired roles
- Locations
- Experience years
- Remote preference
- Links

**No career goal. No transition type. No current/target industry.**

This means the entire product infers user intent from `desired_roles[0]`, ignoring the explicit choice the user just made.

---

### Q4. Manus-computer-like setup for job applying?

**Verdict: NO — 6/10 at best.**

| Required component | Exists? | Truth |
|---|---|---|
| Browser agent | Partially | Real browser-use/Playwright agents exist. |
| Sandbox isolation | **NO** | SSRF guard and redirect validation only. Browser runs in-process, not in an isolated container/VM. |
| Safety guardrails | Partially | PipelineGate truthfulness/keyword/PII checks exist, but they are heuristic, not formally verified. |
| Profile-driven apply | Partially | Profile is consumed, but apply still often needs pasted resume text. No structured candidate profile auto-injected into every form. |
| End-to-end browser UI | Partially | `AgentLiveView.tsx` streams screenshots, but it is not connected to the actual submission path. |
| Approval UI | Yes | ReviewQueue exists and is solid. |

**The "computer" is a browser script, not a sandbox.** Manus runs a reasoning agent with tool-calling in a controlled workspace. Tayari has a Playwright operator with safety comments in the code.

---

### Q5. Fully automated pipeline: "Google is my dream company" → scan → optimize → approve → sandbox apply?

**Verdict: NO — 5/10 confidence.**

| Pipeline step | Works? | Truth |
|---|---|---|
| Understand natural-language goal | **NO** | No intent parser. AutoPilot.tsx is a form with `query`, `location`, `maxJobs`. |
| Scan portals for existing jobs | Partially | `scan_portals` exists but only covers Greenhouse/Lever/Ashby/Workday/BambooHR mappings. Google is Workday/SuccessFactors — brittle. |
| Use resume optimizer | Yes | Called inside `automation_engine.run_autopilot`. |
| Get user approval | Yes | ReviewQueue works. |
| Apply via sandbox | **NO** | `auto_apply: false` is hard-coded in `src/pages/AutoPilot.tsx:116`. Approval sets `status='saved'`. `handleSubmitApplication` only updates DB to `applied`. The browser is never invoked. |
| New-job monitoring | Partially | `job_watches` + hourly beat exist, but dedupe/notification is not proven end-to-end. |

**The user asks: "Can it apply for me?"**
**The honest answer: "It can prepare an application. It will not submit it."**

---

### Q6. OmniSave AI-like page?

**Verdict: PAGE EXISTS — FEATURE DOES NOT — 8/10 confidence.**

What exists:
- `src/pages/Omnisave.tsx` — beautiful dashboard.
- `src/pages/KnowledgeHub.tsx` — URL save, summary, tags.
- `backend/python/app/services/omnisave_service.py` — ingest + RAG query.
- `public.saved_sources` + `public.source_chunks` with vector + FTS columns.

What does NOT exist:
- **Substack connector:** only manual URL extraction. No RSS.
- **Medium connector:** only manual URL extraction. No feed.
- **LinkedIn saved-posts connector:** only profile text analyzer.
- **End-to-end sync:** `sync_agent_reach_posts` skips platforms with no manual URL.
- **Vector retrieval:** embeddings column is never populated; RAG uses recency only.
- **Unified data model:** `saved_sources` and `saved_posts` are parallel, unreconciled tables.
- **Self-hosted schema:** `saved_sources`/`source_chunks` migrations are not in `supabase-local/volumes/db/init/`. On self-host, those tables simply do not exist.

**The page looks like OmniSave. The plumbing does not.**

---

### Q7. Gmail connector working for smart interview board loading?

**Verdict: NO — 7/10 confidence.**

What works:
- OAuth flow with `gmail.readonly` scope.
- Token storage.
- Keyword pre-filter: `subject:(offer OR interview OR application OR applied OR reject)`.
- LLM classifier.
- InterviewBoard UI.

What is broken:
- **Only subjects are scanned.** Full body and `.ics` attachments are dropped, so `interview_date`, `meeting_link`, `contact`, and `summary` cannot be reliably extracted.
- **Deduplication is broken.** `ON CONFLICT DO NOTHING` on `applications` without a deterministic `(user_id, company, title)` key creates duplicate cards.
- **Two interview boards exist.** Python's `InterviewBoardEngine` returns in-memory demo cards. The real UI reads Postgres `applications`. They are not the same.
- **Python `EmailConnector` is fake.** It contains only hardcoded simulated emails.
- **Pub/Sub webhook is unregistered.** No `users.me/watch` call. No real-time push.
- **No background sync.** User must click a button.
- **Settings page duplicates OAuth flow** with raw `fetch` and a `localhost:8080` fallback.

**This is not smart loading. This is keyword subject loading with a coat of paint.**

---

## FAILURE TAXONOMY — WHY EVERYTHING IS BROKEN

The same pattern repeats across the codebase:

### Pattern 1: The final inch is never wired
- Resume optimizer: engine supports custom instructions; API does not.
- Autopilot: review queue exists; submission does not.
- Onboarding: UI captures goal; schema does not.
- OmniSave: page exists; connectors do not.
- Gmail: OAuth exists; body parsing does not.

**Diagnosis:** The team builds features to the 80% mark and moves on.

### Pattern 2: Two parallel implementations
- Interview board: Python in-memory demo vs. Go Postgres-backed UI.
- Apply agent: Python backend vs. Supabase Edge Function.
- Knowledge storage: `saved_sources` vs. `saved_posts`.

**Diagnosis:** No single source of truth. Every feature has a shadow version.

### Pattern 3: Schema drift between backend and self-hosted Supabase
- `saved_sources`/`source_chunks` exist in `backend/db/migrations/` but not in `supabase-local/volumes/db/init/`.
- The self-hosted stack silently lacks tables the code expects.

**Diagnosis:** Migrations are not deployment-ready.

### Pattern 4: Trust plumbing is missing
- No action audit log for auto-apply.
- No credential vault for platform sessions.
- No HITL gating at the per-action level.
- No sandbox isolation.

**Diagnosis:** The team is building automation before building control.

---

## RUTHLESS SCORECARD

| Capability | Current score | 10/10 requires |
|---|---:|---:|
| Professional UI/copy | 6/10 | 9/10 |
| Resume optimizer (all 3 modes) | 6/10 | 10/10 |
| Career goal onboarding | 3/10 | 10/10 |
| NL autopilot intent | 2/10 | 10/10 |
| End-to-end sandbox apply | 5/10 | 10/10 |
| Job-board connectors | 7/10 | 10/10 |
| New-job monitoring | 6/10 | 10/10 |
| OmniSave sync | 6/10 | 10/10 |
| Gmail smart interview board | 6/10 | 10/10 |
| Chrome extension | 4/10 | 10/10 |
| Mobile experience | 3/10 | 7/10 |
| Trust/safety/audit | 5/10 | 10/10 |
| **Overall** | **5.5/10** | **10/10** |

---

## WHAT 10/10 ACTUALLY LOOKS LIKE

### Resume optimizer 10/10
- User uploads resume.
- User pastes JD, pastes a URL, or types custom instructions — any combination works.
- Every input is forwarded through the stack and reflected in the output.
- The UI shows which inputs influenced the result.

### Onboarding 10/10
- User selects "Job Change" or "Domain Change".
- Choice is persisted in `public.profiles`.
- Every downstream feature uses it: job search, resume optimizer focus, interview prep, autopilot query derivation.
- User can edit goal on Profile at any time.

### Autopilot 10/10
- User types: "I want to move to Google as a senior backend engineer in London."
- System extracts intent → proposes run config → user confirms.
- Agent scans target companies + open roles.
- For each match: tailors resume + cover letter, runs ATS + guardrails.
- User approves per application.
- Agent opens sandbox stream, fills the ATS form, uploads PDF, submits.
- Every action is logged; user can pause/abort at any step.
- New jobs trigger notifications and auto-enqueue if user opted in.

### OmniSave 10/10
- User connects Substack, Medium, LinkedIn (RSS/OAuth/cookie).
- Saved posts/articles sync automatically every 6 hours.
- AI extracts topics, tags, and summaries.
- Vector + FTS retrieval answers questions with citations.
- Self-hosted stack has all required tables.

### Gmail 10/10
- User connects Gmail.
- System reads full job-related threads (not just subjects), parses `.ics` calendar invites.
- Deterministic dedupe: one card per (user, company, title).
- Follow-up emails update stage and add notes.
- Real-time push via Pub/Sub watch.
- One board: the UI and the agent read the same `applications` table.

---

## THE ONLY PLAN THAT MATTERS

Do not build new features until the existing ones are finished. The 7-week plan from `03_ten_of_ten_plan.md` still applies, but with this ruthless priority:

1. **P0 — Stop lying to users (week 1)**
   - Fix copy. One name. Clear descriptions.
   - Fix resume optimizer: every input reaches the engine.
   - Persist career goal in `profiles`.
   - Remove or hide features that are not wired end-to-end.

2. **P1 — Make autopilot real (weeks 2–3)**
   - NL intent parser.
   - Review-queue approval → actual browser submission.
   - Per-ATS form schemas.

3. **P2 — Make it safe (week 3)**
   - Containerized browser sandbox.
   - Credential vault.
   - Per-action audit log + HITL gate.

4. **P3 — Make it useful daily (week 4)**
   - OmniSave connectors.
   - Gmail full parsing + watch + sync.

5. **P4 — Make it grow (week 5–7)**
   - Chrome extension capture.
   - Mobile pass.
   - Outcome metrics, pricing, security audit.

---

## DEEPSEEK RUN INSTRUCTIONS (v2 — SDD + ponytail hardened)

Feed this manifest into DeepSeek with:

```
You are a ruthless engineering execution agent on the Tayari Skill Boost monorepo. Run from the repository root (use `$REPO_ROOT` or the current working directory; never assume a hard-coded absolute path).

Source code is the only truth. This manifest is your task list and failure taxonomy. No other .md files are trusted.

## Mission
Execute the task queue below in order, one task at a time, TDD-first. Do NOT start new features. Do NOT skip the final inch of any task: the wire, the migration, the test, the commit. A task that ends at "looks done" is not done.

## Non-negotiable repo rules (verify in code, not docs)
1. **// ponytail: minimal-change rule** — surgical edits only. On every non-obvious choice add `// ponytail: <why>` (Go/TS) or `# ponytail: <why>` (Python). Never rewrite code you were not asked to touch. Never refactor opportunistically.
2. **Route parity** — every new `/api/v1/...` route needs the legacy `/api/...` alias and vice versa. Both trees are registered in backend/go/internal/api/routes_app.go; router_parity_test.go asserts them. Register both or the test fails.
3. **DB migration sync** — every change under backend/db/migrations/ MUST be copied to supabase-local/volumes/db/init/ with the next NN- prefix AND mounted individually in supabase-local/docker-compose.yml under the db: service. The Supabase postgres migrate.sh globs non-recursively: a directory mount is silently invisible (zero tables, zero errors).
4. **Mock ≠ passing** — a green test against mocks does not prove the wire. Verify each task's endpoint against the real stack (or the exact probe the task names) before claiming done.
5. **No manualChunks** in vite.config.ts — per-package chunking breaks scoped packages (`@sentry/*`, `@radix-ui/*`) with runtime TDZ errors. Let Rollup chunk automatically.
6. **JWT_SECRET + POSTGRES_PASSWORD identical** across root .env and supabase-local/.env. A mismatch never errors — every login just looks like an invalid token.
7. **VITE_* vars are build args**, not runtime env.
8. Never `docker compose down -v` or `rm -rf supabase-local/volumes/db/data` — bind mount, not a named volume.
9. **Lessons capture** — after each task append a dated entry to lessons.md (what, root cause, fix, reusable lesson). If it's not in lessons.md it didn't happen.

## Execution protocol (subagent-driven, per task)
For EACH task in the queue:
A. **Write the failing test first** (name it in the task). Run it — it MUST fail for the stated reason. Record the failure output.
B. **Implement the minimal change.** Add `// ponytail:` comments on every non-obvious choice (why, not what).
C. **Run the task's verification commands.** Capture exact output. A green that came from a mock, a skipped test, or a wrong-assertion test is a FAIL, not a pass.
D. **Commit** with a conventional message (feat/fix/chore + scope), e.g. `fix(optimizer): forward custom_instructions through Go and Python contracts`.
E. **Self-review, then switch to reviewer persona.** Re-read your own diff hunting the final-inch failures: a field dropped in glue, a route without its parity alias, a migration not synced to supabase-local, a test that asserts nothing, a mock standing in for the real wire. Fix what you find, re-run the tests, amend if needed.
F. **Write the report** in the exact format below. Report file: one per task, `docs/ruthless_audit_2026_08_10/reports/task-N-report.md`.

## Task queue (P0 only — nothing beyond P0 until every P0 task is green)

### Task 1: Brand convergence (ponytail-minimal)
- Files: index.html:7, src/pages/Landing.tsx (hero lines ~19,46), src/components/Logo.tsx, src/components/pet/TayariPet.tsx (intro strings ~314,348,732), footer copyright, src/pages/NotFound.tsx (wrap in Layout with branded copy + 2 CTAs), src/config/branding.test.ts (extend to fail on "Tayari Skill Boost" / "Tay" as product name).
- Rule: product name is "Job Tayari" everywhere. No rename of internals (routes, DB, package names) — this is copy-level only.
- Tests: extend branding.test.ts with the new assertions.
- Verification: `bun run build` green; `bun run lint` no new errors; grep for "Tayari Skill Boost" in src/ returns zero product-name uses.
- Definition of done: one product name in every user-facing string; 404 is branded.

### Task 2: Resume optimizer — every input reaches the engine
- Python: OptimizerRequest in backend/python/app/main.py + backend/python/app/api/ai_routes.py gains custom_instructions, target_role, jd_url (all Optional[str]); optimize_resume()/optimize_resume_stream() route to optimizer.optimize_resume_with_options() when jd_url present; # ponytail comments on the routing branch.
- Go: backend/go/internal/api/routes_mvp.go::handleOptimizeResume reads custom_instructions, target_role, jd_url from the JSON body and forwards them (route parity unchanged — routes already exist on both trees).
- Frontend: src/api/resumes.ts::optimizeResume accepts { jobDescription, customInstructions, targetRole, jdUrl }; src/pages/ResumeUpload.tsx passes customInstructions + jobPostUrl through navigate() state; src/pages/ResumeResults.tsx::handleOptimize forwards them; relax the canAnalyze JD-length gate when custom instructions are present.
- Tests: Python test that /api/v1/optimizer/optimize accepts and respects custom_instructions; Go route test mirroring routes_resume_import_test.go for the new fields; frontend unit test for the payload builder.
- Verification: `cd backend/python && pytest app/tests/test_optimizer.py -v`; `cd backend/go && go test ./internal/api/... -run TestOptimize`; `bun run build`.
- Definition of done: custom instructions, target role, and JD URL all demonstrably reach optimize_with_reflection (assert in tests), and the UI round-trips them.

### Task 3: Career goal persisted in canonical profile
- Migration: create backend/db/migrations/20260810_01_career_goal.sql adding to public.profiles: transition_type TEXT CHECK (IN ('same_domain','cross_domain')), current_title TEXT, target_level TEXT, current_industry TEXT, target_industry TEXT, transferable_skills TEXT[] DEFAULT '{}'. Sync: copy to supabase-local/volumes/db/init/NN-20260810_01_career_goal.sql + individual mount in supabase-local/docker-compose.yml.
- Go: backend/go/internal/models/profile.go + handleGetProfile/handleUpdateProfile in routes_mvp.go read/write the new columns.
- Frontend: src/pages/Profile.tsx gains a "Career Goal" card with branch selector + conditional inputs; src/pages/Onboarding.tsx finish() writes via updateProfile() (pet_preferences mirror secondary, best-effort, never primary).
- Tests: Go profile round-trip test asserting GET returns what PUT stored.
- Verification: `cd backend/go && go test ./internal/api/... -run TestProfile`; restart stack with `docker compose --profile dev up -d --build`; verify onboarding → /profile round-trip via API, not UI screenshot.
- Definition of done: transition choice survives logout/re-login and appears in GET /api/v1/profile.

### Task 4: Knowledge Hub schema unification (P0.4)
- One line: consolidate on `public.saved_sources` + `public.source_chunks`; deprecate `saved_posts`; populate `source_chunks.embedding` on ingest in `omnisave_service.py`; sync any missing schema to `supabase-local/volumes/db/init/` with individual mounts per repo rules.

## Blockers protocol
- If a task cannot pass its gates: report BLOCKED with the exact failing command output and your best root-cause hypothesis. Do NOT fake green. Do NOT skip a gate. Do NOT move to the next task with an open blocker.
- If you believe the manifest's instruction conflicts with the actual code, the code wins for the failure, but flag the conflict in the report — do not silently diverge.

## Report format (per task)
```
## Task N: <name>
STATUS: DONE | DONE_WITH_CONCERNS | BLOCKED
COMMITS: <sha1> <message>, <sha2> <message>, ...
FILES: <path1>, <path2>, ...
TESTS: <command> -> <output summary>
VERIFICATION: <command> -> <output summary>
PONYTAIL COMMENTS: <count> added, examples: <one-liner each>
SELF-REVIEW FINDINGS: <what the reviewer persona caught and fixed>
BLOCKERS: <none | description>
LESSONS: <lessons.md entry appended, one line>
```

---

## FINAL VERDICT

**Can this be a 10/10 product?** Yes.
**Is it today?** No.
**Is the gap bridgeable in 7 weeks with focused execution?** Yes.
**Will it be profitable?** Only if trust, unit economics, and outcomes are measured honestly.

The product is not a failure. It is a **rough draft of a category winner.**
