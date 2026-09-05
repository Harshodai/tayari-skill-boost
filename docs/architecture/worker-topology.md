# Tayari Worker Topology — AUTO-001

> **Purpose**: This document proves every background worker/task is
> single-dispatch, idempotent, bounded, and recoverable. It serves as
> evidence for AUTO-001 (§15.8).
>
> **Last updated**: 2026-08-25

---

## Global Celery runtime guarantees

| Setting                      | Value | Effect                                         |
|------------------------------|-------|------------------------------------------------|
| `task_acks_late`             | True  | Message NOT acked until task returns → redeliverable after worker crash |
| `task_reject_on_worker_lost` | True  | Rejected (not acked) if worker dies mid-task   |
| `worker_prefetch_multiplier` | 1     | Worker holds at most one message at a time      |
| `task_track_started`         | True  | Broker knows task is started before ack         |
| `task_time_limit`            | 900 s | Hard kill after 15 min                          |
| `task_soft_time_limit`       | 720 s | Soft kill (SoftTimeLimitExceeded) at 12 min    |
| `result_expires`             | 86400 s | Result TTL = 24 h                             |
| Queue                        | `tayari` | Single durable queue                        |

These settings collectively implement at-least-once delivery with bounded
re-queue on crash, single-prefetch to prevent starvation, and a hard
time-bound on every task.

---

## Beat schedule summary

| Beat entry                           | Task name                                      | Interval |
|--------------------------------------|------------------------------------------------|----------|
| `preference-learning-daily`          | `learning.run_preference_learning_all`         | 24 h     |
| `standing-job-watches-hourly`        | `autopilot.run_standing_job_watches`           | 1 h      |
| `nightly-db-backup`                  | `system.nightly_database_backup`               | 24 h     |
| `delivery-ledger-dispatch`           | `delivery.dispatch_pending_messages`           | 30 s     |
| `automation-scheduled-event-emission`| `automation.emit_scheduled_events`             | 15 s     |
| `automation-event-dispatch`          | `automation.dispatch_events`                   | 15 s     |
| `automation-checkpoint-dispatch`     | `automation.dispatch_checkpoints`              | 15 s     |
| `task-control-dispatch`              | `task_control.dispatch_checkpoints`            | 15 s     |

---

## Per-task topology

### 1. `hermes.scrape_job_board`
- **Module**: `app/tasks/scraping.py`
- **Trigger**: API call (explicit enqueue)
- **Idempotency**: Each invocation generates a new `run_id` (UUID). DB
  persistence is via `create_agent_run` which is best-effort; duplicate Celery
  delivery replays the scrape but produces a new distinct `run_id` row — no
  double-write into a shared slot.
  **GAP**: No deduplication key prevents a double scrape if the caller
  enqueues the same query twice. Mitigation: callers are responsible for
  dedup at enqueue-time; the task is read-only toward the job board.
- **Retry**: None (no `autoretry_for`). Failed runs are reflected in status.
- **Dead-letter**: Worker crash → message requeued (`task_acks_late`).
- **Cancellation**: Not applicable (stateless; no long-running external effect).
- **External side effects**: Scrapes external job boards (read-only). No email,
  ATS submission, or browser action.
- **Max duration**: 900 s hard limit (global Celery config).

---

### 2. `autopilot.run_application_agent`
- **Module**: `app/tasks/automation.py`
- **Trigger**: Enqueued by `run_scheduled` or `run_scheduled_autopilot`.
- **Idempotency**: `run_id` is a caller-generated UUID. `create_agent_run`
  inserts the DB row at start. If the same task is replayed (at-least-once
  delivery), `_persist_start` will attempt a second insert which will conflict
  on the `run_id` PK — the insert is guarded and the task proceeds;
  `run_autopilot` is idempotent w.r.t. the in-memory `_autopilot_store`
  (keyed by `run_id`).
  **GAP**: `create_agent_run` does not use `ON CONFLICT DO NOTHING` by
  default — if two replays race, a DB error may be swallowed silently. The
  task will still execute (DB persistence is best-effort).
- **Retry**: None explicitly. Worker crash re-queues via `task_acks_late`.
- **Dead-letter**: Message re-queued on crash; status remains `failed` in DB
  after final failure.
- **Cancellation**: `run_control.request_cancellation()` sets a durable DB flag.
  `run_control.revoke_worker_task()` issues `celery_app.control.revoke(task_id,
  terminate=True, signal=SIGTERM)`. Idempotent: revoke on an already-dead task
  is a no-op at the broker.
- **External side effects**: Runs `run_autopilot` which prepares applications
  (LLM drafts). `auto_apply=False` is enforced at this level — no ATS
  submission without explicit human approval.
- **Max duration**: 900 s hard limit.

---

### 3. `autopilot.run_scheduled`
- **Module**: `app/tasks/automation.py`
- **Trigger**: Beat schedule via `run_standing_job_watches`, or direct enqueue.
- **Idempotency**: Generates a new `run_id` per dispatch. Downstream task
  is `run_application_agent` — see above.
- **Retry**: None.
- **External side effects**: None directly — enqueues `run_application_agent`.
- **Max duration**: 900 s hard limit.

---

### 4. `autopilot.run_scheduled_autopilot`
- **Module**: `app/tasks/automation.py`
- **Trigger**: Python scheduler via `_trigger_scheduled_run`.
- **Idempotency**: Same as `run_scheduled`. `auto_apply=False` enforced.
- **Retry**: None.
- **External side effects**: None directly.
- **Max duration**: 900 s hard limit.

---

### 5. `autopilot.run_standing_job_watches`
- **Module**: `app/tasks/automation.py`
- **Trigger**: Beat — every 1 h.
- **Idempotency**: Reads active `job_watches` and fans out one
  `run_scheduled.delay()` per watch. Duplicate invocations from beat restart
  could trigger double-fans for the same hour. **GAP**: No per-watch
  deduplication key (e.g., last_triggered_at check) prevents a second beat
  run from dispatching a second run for the same watch within the same window.
- **Retry**: None.
- **External side effects**: None directly (fan-out only).
- **Max duration**: 900 s hard limit.

---

### 6. `agentspace.run_agent_task`
- **Module**: `app/tasks/automation.py`
- **Trigger**: Explicit API enqueue.
- **Idempotency**: `task_id` is API-caller-supplied. DB writes use
  `update_agent_task_status` and `create_agent_task_attempt`. Replay would
  create a second attempt row — idempotent at agent output level only (no
  external action; `submission_permitted=False` always).
- **Retry**: None.
- **External side effects**: None — always returns `draft_ready` with
  `submission_permitted=False`. Guarded comment in code.
- **Max duration**: 900 s hard limit.

---

### 7. `system.nightly_database_backup`
- **Module**: `app/tasks/automation.py`
- **Trigger**: Beat — every 24 h.
- **Idempotency**: Runs `backup.sh`; backup scripts are typically idempotent
  (timestamped output files). Re-run creates a duplicate backup file — harmless.
- **Retry**: None.
- **External side effects**: Writes backup to local filesystem/S3.
- **Max duration**: 900 s hard limit (script has its own 300 s subprocess timeout).

---

### 8. `delivery.dispatch_pending_messages`
- **Module**: `app/tasks/delivery.py`
- **Trigger**: Beat — every 30 s.
- **Idempotency**: `dispatch_once()` uses a durable ledger with atomic claim
  (`SELECT ... FOR UPDATE SKIP LOCKED`). A replayed dispatch tick skips already-
  claimed messages. `autoretry_for=(Exception,)` with `max_retries=3` and
  `retry_backoff=True` — bounded.
- **Dead-letter**: After 3 retries, raises to Celery as failed; `sending`
  records in the ledger are left for operational reconciliation.
- **Cancellation**: Not applicable (stateless tick).
- **External side effects**: Sends Telegram/WhatsApp notifications
  (candidate-opted-in only). Each message is claimed atomically — duplicate
  delivery to provider prevented by ledger claim.
- **Max duration**: 900 s hard limit. Drains at most 25 messages per tick.

---

### 9. `automation.emit_scheduled_events`
- **Module**: `app/tasks/automation_events.py`
- **Trigger**: Beat — every 15 s.
- **Idempotency**: `emit_scheduled_events()` runs inside a DB transaction. The
  events table uses `ON CONFLICT ... DO NOTHING` (deduplication key).
  Duplicate beat invocations emit 0 new events (no side effects).
- **Capability gate**: Returns `disabled_by_launch_scope` when
  `WORKSPACE_AUTOMATIONS` capability is off.
- **External side effects**: None — writes to DB only.
- **Max duration**: 900 s hard limit.

---

### 10. `automation.dispatch_events`
- **Module**: `app/tasks/automation_events.py`
- **Trigger**: Beat — every 15 s.
- **Idempotency**: `dispatch_due_events()` uses `FOR UPDATE SKIP LOCKED` claim.
  Replayed ticks skip already-dispatched events.
- **Capability gate**: `WORKSPACE_AUTOMATIONS`.
- **External side effects**: Routes events to automation definitions (state
  machine advance). No external network calls at this layer.
- **Max duration**: 900 s hard limit.

---

### 11. `automation.dispatch_checkpoints`
- **Module**: `app/tasks/agent_automation.py`
- **Trigger**: Beat — every 15 s.
- **Idempotency**: `_claim_runs` uses `FOR UPDATE SKIP LOCKED`. Each run is
  claimed to exactly one worker. Lease expiry allows reclaim (`_reclaim_expired_runs`).
  `_create_plan_boundary` uses `ON CONFLICT (run_id, sequence_no) DO NOTHING` on
  `automation_steps` and a `WHERE NOT EXISTS` guard on `approval_requests` — a
  replayed worker cannot create duplicate approval boundaries.
- **Capability gate**: `WORKSPACE_AUTOMATIONS`.
- **External side effects**: None — produces plan_review approval requests only.
  No external network calls, no browser, no ATS.
- **Max duration**: 900 s hard limit; LEASE_SECONDS=90 for run leases.

---

### 12. `task_control.dispatch_checkpoints`
- **Module**: `app/tasks/task_control.py`
- **Trigger**: Beat — every 15 s.
- **Idempotency**: `_claim_tasks` uses `FOR UPDATE SKIP LOCKED` with version
  check. `_execute_one` verifies `lease_owner` before writing result. If worker
  dies and lease expires, another worker reclaims. `INSERT INTO task_artifacts`
  is idempotent-by-intent (new artifact per completion); the result commit
  checks `lease_owner` before update — orphaned workers cannot corrupt results.
- **Cancellation**: Lease expiry + status check (`AND status='running' AND
  lease_owner=$3`) prevents cancelled tasks from being completed.
- **External side effects**: LLM draft call (read-only from candidate's POV —
  draft stored in DB, requires human review). No browser, email, or ATS.
- **Max duration**: 900 s hard limit; LEASE_SECONDS=900 for task leases.

---

### 13. `external_research.run_apify`
- **Module**: `app/tasks/external_research.py`
- **Trigger**: Explicit API enqueue.
- **Idempotency**: `claim_external_research_run()` uses a lease-based claim.
  Provenance creation uses `idempotency_key=f"external-research-run:{job_id}"` —
  the provenance service deduplicates on this key. Replay after crash reclaims
  the same `job_id` but provenance write is idempotent.
- **Heartbeat**: Background task sends 30-second heartbeats to extend lease.
- **Retry**: None (`autoretry_for` not set). Worker crash re-queues.
- **External side effects**: Calls Apify API (external network). Result is
  read-only (no ATS submission, no browser).
- **Max duration**: 900 s hard limit.

---

### 14. `learning.run_preference_learning_all` / `learning.run_preference_learning_task`
- **Module**: `app/tasks/learning.py`
- **Trigger**: Beat — every 24 h (fan-out); sub-tasks triggered by fan-out.
- **Idempotency**: Per-user preference learning is a DB upsert (overwrite of
  preference profile). Replays overwrite with same data — idempotent.
- **Retry**: None.
- **External side effects**: None (DB reads + writes only).
- **Max duration**: 900 s hard limit.

---

## Known gaps (idempotency not guaranteed)

| Gap ID | Worker                               | Issue                                                              | Severity |
|--------|--------------------------------------|--------------------------------------------------------------------|----------|
| G-1    | `hermes.scrape_job_board`            | No dedup key prevents double scrape if caller enqueues twice       | Low (read-only) |
| G-2    | `autopilot.run_standing_job_watches` | Beat restart can trigger duplicate fan-out for same watch in same hour | Medium  |
| G-3    | `autopilot.run_application_agent`    | `create_agent_run` lacks `ON CONFLICT DO NOTHING` — replay may swallow DB conflict silently | Low (best-effort persistence) |

---

## Cancellation mechanism summary

| Mechanism                      | Layer          | Effect                                                            |
|-------------------------------|----------------|-------------------------------------------------------------------|
| `run_control.request_cancellation()` | DB (`run_controls` table) | Sets `cancellation_requested_at`; survives worker replacement |
| `run_control.revoke_worker_task()`   | Celery broker  | `celery_app.control.revoke(task_id, terminate=True, signal=SIGTERM)` |
| `cancellation_requested()` check    | Worker poll    | Worker reads flag during long-running steps to self-terminate |
| `task_runs` `lease_owner` check     | DB transaction | `task_control` worker cannot complete a task after lease expires |

---

## Test coverage

| Test                                     | File                                       | What it proves                                          |
|------------------------------------------|--------------------------------------------|---------------------------------------------------------|
| `test_worker_lost_tasks_are_requeued_before_acknowledgement` | `test_celery_production_contract.py` | `task_acks_late` + `task_reject_on_worker_lost` set |
| `test_delivery_dispatch_has_bounded_automatic_retries`       | `test_celery_production_contract.py` | Retry is bounded (max=3) and uses backoff            |
| `test_required_beat_schedule_is_complete_and_valid`          | `test_celery_production_contract.py` | All required beat entries registered                 |
| `test_worker_duplicate_task_idempotent`  | `test_worker_idempotency.py`               | Same run_id submitted twice → second is no-op        |
| `test_worker_cancellation_stops_work`    | `test_worker_idempotency.py`               | Cancel signal propagates; revoke called once         |
| `test_worker_no_external_effect_when_capability_disabled` | `test_worker_idempotency.py`    | `WORKSPACE_AUTOMATIONS=false` → no dispatch          |
