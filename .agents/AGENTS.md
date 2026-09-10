# 🤖 Tayari Skill Boost - Agent Instructions

This file dictates specific constraints, rules, and architectural guidelines that all AI agents MUST follow when interacting with the `tayari-skill-boost` repository.

## 🏗 Architectural Rules

1.  **Strict Service Separation**:
    *   **Go (`backend/go/`)**: Must ONLY be used for routing, authentication, simple CRUD, and database queries. DO NOT implement complex LLM logic here.
    *   **Python (`backend/python/`)**: Must ALWAYS be used for AI inference, NLP, web scraping (Hermes), and async workers (Celery). 
2.  **API Communication**:
    *   The frontend must NEVER call the Python AI engine directly. All requests must go through the Go API Gateway (e.g., `/api/v1/ai/...`), which acts as a reverse proxy.
3.  **Local First / Self-Hosted Compatibility**:
    *   Always respect the `VITE_USE_SELF_HOSTED` flag in the frontend. 
    *   Never hardcode cloud Supabase URLs; always use the environment variables to ensure the self-hosted Docker mode continues to function perfectly.
4.  **Database Migrations**:
    *   PostgreSQL schema changes must be meticulously documented and ideally added to init scripts.

## 🎨 Frontend Coding Standards

1.  **Styling**: Use Tailwind CSS exclusively. Do not write raw CSS unless absolutely necessary for complex animations. Use `shadcn/ui` components for all standard UI elements (buttons, inputs, dialogs).
2.  **State Management**: Use React Context for global state (e.g., `AuthContext`, `AutomationContext`). Avoid pulling in heavy state managers like Redux.
3.  **Feature Flags**: If you are adding a new page or a major component, you MUST register it in `src/config/features.ts` and wrap its visibility using the existing feature flag logic.

## 🧪 Testing Constraints

1.  **E2E Testing**: Any change to the authentication flow, navigation, or pricing pages must be accompanied by an update to the Playwright suite (`e2e/features.spec.ts`).
2.  **Password Strictness**: The platform enforces a strict 12-character minimum password policy. If you write a test script or seed script, the password MUST conform to this standard or the test will silently fail.
3.  **Network Resolution**: When testing or pinging services via scripts, prefer `127.0.0.1` over `localhost` to avoid IPv6 resolution timeouts.

## 🚀 Docker & Deployment

1.  **Env Variables**: Ensure that new frontend environment variables (prefixed with `VITE_`) are properly documented in `.env.example` and are accounted for during the Docker build phase, as Vite statically replaces them.
2.  **Zero-Downtime Awareness**: Do not introduce blocking loops in the Go or Python services. Offload heavy processing to Celery workers.

## 📚 Lessons Learned & Code Reviews

All AI agents must strictly adhere to the continuous learnings, code review standards, and production-readiness rules documented in [lessons.md](lessons.md):
- **No Hardcoded Static Fallbacks**: Never hardcode dummy user text or mock payloads in React components; always fetch dynamically from `AuthContext` and `getProfile()`.
- **Mandatory `apiFetch` Usage**: Never call `fetch('/api/v1/...')` directly in React components; always use `apiFetch('/v1/...')` from `@/api` to respect `VITE_API_URL` and `VITE_USE_SELF_HOSTED`.
- **Explicit Error Banners**: Non-2xx backend errors must be rendered in styled UI alert banners (`AlertCircle`).
- **Async Lock Hygiene**: Use lazy per-event-loop lock getters (`_get_repl_lock()`) to prevent event loop binding errors during pytest runs.


## 🔐 Ruthless Production Security & HITL Rules

1. **Manual-submit boundary is mandatory**: `AUTONOMOUS_SUBMIT_ENABLED` must default to `false` and be enforced server-side. The agent must never create accounts, enter passwords, OTP/MFA codes, CAPTCHA answers, legal declarations, work authorization, sponsorship, salary, EEO, or credentials. These fields must pause the run and create an owner-scoped durable human handoff.
2. **A browser stop button must terminate the real resource**: client aborts are not enough. Server-side cancellation must terminate the browser session and the work loop must poll the cancellation state.
3. **Identity must come from verified auth**: reject `default_user` and all synthetic identities. The Go gateway must forward the verified user ID to Python, and every database read/write/transition must include an owner predicate.
4. **Sensitive answer storage must be persistent and fail closed**: answer snapshots require owner, version, provenance, sensitivity class, application context, expiry/confirmation rules, and auditability. A database outage must never appear as an empty safe queue. Previously stored sensitive answers must not silently auto-fill a new application.
5. **RLS and grants are separate controls**: every public table needs verified owner-scoped RLS, least-privilege grants, and two-user negative tests. Secret tables such as API keys and password-reset tokens should be service-role-only. Never use `USING (true)` for `anon` or general `authenticated` access.
6. **Truthful UI only**: no fabricated names, emails, scores, proof claims, URLs, compensation values, mock application payloads, or unconditional “ready” labels. A manually recorded submission is candidate-confirmed but externally unverified until a real receipt/evidence exists.

## ☁️ AWS Canary and Cost Rules

1. The low-cost AWS deployment is a single EC2 canary using `docker-compose.aws.yml`: Caddy is the only public reverse proxy; Go is public behind `/api`; Python and Redis remain private; Supabase/PostgreSQL/Auth stay external until the self-hosted database contract is verified.
2. Use `deploy/aws/ec2-canary.yaml` and `deploy/aws/provision.sh`; create a budget before provisioning; restrict SSH to the operator CIDR; prefer SSM; encrypt the root volume; keep `deploy/aws/.env` outside Git with mode 600; never commit secrets or password-shaped database examples.
3. Use `deploy/aws/deploy.sh config` before `deploy/aws/deploy.sh up`. Keep Playwright/Celery concurrency conservative on micro instances. Treat the host as a canary, not high availability.
4. Back up PostgreSQL/Supabase as the system of record and treat Redis as recoverable queue/cache state. Verify restore into a disposable environment before launch. Do not create NAT Gateway, RDS, ElastiCache, or a load balancer merely to imitate production on a Free Tier experiment.

## ✅ Release Gates and Git Discipline

1. `bun run security:production` must pass with zero unresolved critical/high findings. Never update the baseline merely to make CI green; remediate with forward migrations or remove the affected feature from launch scope. The inherited gate started at 41 critical and 72 high database findings; after the forward-aware scanner and RLS/grant/policy migration, the current gate passes with zero unresolved critical/high findings.
2. Before a launch decision, run Python tests with CI secrets, Go tests, frontend lint/build/tests, migration checks against disposable PostgreSQL/Supabase, two-user ownership negatives through Go, queue-outage tests, handoff expiry/replay tests, browser cancellation tests, redacted-log checks, and backup/restore drills.
3. Stage only intended files. Inspect `git status`, `git diff --check`, staged names, test results, and remote state before pushing. If GitHub rejects a workflow push because the token lacks `workflows` permission, do not bypass the control or silently claim the workflow was pushed; push non-workflow files separately and record the limitation.

---

## 🏭 Remaining Production Items (from 2026-09-09 audit)

These items are documented in `PRODUCTION_HANDOFF.md`. Agents picking up work here should reference that file for full context, rationale, and effort estimates. Items are grouped by priority tier.

### Tier 1 — Must-do before production launch

*All Tier 1 tasks completed!*

### Tier 2 — Should-do for production quality

*All Tier 2 tasks completed!*

### Tier 3 — Nice-to-have improvements

*All Tier 3 tasks completed!*

### Done

| ID | Task | Completed Date | Files Modified | Verification |
|----|------|----------------|----------------|-------------|
| I3 | **Staging environment** — Staging deployment GitHub Actions workflow with lint/typecheck/docker gates | 2026-09-10 | `.github/workflows/deploy-staging.yml` | Workflow syntax verified, triggers on staging branch |
| I4 | **Log aggregation** — Loki & Promtail stack with docker socket scraping and nginx access parsing | 2026-09-10 | `deploy/promtail/config.yml`, `docker-compose.yml` | `docker compose config` passes clean |
| I5 | **Secrets vault integration** — HashiCorp Vault KV v2 secret provider with in-memory TTL caching and env fallback in Go | 2026-09-10 | `backend/go/internal/config/secrets.go`, `backend/go/internal/config/secrets_test.go` | Unit tests pass (8/8 in config) |
| FT2 | **Job watch notifications** — Schema migration, user notifications service, automated celery task triggers, Go routes, and notification bell UI | 2026-09-10 | `backend/db/migrations/20260910_02_notifications.sql`, `supabase/migrations/20260910_02_notifications.sql`, `backend/python/app/services/notifications.py`, `backend/python/app/tasks/automation.py`, `backend/go/internal/api/routes_notifications.go`, `src/components/layout/Header.tsx`, `src/components/notifications/NotificationsBell.tsx` | Go build clean, Python compile clean, tsc clean |
| FT5 | **Career intelligence frontend** — Interactive visualizations for skill gap radar, salary benchmark bar chart, and learning path milestones | 2026-09-10 | `src/pages/CareerIntelligence.tsx`, `src/App.tsx`, `src/config/features.ts` | Vite build & tsc pass clean with 0 errors |
| FT6 | **Interview experiences moderation** — Python moderation service, Go pending queue endpoints, and frontend moderation tab & actions | 2026-09-10 | `backend/python/app/services/moderation.py`, `backend/python/app/main.py`, `backend/go/internal/api/routes_social_moderation.go`, `backend/go/internal/api/routes_interview.go`, `src/pages/InterviewExperiences.tsx` | Go build clean, Python compile clean, tsc clean |
| E3 | **Anti-detection for extension** — Stealth evasion masking `navigator.webdriver`, plugins/languages emulation, and human typing jitter | 2026-09-10 | `extension/content.js`, `extension/tests/anti-detection.test.mjs` | `node --test extension/tests/*.test.mjs` passes (69/69 tests) |
| FT3 | **Browser automation expansion** — Enabled Lever and Ashby ATS domains in computer action policies with strict human review rules | 2026-09-10 | `backend/python/app/services/computer_action_policy.py`, `backend/python/tests/test_computer_action_policy.py` | Pytest passes (3/3 tests) |
| S3 | **Email verification** — Verify email and resend verification endpoints with secure token validation in Go gateway | 2026-09-10 | `backend/go/internal/auth/local.go`, `backend/go/internal/api/routes_app.go`, `backend/go/internal/api/routes_verify_email_test.go` | Go build & vet clean |
| F4 | **Bundle optimization** — Split `framer-motion` and `@dnd-kit` into separate cached vendor chunks | 2026-09-10 | `vite.config.ts` | Vite build clean (entry chunk 337kB, bundles built in 3.67s) |
| D6 | **Blue-green / canary deployment** — Zero-downtime rolling canary and blue-green updates with automated rollback on health failure | 2026-09-10 | `deploy/aws/deploy.sh` | `bash -n` syntax check clean |
| D4 | **Event-driven architecture** — Redis Streams publisher & consumer with consumer groups, maxlen=10000, graceful fallback, and wired flows | 2026-09-10 | `backend/python/app/services/event_bus.py`, `backend/python/app/tests/test_event_bus.py`, `backend/python/app/services/optimizer.py`, `backend/python/app/tasks/automation.py`, `backend/python/app/services/automation_engine.py` | `python3 -m py_compile` and pytest (10/10 tests) pass clean |
| D3 | **Load balancing for Python** — Nginx reverse proxy upstream load balancer (`python-lb`), least_conn algorithm, and Go config fallback | 2026-09-10 | `deploy/nginx/python-upstream.conf`, `docker-compose.yml`, `backend/go/internal/config/config.go`, `backend/go/internal/ai/client.go` | `docker compose config` and Go tests pass clean |
| F2 | **Extract large page components** — Decomposed `InterviewBoard.tsx` (2450L) into 11 subcomponents and `Settings.tsx` (1195L) into 7 tab subcomponents, with root re-exports | 2026-09-10 | `src/pages/InterviewBoard/` (11 files), `src/pages/InterviewBoard.tsx`, `src/pages/Settings/` (8 files), `src/pages/Settings.tsx`, `src/api/types.ts` | `npx tsc --noEmit`, `npm run typecheck`, `npm test`, `npm run build` all pass clean |
| P1 | **Pydantic Settings class** — Centralize Python config validation with BaseSettings, strict min_length=32 secret, and fail-safe defaults | 2026-09-10 | `backend/python/app/config.py`, `backend/python/requirements.txt`, `backend/python/app/main.py`, `backend/python/app/tests/conftest.py` | `python3 -m py_compile`, pytest unit tests pass clean |
| P2 | **Pydantic models for raw dict endpoints** — Strong schema typing for 10 endpoints taking raw dict payloads | 2026-09-10 | `backend/python/app/main.py`, `backend/python/app/tests/test_pydantic_settings_and_models.py` | `python3 -m py_compile`, pytest (3/3 unit & integration tests) pass clean |
| G1 | **Repository layer for Go** — Interface-based repositories for Resumes, CoverLetters, Applications with in-memory fakes & postgres implementation | 2026-09-10 | `backend/go/internal/repository/` (`repository.go`, `postgres.go`, `mock.go`, `repository_test.go`), `backend/go/internal/api/` (`router.go`, `resume_handlers.go`, `routes_cover_letters.go`, `routes_app.go`, `repository_handlers_test.go`) | `go build ./...`, `go vet ./...`, and `go test ./...` all pass clean |
| D2 | **Saga pattern for browser automation** — Linear forward execution with reverse compensating transactions for multi-step browser flows | 2026-09-10 | `backend/python/app/services/saga.py`, `backend/python/app/services/browser_worker_pool.py`, `backend/python/app/tests/test_saga.py` | `python -m py_compile` and pytest (9/9 unit & integration tests) pass clean |
| D1 | **OpenTelemetry distributed tracing** — Instrument Go gateway, Python AI engine, context propagation, and Jaeger | 2026-09-10 | `backend/go/internal/observability/tracing.go`, `backend/go/cmd/server/main.go`, `backend/go/internal/api/router.go`, `backend/go/internal/ai/client.go`, `backend/python/app/telemetry/tracing.py`, `backend/python/app/main.py`, `backend/python/requirements.txt`, `docker-compose.yml` | `go build ./...`, `python -m py_compile`, `docker compose config` all pass clean |
| F1 | **TypeScript strict: true** — Enabled strict, noImplicitAny, strictNullChecks across frontend and fixed all type errors | 2026-09-10 | `tsconfig.app.json`, `src/types/d3-force.d.ts`, `src/components/FeatureErrorBoundary.tsx`, `src/components/ResumeGraphViz.tsx`, `src/components/omnisave/OmniSaveBriefCard.tsx`, `src/hooks/use-extension.ts`, `src/pages/JobSearch.tsx`, `src/pages/AgentPanel.tsx`, `src/pages/AgentReachHub.tsx`, `src/pages/BlogPost.tsx`, `src/pages/CommunicationHub.tsx`, `src/pages/DesktopAgent.tsx`, `src/pages/ExtensionOnboarding.tsx`, `src/pages/ResumeGraph.tsx`, `src/pages/ResumeResults.tsx`, `src/pages/RouteInsights.tsx`, `src/pages/Settings.tsx` | `npx tsc --project tsconfig.app.json --noEmit` and `npm run typecheck` pass with 0 errors |
| E2 | **React form autofill compatibility** — Use `nativeInputValueSetter` and `nativeTextareaValueSetter` for React ATS forms | 2026-09-10 | `extension/content.js` | `content-autofill.test.mjs` passes, prototype setter called, bubbling events & visual feedback |
| E1 | **Extension test coverage** — Comprehensive test coverage (>50%) across autofill, scraping, auth, popup UI, manifest, and message policy | 2026-09-10 | `extension/tests/*.test.mjs` (6 new suites) | `node --test extension/tests/*.test.mjs` passes (68 tests, 0 failures) |
| S1 | **JWT entropy check** — Min 32 chars (128-bit) entropy validation in Go | 2026-09-10 | `backend/go/internal/config/config.go` | Unit tests pass, fatal in prod/staging |
| G2 | **`ConnMaxIdleTime`** — Added 5 min idle connection timeout to Go DB pool | 2026-09-10 | `backend/go/internal/database/database.go` | `go build` and `go test` pass |
| G3 | **Panic Sentry capture** — Custom recovery handler with `sentry.CaptureException` and flush | 2026-09-10 | `backend/go/internal/api/router.go` | `TestRecoverWithSentry` unit test passes |
| S2 | **CSRF protection** — Mutating HTTP methods validate `Origin` against allowed origins | 2026-09-10 | `backend/go/internal/api/router.go` | `TestCSRFCheck_DisallowedOrigin` passes (403 on invalid Origin) |
| FT1 | **Job search pagination** — Cursor-based pagination across job providers, smart search agent, FastAPI endpoint, and frontend UI | 2026-09-10 | `backend/python/app/services/job_providers.py`, `backend/python/app/services/job_agent.py`, `backend/python/app/main.py`, `src/api/jobs.ts`, `src/pages/JobSearch.tsx` | Unit tests pass, cursor navigation & load more UI verified |
| FT4 | **Cover letter persistence** — DB migration, RLS policies, Go CRUD endpoints, Python generator UUID/saving, and frontend save/list UI | 2026-09-10 | `backend/db/migrations/20260910_01_cover_letters.sql`, `supabase/migrations/20260910_01_cover_letters.sql`, `backend/go/internal/api/routes_cover_letters.go`, `src/api/coverLetters.ts`, `src/pages/CoverLetter.tsx` | Go tests pass (401/400/200), route parity passes, Python tests pass, tsc clean |
| P3 | **Global exception handler for FastAPI** — Centralized `@app.exception_handler(Exception)` with structured JSON and preserved 4xx handlers | 2026-09-10 | `backend/python/app/main.py`, `backend/python/app/tests/test_global_exception_handler.py` | Unit tests pass (404/403/422/500), py_compile clean |
| F3 | **Migrate Header menus to Radix DropdownMenu** — Replaced custom `role="menu"` with `@/components/ui/dropdown-menu` | 2026-09-10 | `src/components/layout/Header.tsx` | Radix keyboard nav (arrow keys/Escape/Enter) and unit tests pass, tsc clean |
| I1 / O1 | **Automated backup schedule** — GitHub Actions daily cron workflow running `scripts/backup-hosted.sh` | 2026-09-10 | `.github/workflows/backup.yml` | Workflow file syntax verified, cron scheduled at 02:00 UTC |
| I2 | **Off-host backup copy to S3** — Added S3 upload handling to `scripts/backup-hosted.sh` via `BACKUP_S3_BUCKET` | 2026-09-10 | `scripts/backup-hosted.sh` | `bash -n` clean, verified S3 upload branch and DATABASE_URL support |
| D5 / O2 | **Celery queue depth metrics** — Redis queue inspection, Prometheus text formatter, and `/metrics/prometheus` endpoints | 2026-09-10 | `backend/python/app/celery_app.py`, `backend/python/app/main.py`, `backend/python/app/middleware/` | Unit tests pass (5/5), Prometheus text format verified |
| O3 | **Celery worker concurrency & memory cap** — Concurrency capped at 4 (min CPU or 2, 4) and 512MB memory limit per child | 2026-09-10 | `backend/python/app/celery_app.py` | Unit tests pass, configuration values verified |

### Agent Instructions for These Tasks

When working on any item above:

1. **Read `PRODUCTION_HANDOFF.md` first** — it has the full context, why each item was deferred, and effort estimates.
2. **Read `CLAUDE.md`** — respect the architectural rules (service separation, route parity, manualChunks ban, etc.).
3. **Read `lessons.md`** — check if a related lesson exists before making changes.
4. **Follow change control** — see `tayari-change-control` skill for route parity, feature flags, and pre-merge checklist.
5. **Verify after changes** — run the relevant compilation/lint commands:
   - Go: `cd backend/go && go build ./... && go vet ./...`
   - Python: `python -c "import ast, sys; ast.parse(open(sys.argv[1]).read())" <file>` (or: `for f in $(git diff --name-only -- '*.py'); do python -c "import ast,sys; ast.parse(open(sys.argv[1]).read())" "$f"; done`)
   - Frontend: `npx tsc --noEmit`
   - Docker: `docker compose config`
6. **Update `lessons.md`** — append a dated entry for every completed task with root cause, fix, and reusable lesson.
7. **Update this file** — move completed items to a "Done" subsection with the date completed.
