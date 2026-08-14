# 📚 Lessons Learned & Code Review Guidelines

This document tracks technical learnings, user feedback, code review guidelines, and architectural rules to continuously improve code quality across the `tayari-skill-boost` codebase.

---

## 🛑 Production Readiness & Code Quality Rules

### 1. No Static Hardcoded Fallbacks or Payloads
- **Rule**: NEVER hardcode static dummy text (e.g., `'Senior Software Engineer with 6 years experience...'`, `'TechCorp Innovations'`, `'https://boards.greenhouse.io/...'`) inside React components or API payloads.
- **Rationale**: Hardcoded strings make components unviable for production and obscure integration bugs.
- **Action**: Always fetch candidate details dynamically from `AuthContext` (`user`) and `getProfile()` (`/v1/profile`). Provide clean, empty initial state values with interactive `<Input>` and `<Textarea>` controls.

### 2. Mandatory Usage of Central `apiFetch`
- **Rule**: NEVER use raw `fetch('/api/v1/...')` calls inside frontend components.
- **Rationale**: Direct `fetch` ignores environment configuration (`VITE_API_URL`, `VITE_USE_SELF_HOSTED`), omits `Authorization: Bearer <token>` headers, and bypasses global `401 Unauthorized` token clearance / event dispatching.
- **Action**: Always import and use `apiFetch<T>('/v1/...')` from `@/api`.

### 3. Explicit Error Banners & User Feedback
- **Rule**: Non-2xx API errors must never be swallowed silently or logged only to `console.error`.
- **Action**: Render visible, styled error banners (e.g. using `AlertCircle`) in the UI whenever an operation fails.

### 4. Concurrency & Async Lock Hygiene
- **Rule**: Avoid binding `asyncio.Lock()` instances at class declaration or module import time in Python services.
- **Rationale**: Top-level locks bind to a single event loop and raise `RuntimeError: Lock is bound to a different event loop` when invoked across concurrent pytest runs or worker loops.
- **Action**: Use lazy per-event-loop lock getters (`_get_repl_lock()`).

### 5. Transparent & Ethical AI Output Generation
- **Rule**: Do not inject hidden or stealth payload text (such as white text or hidden HTML comments) into candidate resumes or application packages.
- **Action**: Provide clear, transparent skill vector recommendations and ATS keyword additions.

---

## 🔄 Iterative Review Process
Whenever a code review finding or architectural flaw is identified during pair programming:
1. Fix the underlying issue completely without patching symptoms.
2. Verify with automated test suites (`pytest`, `npx tsc`, `npm run build`).
3. Record the guideline in this `lessons.md` file so future agent executions do not repeat the mistake.

## 2026-08-11 — WS-06 isolation + kill switch, WS-09 route analytics, WS-10 boomerang

**What was done**
- Added `backend/python/app/services/browser_automation/session.py`: a `BrowserProvider`
  interface (`local` Playwright, `browserbase` remote) selected by `BROWSER_PROVIDER`,
  a per-run session registry, and `cancel_run()` that terminates the remote session.
- Wired `run_browser_agent` / `stream_browser_agent` to open one session per `run_id`,
  poll cancellation between steps (`RunCancelled`), and always close the session.
- New `POST /api/v1/browser/automation/cancel` (FastAPI) + Go proxy (both `/api` and
  `/api/v1` for route parity). The UI "Stop run" button now calls it, not just `abort()`.
- Renamed `sandbox_executor.py` → `form_filler.py` (`TayariComputerSandboxExecutor` →
  `FormFiller`) with a deprecation shim; it was never a sandbox.
- WS-09: `route_views` table + `RouteAnalytics` mounted in the router, so dead routes can
  be deleted with evidence.
- WS-10: `BoomerangCard` on `/outcomes` — offer-holders switch to passive monitoring and
  it really flips `saved_searches.alert_enabled`.
- Security: profiles + saved_searches policies re-scoped from `public` to `authenticated`.

**Root cause of the gap**
"Stop" was a client-side `AbortController` only. Closing the SSE reader never touched the
browser, so a cancelled run kept driving a real page — the worst possible failure mode for
an agent that fills out forms.

**Lesson**
A cancel button is only real if it terminates the resource on the far side of the network.
Client-side abort is a UI affordance, not a kill switch — always pair it with a
server-side terminate call and a cancellation flag the work loop polls.

**Still open**
WS-08 (delete orphan pipelines) is NOT done and should not be blindly executed: the plan
calls `end_to_end_pipeline.py`, `autopilot_graph.py` and `resume_parser.py` orphans, but
all three are still imported (adaptations_routes, omnisave_service, automation_engine) and
covered by tests. The merge-then-delete needs its own pass.


## 2026-08-15 — Ruthless launch recheck, AWS canary, and release discipline

### What was found

The second-pass review showed that an apparently green implementation was not end-to-end complete. Sensitive answer defaults, synthetic identities, ownerless Hermes reads, a broken answer-bank contract, fabricated UI fallback outputs, incomplete queue durability, schema/runtime drift, and self-attested submission status all required separate verification. The first full test pass also missed a stale contract test and a timing-sensitive long-context test until the suite was rerun from the current tree.

### Root causes

The recurring root causes were contract drift between database migrations and runtime SQL, security controls implemented in only one layer, frontend readiness labels that did not consume backend truth, local in-memory assumptions in a durable workflow, and release checks that treated baselined security debt as acceptable. A deployment workflow was also committed without checking that the GitHub App token had `workflows` permission; the remote accepted normal files but rejected the workflow file.

### Fixes applied

Owner-scoped Hermes helpers, verified gateway identity forwarding, fail-closed answer-bank matching, persistent versioned answer storage, durable HITL state transitions, expiring owner-bound handoff tokens, queue outage errors, normalized question keys and provenance, default-off server-side autonomous submission, truthful one-shot output, explicit externally-unverified submission status, AWS EC2 canary files, budget/backup scripts, Caddy private-network routing, and AWS runbook documentation were added across the implementation and deployment package. The repository also gained `CLAUDE.md` and this addendum so the constraints are visible before future changes.

### Reusable rules

1. A sensitive value is unresolved until the current authenticated user explicitly confirms it for the current application. Never convert a stored profile answer into an automatic legal or compensation decision.
2. A user ID in a request body is data, not identity. Only verified auth context plus an owner predicate is authoritative.
3. A queue that returns zero rows during a database outage is unsafe. Storage failure must be distinguishable from an empty queue and must pause the run.
4. A status named `submitted` is not proof of an external submission. Store verification state separately and require portal evidence for `verified`.
5. Every migration must be checked against every runtime query, and every ownership policy must be exercised by at least two different users through the real gateway/Data API path.
6. Security baselines are not launch approval. `bun run security:production` must block unresolved critical/high findings; never update the baseline only to make CI green.
7. A single EC2 Docker Compose host is a canary, not HA. Keep Python/Redis private, use Caddy as the only public edge, restrict SSH, use SSM, create budgets, back up the database system of record, and treat Redis as recoverable queue state.
8. AWS Free Tier and credits are account/region/plan dependent. Give the operator a cost cap and cleanup instructions before provisioning any resource.
9. A GitHub workflow file is a privileged release artifact. Confirm the token has workflow write permission before pushing. If remote permission rejects it, report the exact limitation and do not claim it was published.
10. Every task completion must include the exact test commands, pass/fail counts, unverified infrastructure checks, commit hash, remote status, and a list of unrelated changes deliberately left out.

### Release status at capture time

Python tests passed at 695 with 4 skipped; Go tests passed; frontend lint/build/tests passed with 100 frontend tests; AWS shell scripts passed syntax checks. The production security gate still reported 41 critical and 72 high database findings, so the product was not launch-ready. The non-workflow AWS deployment package was pushed in `895800f`; the GitHub Actions workflow was committed locally in `4086a0d` but remained unpushed because the available GitHub App token lacked workflow permission. This distinction must be preserved in future status reports.


**Implementation-level reminder:** `AUTONOMOUS_SUBMIT_ENABLED` must be explicitly set to `false` in canary/production environments and checked by the server-side submission guard. A prose-only “manual submit” promise is insufficient.

**Database security reminder:** every user-owned public table needs verified PostgreSQL RLS policies, least-privilege grants, and two-user negative tests; a security baseline is not launch approval.
