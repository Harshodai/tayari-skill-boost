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


## 2026-08-15 — Forward-aware database security gate closure

The production security gate was reduced from 113 critical/high findings to zero unresolved critical/high findings without changing the security baseline to force green. The remediation used a forward migration, `supabase/migrations/20260815120000_harden_critical_public_tables.sql`, because older migration files cannot be safely rewritten after deployment. The migration enables and forces RLS, revokes `anon`/`authenticated` table access by default, grants only the required service or owner access, and keeps service-only tables inaccessible to direct clients.

The scanner was made forward-aware by collecting RLS and grant declarations across the complete migration history before evaluating earlier `CREATE TABLE` statements. It also strips SQL comments before parsing, which prevents prose such as `CREATE TABLE IF NOT EXISTS above` from becoming a finding. The final gate output was `No new security findings` with exit code 0. Two broad policies were remediated rather than baselined: blog posts now expose only published rows, and individual question-vote rows are no longer readable by every authenticated user; aggregate counts remain served by the backend.

Verification evidence for this pass: Python `698 passed, 4 skipped`; Go tests passed; frontend `33 test files, 100 tests passed`; lint passed with warnings only; frontend build passed; and `bun run security:production` passed. Production Supabase application and Railway deployment remain separate operational steps requiring authenticated operator access and post-migration two-user negative tests.

The scanner rule remains intentionally strict: a baseline is not launch approval, and service-only policies are accepted only when they are explicitly limited to `service_role`. Any future public table must ship with an owner or service access decision, RLS, grants, and a forward-aware migration test.

---

## 2026-09-01 — Dashboard wiring, self-hosted Apply Agent, credit-pack billing tab, subprocess security

### What was done

1. **Wired real dashboard data** (`src/hooks/useDashboardData.ts`): replaced all `if (USE_SELF_HOSTED) return []` stubs for `savedJobsQuery`, `roadmapQuery`, and `interviewsQuery` with real `apiFetch` calls to `/v1/jobs/saved`, `/v1/roadmap`, and `/v1/interview/sessions`. Added `creditsQuery` → `/v1/billing/credits` and `inboxQuery` → `/v1/conversations` so the dashboard always shows live data in both cloud and self-hosted modes.

2. **Dashboard credit + inbox widgets** (`src/pages/Dashboard.tsx`): added a Credit Balance card (live balance, lifetime used/purchased, link to `/pricing`) and a Communication Inbox summary card (total conversations, unread badge, link to `/communication`), both driven by data exported from the hook above.

3. **Self-hosted Apply Agent** (`src/lib/agent/applyAgent.ts` + `src/pages/ApplyAgent.tsx`): replaced all `supabase.functions.invoke("apply-agent")` and `supabase.from("agent_runs")` calls with `apiFetch` calls to the Go API Gateway (`/v1/ai/agent/career/apply`, `/v1/agent-runs`, `/v1/agent-runs/{id}`, `/v1/agent-runs/{id}/steps`, `/v1/agent-runs/{id}/transition`). Removed the `cloudOnlyUnavailable = USE_SELF_HOSTED` gate, the `BackendUnavailableBanner`, the disabled button state, and the cloud-only run-list message. The Apply Agent now works identically in self-hosted and cloud modes.

4. **Live Billing tab** (`src/pages/Settings.tsx`): extracted a `BillingTab` component that fetches `/v1/billing/credits` on mount, renders available / lifetime-purchased / lifetime-used credit counts, a zero-cost guarantee banner, a "Buy More Credits" CTA, and a full transaction ledger with type, description, reference ID, and date. Replaced the previous hardcoded "Free Plan $0/month" static mock entirely.

5. **Four security/correctness fixes** across `codeact_repl.py`, `agent_db.py`, and `Onboarding.tsx` — see lessons L-11 through L-18 below.

### Lessons

#### L-11 — `USE_SELF_HOSTED` guards that return empty arrays are invisible bugs

Returning `[]` when self-hosted is set makes an entire feature silently disappear. A developer testing on a self-hosted instance sees empty states and assumes they are correct. The right pattern is: **always attempt the real API call; only fall back gracefully when the call fails**. Stubs disguised as empty data are production bugs.

#### L-12 — `supabase.functions.invoke` calls inside a library file are hidden cloud dependencies

When a shared library (`applyAgent.ts`) calls `supabase.functions.invoke`, any page that imports it inherits an implicit cloud dependency — it silently breaks on self-hosted. Move all AI-side calls through the Go API Gateway (`apiFetch('/v1/...')`) so the same code path works in both environments. Gating the entire UI on `USE_SELF_HOSTED` is never the right answer once a real backend route exists.

#### L-13 — `return True` on a missing pool is a silent false-positive

An atomic CAS function that returns `True` when it has no database connection tells callers "the approval was recorded" when it was not. Downstream effects (removing pending cache entries, sending confirmation emails) then proceed on a lie. Any approval / transition function must `return False` (or raise) when it cannot reach storage — fail-closed, not fail-open.

#### L-14 — A single React error state should not serve two semantically different error kinds

Routing both validation errors (400/422) and unexpected errors (500, network) through the same state variable means the UI heading is always wrong for one of them. Separate states (`validationError`, `saveError`) cost one line to declare and produce unambiguous, correct headings for every error class. Reusing one state to mean "any error" is a silent UX bug.

#### L-15 — `os.setsid()` in `preexec_fn` conflicts with `asyncio` and must be replaced by `start_new_session=True`

`asyncio.create_subprocess_exec` with `preexec_fn=os.setsid` is not safe on all platforms: the pre-exec function runs in a forked child while the event loop is still alive in the parent, and this combination can deadlock or silently drop the session call. The asyncio-safe replacement is `start_new_session=True` passed directly to `create_subprocess_exec`. Reserve `preexec_fn` for resource-limit calls (`setrlimit`) that are async-safe.

#### L-16 — Subprocess resource limits must track the caller's timeout, not a compile-time constant

A `RLIMIT_CPU` of 30 seconds applied to a subprocess whose caller supplied `timeout=120.0` means the process gets killed by the OS after 30 CPU-seconds while the wall-clock timer still has 90 seconds left — producing a confusing, hard-to-diagnose failure. Always derive soft/hard CPU limits from the requested wall-clock timeout (`soft = timeout`, `hard = timeout + grace`).

#### L-17 — `os.killpg` must be guarded against hitting the parent's own process group

After `start_new_session=True`, the child is always in a different process group, so `killpg` is safe. But if session isolation ever fails silently, an unguarded `os.killpg(os.getpgid(proc.pid), SIGKILL)` would kill the parent process and all sibling workers. Always verify `os.getpgid(proc.pid) != os.getpgid(os.getpid())` before using `killpg`; fall back to `proc.kill()` if they match.

#### L-18 — Synthesize fallback diagnostic when subprocess exits with signal and empty stderr

When a subprocess is killed by `RLIMIT_CPU` or the OOM killer, `proc.returncode` is `-9` (or another signal code) and `stderr` is empty. If `error` is set to `stderr_str` directly, callers receive `error: ""` — indistinguishable from success. Always synthesize a fallback diagnostic (`"ProcessError: exited with code N (possibly terminated by signal or OS resource limit)"`) when `returncode != 0 and stderr.strip() == ""`.

#### L-19 — Guard against missing-hash bypass in approval workflows

When validating proposal hashes, checking `if expected_hash and stored_hash and expected_hash != stored_hash:` allows an unhashed stored proposal to bypass hash verification because `stored_hash` evaluates to falsy. Always validate that `expected_hash` requires a matching `stored_hash` (`if expected_hash and (not stored_hash or expected_hash != stored_hash)`).

#### L-20 — HITL proposal issuance must fail-closed on persistence failure

Issuing an approval token or pending proposal before verifying durable storage write leaves phantom pending approvals in memory that cannot be confirmed across replica restarts or database reconnects. Always check persistence result and fail closed (e.g. 503) if storage write fails.

#### L-21 — Subprocess sandbox must apply address-space limits (RLIMIT_AS) and log setrlimit failures

CPU limits alone do not prevent runaway memory growth or memory-exhaustion attacks against sibling services. Apply `RLIMIT_AS` (e.g. 512 MiB) and log any `setrlimit` failures to stderr rather than silently swallowing them in a catch-all block.

#### L-22 — Queries must distinguish unavailable service (null) from legitimate zero values (0)

Returning `{ balance: 0 }` on a failed billing query causes the UI to display a verified zero balance and prompt the user to buy credits, obscuring a backend outage. Returning `null` allows the UI to render an explicit "Balance unavailable" state.

#### L-23 — Empty states in dashboards and run histories must separate error states from true empty sets

Using `runs.length === 0` to render "No runs yet" when `isError` is true hides query failures behind an innocent empty state. Always check `isError` first to render an error alert with a retry CTA.

### Verification evidence

- `npx tsc --noEmit`: exit 0
- `npm test -- --run`: 52 test files, **208 tests passed**
- `bash scripts/production_promotion_gate.sh`: **66/66 checks passed**, 0 unresolved critical/high
- `cd backend/python && PYTHONPATH=. .venv/bin/pytest tests/ -q` (JWT-secret tests excluded from sandbox): **518 passed, 2 skipped**
- Commits: `69be27f`, `84dadcb`, `1c18dee`, `7cc616b`
- Remote status: ahead of origin/main (unpushed)
- Unverified infrastructure checks: None
- Unrelated changes intentionally left out: None
