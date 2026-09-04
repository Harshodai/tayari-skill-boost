# Own Computer VM Feasibility Spike (docs only, no build)

Facts verified 2026-09-04. No production code changed. Consumes `docs/superpowers/specs/2026-09-04-own-computer-design.md` Tasks 1-2.

## 1. Isolation: disposable run with 5s kill

Current (verified 2026-09-04):

- `BrowserWorker` owns one Playwright browser per run. `owns_browser=True` default. `browser_worker_pool.py:178-209`.
- Kill switch exists: `KILL_SWITCH_TIMEOUT_SECONDS=5.0` (`browser_worker_pool.py:51`). `terminate_worker(run_id, owner_id)` closes in 5s bound (`:751-771`). Owner-checked, raises `PermissionError` on cross-user kill.
- Pause deadline exists: 1800s HITL wait then forced `close(reason=cancelled)` (`:717-740`).

Options:

| Option | Isolation | Kill | Cost | Verdict |
|---|---|---|---|---|
| A. Playwright browser context per run (current) | Process + context. Shared host kernel, net, disk. | Works now. 5s bound proven. | Zero new infra. One Chromium ~300-500MB. | Use now. |
| B. Docker container per run | PID/mount/net namespace. Stronger than context. | `docker stop -t 5`. 5s holds. Needs Docker socket from Python. New privileged path. | +300MB image pull, +1-2s start, breaks `t3.micro` concurrency. | Defer. |
| C. Firecracker microVM per run | Kernel boundary. Strongest. | `SIGKILL` VM, 5s holds. | Needs KVM host, custom kernel/rootfs, snapshot plumbing. Canary `t3.micro` cannot host it. | Reject for canary. |

Recommendation: keep A. Reuse `BrowserWorker` lifecycle. No new runtime. VM work starts only after multi-board hardening ships and canary moves off `t3.micro`.

VM gate stays same shape: `create_worker` validates ATS URL first (`:668`), `terminate_worker` keeps 5s bound. Container/VM later wraps `create_worker`/`terminate_worker`, never replaces policy.

## 2. HITL: submit/password/OTP/CAPTCHA/salary/sponsorship/EEO always pause

Current gates (verified 2026-09-04):

- `AUTONOMOUS_SUBMIT_ENABLED=false` server-enforced. Checked in `submission_guard.py:77`. Default false. Never bypassed.
- `ComputerActionPolicy` gate in `computer_action_policy.py:23-53`: `SUBMISSION` always raises `ComputerActionRejected`. `SENSITIVE` needs `human_confirmed=True`. Checked against signed grant via `computer_grant_security.py` (`tayari:computer:grant:<nonce>`, NX, TTL).
- `action_allowed` in `computer_control.py:182-185`: allowlist is READ + NAVIGATION + CANDIDATE_INPUT only. Submission not in default tuple.
- Sensitive scan in worker: `scan_for_sensitive_fields` (`browser_worker_pool.py:238`) + `detect_sensitive_field`. Match pauses run, emits `pause_required`, calls `route_to_human_handoff` (`:554-566`).
- `route_to_human_handoff` in `origin_guard.py:208-255`: builds question payload, calls `enqueue_questions` with owner `user_id` + `run_id`, returns `human_handoff_enqueued`. Fail-closed on enqueue error (logs, run stays paused).
- Credential regex covers password, login, 2fa/mfa/otp, verification code, authenticator, ssn/national-id, secret question, captcha/recaptcha/turnstile (`origin_guard.py:52-64`).

VM reuse, no new gate:

- VM action gate calls same `gate_computer_action(action, grant, human_confirmed)` before any VM input injection. VM clipboard/keystroke path adds no bypass.
- Salary/sponsorship/EEO pause via same `route_to_human_handoff`: field label in {salary, compensation, sponsorship, visa, work-authorization, EEO, race, gender, disability, veteran} maps to `sensitivity_class` in `question_queue`, never auto-answered. Stored answers need version + provenance + expiry, never silent autofill across applications.
- Origin rule unchanged: `assert_origin_for_credential_entry` blocks credential fill off start origin (`origin_guard.py:182-205`).

## 3. Cost: memory ceiling, Redis/Postgres split

Canary contract (verified 2026-09-04, `deploy/aws/README.md:5-15`, `provision.sh:12`, `ec2-canary.yaml:15-16`):

- Host is `t3.micro` or `t4g.micro`. 1GB RAM. No HA. Chromium + Celery already compete for memory.
- Rule: one concurrent browser session max on micro. More sessions need larger instance or separate worker host. Never silently overload micro.
- No NAT Gateway, ALB, ElastiCache, RDS for canary.

Split:

- Redis is queue/cache only. Hot replay key `tayari:computer:<run>:events`, cap 500, TTL 86400 (`computer_replay.py:6-8`). Best-effort, fail-open, worker never blocks on Redis (`:24`, `:60`).
- Postgres/Supabase is system of record. Durable rows in `public.action_ledger` via `application_lifecycle.py:357-370`. Idempotent upsert on `(user_id, run_id, action)`.
- VM images break this budget. One Chromium already ~300-500MB. Docker-per-run adds pull + overlay. Firecracker needs KVM + separate host. Keep concurrency at 1 on canary. VM work needs bigger host first.

## 4. Audit: full session replay retention

Current (verified 2026-09-04):

- Hot: Redis list `tayari:computer:<run>:events`. `append_computer_event` RPUSH + LTRIM 500 + EXPIRE 86400 (`computer_replay.py:13-25`). `replay_computer_events(run_id, after, limit)` filters `step_index > after` (`:27-59`).
- Producer: `BrowserWorker.emit_event` bumps `step_index`, stamps UTC `ts`, appends to in-memory `events[]`, fans out to SSE subscribers, fire-and-forget to Redis (`browser_worker_pool.py:211-236`). Replay never breaks worker loop.
- Durable: `action_ledger` rows with `(user_id, run_id, action, ip, ts)`. Owner predicate on every query. Go forwards verified identity to Python. No `default_user`.
- Redaction: no session cookies, passwords, OTPs, CAPTCHA text, raw tokens, full snapshots, unredacted resume data in logs (`deploy/aws/README.md:101`).

VM reuse:

- Same key shape. VM input/output frames emit via `emit_event`. No new store.
- Full replay = hot 500 events + durable `action_ledger` + question/handoff rows. Retention: hot 24h, durable permanent in Postgres.
- Two-user negative test required before launch: user B cannot read user A run events or ledger rows.

## 5. Go / no-go

Go for scoped Playwright computer. No-go for per-run Docker/Firecracker VM on current canary.

Reasons: 5s kill works now with zero new infra. HITL gates exist and are server-enforced. `t3.micro` cannot afford VM overhead. Redis/Postgres split already correct for replay.

3 first steps if go (design only, later build):

1. Pin concurrency to 1 browser per canary host. Enforce in `create_worker`: reject second run with 429 while one active. Measure peak RSS under Greenhouse run.
2. Extend `detect_sensitive_field` label table with salary/sponsorship/EEO keys. Each new key gets a `route_to_human_handoff` test in `test_origin_guard.py`. No auto-answer path.
3. Add durable replay spill: when Redis list hits 500, oldest 100 move to Postgres `computer_events` table with `(user_id, run_id, step_index)` owner predicate. Replay reads hot first, durable second.
