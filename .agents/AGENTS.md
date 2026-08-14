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

1. `bun run security:production` must pass with zero unresolved critical/high findings. Never update the baseline merely to make CI green; remediate with forward migrations or remove the affected feature from launch scope. The current scan has 41 critical and 72 high database findings.
2. Before a launch decision, run Python tests with CI secrets, Go tests, frontend lint/build/tests, migration checks against disposable PostgreSQL/Supabase, two-user ownership negatives through Go, queue-outage tests, handoff expiry/replay tests, browser cancellation tests, redacted-log checks, and backup/restore drills.
3. Stage only intended files. Inspect `git status`, `git diff --check`, staged names, test results, and remote state before pushing. If GitHub rejects a workflow push because the token lacks `workflows` permission, do not bypass the control or silently claim the workflow was pushed; push non-workflow files separately and record the limitation.
