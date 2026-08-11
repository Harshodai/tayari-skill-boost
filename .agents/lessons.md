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
