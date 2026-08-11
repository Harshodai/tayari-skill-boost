# Agent Execution Manifest — Ruthless Mode

This file tells subagents exactly what to build, in what order, and how to verify it. Use `superpowers:subagent-driven-development` or `superpowers:executing-plans`.

---

## Global rules for every subagent

1. **Read code, not .md.** Use source files as the source of truth.
2. **Minimal change rule** — prefer surgical edits over rewrites.
3. **Route parity** — every new `/api/v1/...` route must have a legacy `/api/...` alias and vice versa.
4. **Self-hosted Supabase schema parity** — any DB change in `backend/db/migrations/` must also be copied to `supabase-local/volumes/db/init/` with the next `NN-` prefix and mounted individually in `supabase-local/docker-compose.yml`.
5. **Test every change** — add or update a test for each modified endpoint/handler/component.
6. **Append to `lessons.md`** — every task completion gets a dated entry per CLAUDE.md.
7. **No manualChunks** in `vite.config.ts`.
8. **Pairwise secret parity** — root `.env` `JWT_SECRET` must equal `supabase-local/.env` `JWT_SECRET`; root `.env` `POSTGRES_PASSWORD` must equal `supabase-local/.env` `POSTGRES_PASSWORD`. `JWT_SECRET` and `POSTGRES_PASSWORD` must remain DIFFERENT values from each other — never reuse one secret for the other.

---

## Agent pack 1: Foundation Fixes

### Task 1.1 — Brand convergence
**Files:**
- Modify: `index.html:7`, `src/pages/Landing.tsx:19,46`, `src/components/Logo.tsx`, `src/components/pet/TayariPet.tsx:314,348,732`, footer components.
- Modify: `src/config/branding.test.ts`
- Test: `src/config/branding.test.ts`

**Verification:**
- `bun run test` (ResumeGraph subset) passes.
- `bun run lint` passes.
- Manual grep for `"Tayari Skill Boost"` in `src/` returns zero product-name uses.

### Task 1.2 — Resume optimizer full data flow
**Files:**
- Modify: `backend/python/app/main.py` `OptimizerRequest`
- Modify: `backend/python/app/api/ai_routes.py` `OptimizerRequest`, `optimize_resume`, `optimize_resume_stream`
- Modify: `backend/python/app/services/optimizer.py` (ensure `optimize_resume_with_options` is invoked when `jd_url` present)
- Modify: `backend/go/internal/api/routes_mvp.go::handleOptimizeResume`
- Modify: `src/api/resumes.ts::optimizeResume`
- Modify: `src/pages/ResumeUpload.tsx` (pass state)
- Modify: `src/pages/ResumeResults.tsx` (read state, pass to optimize)
- Test: `backend/python/app/tests/test_optimizer.py`, Go route test mirroring `routes_resume_import_test.go`

**Verification:**
- `cd backend/python && pytest app/tests/test_optimizer.py -v` passes.
- `cd backend/go && go test ./internal/api/... -run TestOptimizeResume` passes.

### Task 1.3 — Career goal persistence
**Files:**
- Create: `backend/db/migrations/20260810_01_career_goal.sql`
- Create: `supabase-local/volumes/db/init/NN-20260810_01_career_goal.sql`
- Modify: `supabase-local/docker-compose.yml` (add mount)
- Modify: `backend/go/internal/models/profile.go`
- Modify: `backend/go/internal/api/routes_mvp.go::handleGetProfile/handleUpdateProfile`
- Modify: `src/pages/Profile.tsx`
- Modify: `src/pages/Onboarding.tsx`
- Test: Go profile round-trip test

**Verification:**
- `cd backend/go && go test ./internal/api/... -run TestProfile` passes.
- `docker compose --profile dev up -d --build` and onboarding/profile round-trip works.

### Task 1.4 — Knowledge Hub schema unification
**Files:**
- Modify: `backend/python/app/services/omnisave_service.py` (populate embeddings)
- Modify: `backend/python/app/api/knowledge_hub.py` (use vector + FTS retrieval)
- Modify: `backend/go/internal/api/routes_knowledge_hub.go` to use `saved_sources`
- Modify DB migrations as needed.

**Verification:**
- Python test for RAG retrieval returns grounded citations.

---

## Agent pack 2: NL Autopilot Intent

### Task 2.1 — Python intent endpoint
**Files:**
- Create: `backend/python/app/api/autopilot_routes.py`
- Modify: `backend/python/app/main.py` (register router)

**Verification:**
- `pytest backend/python/app/tests/test_autopilot_intent.py -v` passes.

### Task 2.2 — Go proxy + route parity
**Files:**
- Modify: `backend/go/internal/api/routes_app.go`
- Modify: `backend/go/internal/api/routes_mvp.go` or new `routes_autopilot.go`

**Verification:**
- `go test ./internal/api/... -run TestRouterParity` passes.

### Task 2.3 — Frontend intent UI
**Files:**
- Modify: `src/pages/AutoPilot.tsx`
- Create/update: `src/api/autopilot.ts` if needed

**Verification:**
- Manual UI check: typing a sentence produces an editable run config.

---

## Agent pack 3: Closed-Loop Sandbox Apply

### Task 3.1 — Review queue auto-submit
**Files:**
- Modify: `backend/go/internal/api/routes_review_queue.go`
- Modify: `backend/python/app/services/automation_engine.py`
- Modify: `backend/python/app/services/sandbox_executor.py`

**Verification:**
- Go test for approve + auto-submit path.

### Task 3.2 — Per-ATS form schemas
**Files:**
- Create: `backend/python/app/services/ats_forms/greenhouse.py`
- Create: `backend/python/app/services/ats_forms/lever.py`
- Create: `backend/python/app/services/ats_forms/workday.py`
- Create: `backend/python/app/services/ats_forms/ashby.py`
- Create: `backend/python/app/services/ats_forms/bamboohr.py`

**Verification:**
- Tests map sample accessibility snapshots to expected filled values.

### Task 3.3 — Remove hard-coded auto_apply false
**Files:**
- Modify: `src/pages/AutoPilot.tsx`

**Verification:**
- E2E or manual: user can toggle auto-apply and see guardrail warning.

---

## Agent pack 4: Platform Connectors

### Task 4.1 — Substack/Medium RSS connectors
**Files:**
- Modify: `backend/python/app/services/omnisave_service.py`
- Create: `backend/python/app/services/content_connectors/substack.py`
- Create: `backend/python/app/services/content_connectors/medium.py`

**Verification:**
- Python test fetches a public RSS feed and ingests articles.

### Task 4.2 — LinkedIn saved-posts connector
**Files:**
- Create: `backend/python/app/services/content_connectors/linkedin_saved.py`
- Modify extension to capture saved-post list.

**Verification:**
- Manual with test cookie; or mocked Playwright snapshot test.

### Task 4.3 — Gmail interview-board hardening
**Files:**
- Modify: `backend/go/internal/api/routes_gmail.go` (full message fetch, .ics parse, dedupe)
- Modify: `backend/python/app/services/llm_service.py::parse_application_email` if body parsing changes
- Modify: `src/pages/InterviewBoard.tsx` and `src/pages/Settings.tsx` (unify OAuth)

**Verification:**
- Go test for upsert dedupe.
- Pub/Sub watch registration test (mocked).

---

## Agent pack 5: Extension + Mobile

### Task 5.1 — Chrome extension capture buttons
**Files:**
- Modify: `extension/`

**Verification:**
- Load unpacked extension, click save-to-hub, verify POST to `/api/v1/saves`.

### Task 5.2 — Mobile responsive pass
**Files:**
- Modify: core pages as needed.

**Verification:**
- `bun run test:e2e` if mobile tests exist; otherwise manual dev-tools check.

---

## Agent pack 6: Launch Readiness

### Task 6.1 — Outcome metrics + guardrail dashboard
**Files:**
- Modify: `src/pages/Dashboard.tsx`
- Modify: backend aggregation queries.

### Task 6.2 — Security/dependency audit
**Files:**
- Run: `bun audit`, `pip-audit`, `govulncheck ./...`, `git-secrets`.

### Task 6.3 — Legal + pricing pages
**Files:**
- Modify: `src/pages/Landing.tsx` pricing section.
- Create/update: Terms/Privacy pages.

---

## Coordination command for orchestrator

**Coordination command for orchestrator** — spawn one subagent per Task. Tasks sharing a file run SEQUENTIALLY: Task 1.1 (brand convergence, touches `src/pages/Landing.tsx`) MUST complete before Task 6.3 (pricing/copy, same file); Task 1.4 (knowledge-hub unification, touches `backend/python/app/services/omnisave_service.py`) MUST complete before Task 4.1 (Substack/Medium connectors, same file). Before spawning each subagent, acquire an actual file lock: `mkdir -p .superpowers/locks && for f in <files>; do key="${f//\//_}"; while ! mkdir ".superpowers/locks/$key" 2>/dev/null; do sleep 1; done; done` and release with `rmdir .superpowers/locks/"${key}"` (same `key` — paths are translated to single-level keys, so `src/pages/Landing.tsx` → `src_pages_Landing.tsx`) — todo-tracker comments are not synchronization. Each subagent still returns: 1) modified files list, 2) verification command output, 3) blockers, 4) `lessons.md` entry summary.
