# Browser Automation Isolation — Implementation Plan

**Status:** Design only — not yet implemented. This is the concrete engineering
plan for the milestone `MANUS_STYLE_OPEN_CORE_ARCHITECTURE.md` §7 already
scheduled for days 31–60 ("Isolated browser-worker proof of concept... tenant
isolation, cancellation, retry/idempotency, takeover"). It also extends
`tayari-computer-architecture.md` (trust boundaries, capability names,
provider abstraction) and `worker-topology.md` (the proven Celery/DB
cancellation pattern this plan reuses rather than reinvents).

**Trigger:** a 2026-09-12 request to separate browser/computer-use execution
from the API-serving process, "like Manus/Muse" — i.e., run the browser away
from the process that serves every other request, so a hung page, a memory
leak, or a crashed Chromium instance can never take the API down with it.

## 0. Correcting the premise before proposing a fix

The original framing (from an external architecture audit, and repeated in
the request that led to this doc) was that browser-automation session state
lives only in an in-memory dict with no durable, cross-process story — the
same failure class as `_autopilot_store` before this session's fixes. **That
premise is wrong for this codebase's actual cancellation and status paths**,
and the design below only makes sense once that's clear:

- **Cancellation is already durable and cross-process.** `cancel_run()`
  (`app/services/browser_automation/session.py:353`) always calls
  `run_control.request_cancellation()` — a DB write to `run_controls` — and
  `run_control.revoke_worker_task()` (a Celery broker revoke), *regardless*
  of whether the calling process holds the live session locally. The process
  actually running the browser loop polls this via `watch_durable_cancellation()`
  (started as a background task in `agent.py:520` and `:653` for every real
  run) and terminates its own session the moment the durable flag is set.
  This is the exact same DB-flag-plus-poll pattern `worker-topology.md`
  documents and tests for `autopilot.run_application_agent` — it was already
  extended to interactive browser sessions, not left out.
- **Status/control snapshots are already fully DB-backed.**
  `get_run_control_snapshot()` (`app/services/run_control.py:171`) reads
  `agent_runs` and `run_controls` directly; it never touches the in-memory
  `_SESSIONS` dict. A status poll can land on any replica and returns the
  correct answer.
- **What `_SESSIONS` (session.py:262) actually is:** a per-process cache of
  the *live resource handle* (CDP URL, live-view URL, the actual
  `BrowserSession` object) for whichever process is physically running that
  browser right now. This is correct to keep in-memory — a live CDP
  connection literally cannot exist anywhere else — as long as every
  cross-process-visible fact about the run (is it cancelled, what state is
  it in) lives in the database, which it already does.

So the real, remaining gap is narrower and different: **physical process
isolation**, not session durability. Playwright/browser-use for
`/api/v1/browser/automation*` currently runs inline inside the `python-ai`
container (per `backend/python/Dockerfile`'s own comment: "This image runs
the FastAPI process directly... all launch Playwright/Chromium inline
here") — the same container and event loop serving every other API request.
A wedged page, a Chromium OOM, or a `browser-use` bug can degrade or crash
the process serving resume analysis, job search, and everything else. The
Celery worker already runs Playwright in its own container
(`Dockerfile.worker`), so autopilot's saga-based flow is already isolated
from the API — this plan brings the interactive `/browser/automation*`
family to the same standard.

## 1. External validation

Three points from current research on how comparable "computer use" products
actually isolate execution, used to sanity-check the plan below rather than
invent an architecture from scratch:

- **Manus's core bet is a disposable, fully-isolated virtual computer per
  task** — a sandboxed VM with its own browser/terminal/filesystem,
  allocated per task and never shared across tasks, built on E2B's sandbox
  infrastructure.[^manus][^e2b] This is architecturally what
  `OpenSandboxProvider` (see §2) already implements for this codebase — the
  provider abstraction exists; it's simply not the default and isn't what
  the interactive endpoints currently instantiate for local development.
- **A single-VM-multi-session model with per-session isolation, plus a
  session-wide kill switch that rejects the agent's next tool call
  immediately**, is Anthropic's own documented pattern for Claude's computer
  use / Cowork.[^cowork] That's the same shape as this plan's Phase A: one
  `browser-worker` container serving many runs, each isolated at the
  browser-session level, with the kill switch this codebase already has.
- **Production browser-as-a-service platforms (Browserless, Steel.dev) front
  the browser with a REST API and treat the session as a durable,
  addressable resource**, choosing between sticky routing and a shared
  session store when scaling across nodes.[^browserless][^steel] This
  codebase's `run_control` DB table *is* that shared store; Phase A's Celery
  dispatch *is* that REST-API-shaped boundary (a task submission + status
  poll + explicit cancel, not a raw function call).

None of this says "rewrite everything" — it confirms the shape already
chosen (`BrowserProvider` abstraction, durable DB-backed control, an
explicit kill switch) is the right one, and that the missing piece is
literally just where the browser process lives.

## 2. Phase A — dedicated container, self-hosted, no new abstractions

Ship this without needing Kubernetes, ECS, or a managed browser provider.
Single node stays single node; this only isolates the *process*, not the
*host*.

**2.1 New Compose service, not a new codebase.** Add `browser-worker` to
`docker-compose.yml`, built from a new `Dockerfile.browser-worker` that is
`Dockerfile.worker` in every respect (same Playwright/Chromium install
layer, same non-root user) except its `CMD` starts a Celery worker bound to
a **separate queue** (`browser` instead of `tayari`), so browser-automation
tasks never compete with — or get starved by — the existing autopilot/
scheduling task load on `celery-worker`. This reuses 100% of the existing
image-build knowledge (per `CLAUDE.md`'s own Playwright-path gotcha) instead
of re-deriving it.

**2.2 Move execution, not the API contract.** `browser_agent_routes.py`'s
four endpoints keep their exact request/response shapes. Internally:

- `POST /api/v1/browser/automation` (non-streaming) dispatches a new Celery
  task (`browser.run_agent`, on the `browser` queue) instead of calling
  `run_browser_agent()` inline, and polls `agent_runs`/`run_controls` for
  the result the same way `autopilot.run_application_agent` already does.
  This is the exact `/api/v1/autopilot/run` → Celery-dispatch fix already
  shipped this session (`app/main.py`'s `autopilot_run`), applied to the
  browser endpoint.
- `POST /api/v1/browser/automation/cancel` needs **no change** — it already
  calls `request_cancellation()` + `revoke_worker_task()`, which work
  identically whether the task is running in `celery-worker` or
  `browser-worker`, because Celery revoke targets a task ID on the broker,
  not a specific container.
- `GET /api/v1/browser/automation/runs/{run_id}/control` needs **no
  change** — already DB-backed (§0).
- `POST /api/v1/browser/automation/stream` (SSE) is the one endpoint that
  needs new plumbing, because the browser loop that yields live per-step
  events now runs in a different process than the one holding the client's
  HTTP connection. Bridge it with the Redis Streams event bus this codebase
  already has and already hardened this session
  (`app/services/event_bus.py` — `publish_event`/`consume_events`, now with
  PEL reclaim): `browser-worker` publishes each step event to a per-run
  stream (`browser-events:{run_id}`) instead of yielding it directly;
  `python-ai`'s SSE handler subscribes to that stream and forwards events
  to the client as they arrive. This is a strict input-shape match for
  `event_bus.py`'s existing consumer-group API — no new transport, no new
  library.

**2.3 What does NOT move.** `form_filler.py` and `optimizer.py`'s
`scrape_jd_url` (also called out in the audit as inline-Playwright) stay
where they are for Phase A. They're short-lived, request-scoped scrapes
(parse one job posting, fill one form) rather than long-lived interactive
sessions with a live-view/kill-switch contract — moving them adds
coordination cost without the blast-radius benefit that matters most (a
wedged *interactive* session is the actual multi-minute risk; a failed
one-shot scrape already fails fast and returns an error). Revisit only if
profiling in staging shows they're a real contention source.

## 3. Phase B — pluggable path to true per-run sandboxes (already built, unused)

This is the part that requires no further design work, because it's already
implemented: `get_provider()` (`session.py:246`) selects a `BrowserProvider`
from `BROWSER_PROVIDER`, and **`OpenSandboxProvider` and `BrowserbaseProvider`
are real, working implementations today** — HTTPS-only, private-endpoint-
validated, full create/terminate lifecycle against an external control
plane. Moving from Phase A's self-hosted `browser-worker` container to
Manus/E2B-style ephemeral, fully-isolated per-run sandboxes is a
**configuration change** (`BROWSER_PROVIDER=opensandbox` or `browserbase`,
plus the relevant API credentials), not a rewrite. `tayari-computer-
architecture.md` already specifies the capability gates
(`workspace.isolated_computer`) and release evidence required before
flipping that switch in staging/production.

This answers the "commit to distributed or stay single-node" question
directly: **stay single-node (Phase A) until real load or a specific
tenant-isolation requirement demands it, then flip one environment variable
to Phase B** — the architecture doesn't force the choice today, because the
provider abstraction was already built to defer it.

## 4. Migration steps (in order)

1. `Dockerfile.browser-worker` (copy of `Dockerfile.worker`, different `CMD`
   queue argument `-Q browser`) + `browser-worker` service in
   `docker-compose.yml`, health-checked identically to `celery-worker`.
2. New Celery task `browser.run_agent` in a new `app/tasks/browser.py`,
   mirroring `autopilot.run_application_agent`'s shape: persist an
   `agent_runs` row at start (`run_type='browser_agent'`), call
   `run_browser_agent()` inside `asyncio.run()`, persist final status.
   Apply this session's `run_autopilot` fix (draining `_pending_flush_tasks`
   before returning) to any equivalent fire-and-forget writes here from the
   start, not as a follow-up bug.
3. Update `browser_automation_endpoint` to dispatch `browser.run_agent.delay(...)`
   and poll for completion (bounded by the existing
   `BROWSER_RUN_TIMEOUT_SECONDS`), matching `autopilot_run`'s pattern.
4. Add the `browser-events:{run_id}` publish call inside the browser-worker's
   step loop (`browser_automation/agent.py`) and the corresponding
   `consume_events` subscription in `browser_automation_stream_endpoint`.
5. Route Celery's task queue: add `task_routes` in `celery_app.py` so
   `browser.*` tasks land on the `browser` queue and nothing else does —
   this is what actually prevents browser load from starving
   `celery-worker`'s existing autopilot/scheduling tasks, not just having a
   separate container.
6. Leave `AUTONOMOUS_BROWSER`/`WORKSPACE_ISOLATED_COMPUTER` capability gates
   exactly where they are (`browser_agent_routes.py`) — this plan changes
   *where* the code runs, not the authorization model.

## 5. Verification (matching `worker-topology.md`'s evidence-gate style)

- **Blast radius**: with `browser-worker` intentionally OOM-killed mid-run
  (`docker kill -s SIGKILL`), `python-ai`'s health check and every non-
  browser API endpoint must stay green throughout.
- **Cancellation still works cross-container**: start a run, issue cancel
  from a *separate* `curl` process (simulating a different replica), assert
  the browser-worker's `watch_durable_cancellation` loop observes it and
  terminates within its existing 1s poll interval — this test already has a
  direct analog in `test_worker_idempotency.py::test_worker_cancellation_stops_work`.
  Recovering from `docker kill` on `browser-worker` should behave like any
  other Celery worker loss per `worker-topology.md`'s global guarantees
  (`task_acks_late` + `task_reject_on_worker_lost`) — no code path
  should assume anything about *which* worker survives.
- **SSE bridge**: a client connected to `python-ai`'s stream endpoint
  receives step events published by a run executing entirely inside
  `browser-worker`, with no direct network path between the two beyond
  Redis.
- **Two-tenant negative**: user A cannot cancel or stream user B's run
  through the new dispatch path — this is unchanged from the existing
  ownership checks in `cancel_run`/`get_run_control_snapshot`, but must be
  re-verified after the dispatch change, not assumed to carry over.
- **Queue isolation**: flood the `browser` queue with long-running fake
  tasks; confirm `celery-worker`'s autopilot/scheduling tasks on the
  `tayari` queue are unaffected (proves `task_routes` is actually doing its
  job, not just declared).

## References

Internal:
- [`MANUS_STYLE_OPEN_CORE_ARCHITECTURE.md`](./MANUS_STYLE_OPEN_CORE_ARCHITECTURE.md) — product ADR this plan implements §7's 31–60 day milestone for.
- [`tayari-computer-architecture.md`](../computer/tayari-computer-architecture.md) — trust boundaries and capability gates this plan does not change.
- [`worker-topology.md`](./worker-topology.md) — the proven Celery/DB cancellation and idempotency pattern this plan reuses.

External:

[^manus]: [Understanding Manus sandbox — your cloud computer](https://manus.im/blog/manus-sandbox)
[^e2b]: [How Manus Uses E2B to Provide Agents With Virtual Computers](https://e2b.dev/blog/how-manus-uses-e2b-to-provide-agents-with-virtual-computers)
[^cowork]: [Claude Cowork architecture overview — Anthropic Help Center](https://support.claude.com/en/articles/14479288-claude-cowork-architecture-overview)
[^browserless]: [Session Management for Scalable Browser Automation — Browserless](https://www.browserless.io/blog/session-management)
[^steel]: [Beginner's Guide to Steel.dev Browser Automation](https://steel.dev/blog/beginner-s-guide-to-steel)
