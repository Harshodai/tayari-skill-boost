# Own Computer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the scoped browser computer with reconnectable runs, then expand boards, then evaluate a full VM.

**Architecture:** Python owns browser execution and event log; Go proxies replay with parity; frontend resumes streams; Postgres holds durable audit; Redis holds hot replay.

**Tech Stack:** Python FastAPI + Playwright, Go Chi gateway, React SSE, Redis, Postgres (Supabase), Supabase Storage (workspace, deferred).

## Global Constraints

- `AUTONOMOUS_SUBMIT_ENABLED=false` server-enforced, never bypassed.
- Service separation: Go routing/auth/CRUD only, Python all browser/AI, frontend via Go only (Supabase Auth direct exception unchanged).
- Route parity: every `/api` route has `/api/v1` twin or `knownAsymmetric` entry.
- New pages/flags in `src/config/features.ts`.
- No per-package `manualChunks` in `vite.config.ts`.
- `JWT_SECRET` required, no real secrets committed, `.env` gitignored.
- Mock-never-passing: real engine verified via `/health` before trusting AI output.
- `// ponytail:` on non-obvious minimal choices; no new deps without justification.
- `docker compose --profile dev up -d --build` (bare `up` starts nothing).

---

### Task 1: Replay + audit foundation (board-agnostic)

**Files:**
- Modify: `backend/python/app/services/browser_worker_pool.py`
- Modify: `backend/python/app/api/computer_routes.py`
- Modify: `backend/go/internal/api/routes_computer.go`
- Modify: `backend/go/internal/api/router_parity_test.go` (only if asymmetric)
- Modify: `src/components/TayariComputerControlRoom.tsx`
- Modify: `src/api/browser.ts`
- Test: `backend/python/app/tests/test_computer_replay.py`
- Test: `backend/go/internal/api/routes_computer_test.go`

**Interfaces:**
- Consumes: `BrowserWorker.emit_event(type, payload)` with `step_index`, existing `visual_action`/`pause_required` events.
- Produces: `GET /api/v1/computer/runs/{id}/events?after=<step>` returning `{"events": [...], "next_after": int}`; audit rows with `(user_id, run_id, action, ip, ts)`.

- [ ] **Step 1: Write the failing replay test**

```python
def test_replay_returns_events_after_cursor():
    events = replay_events(run_id="r1", after=3)
    assert events["next_after"] == 5
    assert [e["step_index"] for e in events["events"]] == [4, 5]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./.venv/bin/python -m pytest app/tests/test_computer_replay.py::test_replay_returns_events_after_cursor -q`
Expected: FAIL with "replay_events not defined"

- [ ] **Step 3: Write minimal Redis hot log + replay**

```python
async def replay_events(run_id: str, after: int = 0) -> dict:
    client = get_redis_client()
    if client is None:
        return {"events": [], "next_after": after}
    raw = await client.lrange(f"tayari:computer:{run_id}:events", 0, 499)
    events = [json.loads(x) for x in raw if x]
    out = [e for e in events if e.get("step_index", 0) > after]
    return {"events": out, "next_after": max([after] + [e.get("step_index", after) for e in out])}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./.venv/bin/python -m pytest app/tests/test_computer_replay.py -q`
Expected: PASS

- [ ] **Step 5: Wire emit_event to RPUSH (fail-open)**

```python
try:
    client = get_redis_client()
    if client is not None:
        await client.rpush(f"tayari:computer:{self.run_id}:events", json.dumps(event))
        await client.ltrim(f"tayari:computer:{self.run_id}:events", -500, -1)
        await client.expire(f"tayari:computer:{self.run_id}:events", 86400)
except Exception:
    pass  # ponytail: replay is best-effort; worker never blocks on Redis
```

- [ ] **Step 6: Add replay route (both prefixes)**

```go
r.Get("/api/computer/runs/{id}/events", s.handleComputerEvents)
r.Get("/api/v1/computer/runs/{id}/events", s.handleComputerEvents)
```

- [ ] **Step 7: Frontend resume via last step_index + backoff**

```typescript
let after = lastStepIndex;
const es = new EventSource(`/api/v1/computer/runs/${runId}/events?after=${after}`);
```

- [ ] **Step 8: Audit rows with owner predicate**

```sql
INSERT INTO action_ledger (user_id, run_id, action, ip_address, created_at)
VALUES ($1, $2, $3, $4, now());
```

- [ ] **Step 9: Run gates**

```bash
cd backend/go && go test ./internal/api -run 'TestSmoke|TestRouteParity' -count=1
cd backend/python && ./.venv/bin/python -m pytest app/tests/test_computer_replay.py app/tests/test_vision_fallback.py -q
```

Expected: PASS, parity green

- [ ] **Step 10: Commit**

```bash
git add backend/python/app/services/browser_worker_pool.py backend/python/app/api/computer_routes.py backend/go/internal/api/routes_computer.go src/components/TayariComputerControlRoom.tsx src/api/browser.ts backend/python/app/tests/test_computer_replay.py
git commit -m "feat: reconnectable computer runs with replay and audit"
```

### Task 2: Multi-board policy (flagged)

**Files:**
- Modify: `backend/python/app/services/browser_worker_pool.py`
- Modify: `backend/python/app/services/computer_action_policy.py`
- Test: `backend/python/app/tests/test_computer_boards.py`

**Interfaces:**
- Consumes: Task 1 replay/audit; `validate_ats_url(url)` allowlist.
- Produces: `BOARD_POLICIES = {"boards.greenhouse.io": {...}, "boards.lever.co": {...}, "jobs.ashbyhq.com": {...}}` with per-board selectors and HITL rules; Greenhouse live, others flagged off.

- [ ] **Step 1: Write the failing board-policy test**

```python
def test_unknown_board_rejected():
    with pytest.raises(DomainForbiddenError):
        validate_ats_url("https://evil.example.com/j/1")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./.venv/bin/python -m pytest app/tests/test_computer_boards.py::test_unknown_board_rejected -q`
Expected: FAIL if validation missing

- [ ] **Step 3: Write minimal board table**

```python
BOARD_POLICIES = {
    "boards.greenhouse.io": {"enabled": True},
    "boards.lever.co": {"enabled": False},
    "jobs.ashbyhq.com": {"enabled": False},
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./.venv/bin/python -m pytest app/tests/test_computer_boards.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/python/app/services/browser_worker_pool.py backend/python/app/services/computer_action_policy.py backend/python/app/tests/test_computer_boards.py
git commit -m "feat: multi-board computer policy table"
```

### Task 3: VM feasibility spike (no build)

**Files:**
- Create: `docs/superpowers/specs/2026-09-04-own-computer-vm-spike.md`

**Interfaces:**
- Consumes: Tasks 1-2 hardening and policy.
- Produces: Spike report with cost, isolation, HITL, and go/no-go.

- [ ] **Step 1: Write spike questions**

```markdown
- Isolation: disposable VM per run with 5s kill?
- HITL: submit/password/OTP/CAPTCHA always pause?
- Cost: memory ceiling for Playwright + Celery?
- Audit: full session replay retained?
```

- [ ] **Step 2: Timebox and report**

Run: `echo spike > docs/superpowers/specs/2026-09-04-own-computer-vm-spike.md`
Expected: report exists, no production code changed

- [ ] **Step 3: Commit spike only**

```bash
git add docs/superpowers/specs/2026-09-04-own-computer-vm-spike.md
git commit -m "docs: own-computer VM feasibility spike"
```
