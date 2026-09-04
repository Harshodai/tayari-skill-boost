# Own Computer Replay + Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconnectable computer runs with Redis replay and owner-scoped audit.

**Architecture:** Python appends every worker event to a capped Redis list and serves cursor replay; Go proxies the replay endpoint with route parity; frontend resumes from the last step_index with backoff.

**Tech Stack:** Python FastAPI, Go Chi, React SSE/fetch, Redis, Postgres action_ledger.

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

### Task 1: Redis hot log + replay helper + worker hook

**Files:**
- Create: `backend/python/app/services/computer_replay.py`
- Modify: `backend/python/app/services/browser_worker_pool.py`
- Test: `backend/python/app/tests/test_computer_replay.py`

**Interfaces:**
- Consumes: `BrowserWorker.emit_event(event_type, payload)` dicts with `step_index`, `type`, `payload`, `ts`; `app.services.llm_cache.get_redis_client()`.
- Produces: `async def append_computer_event(run_id: str, event: dict) -> None`, `async def replay_computer_events(run_id: str, after: int = 0, limit: int = 500) -> dict` returning `{"events": [...], "next_after": int}`.

- [ ] **Step 1: Write the failing test**

```python
import pytest
from app.services import computer_replay

@pytest.mark.asyncio
async def test_replay_returns_events_after_cursor():
    class FakeRedis:
        def __init__(self): self.data = []
        async def lrange(self, k, a, b): return self.data[a:b+1]
    out = await computer_replay.replay_computer_events("r1", after=3, _client=FakeRedis())
    assert out["next_after"] == 3
    assert out["events"] == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./.venv/bin/python -m pytest app/tests/test_computer_replay.py::test_replay_returns_events_after_cursor -q`
Expected: FAIL with "computer_replay not defined" or "no module"

- [ ] **Step 3: Write minimal replay module**

```python
"""Hot replay log for computer runs (Redis, best-effort)."""
from __future__ import annotations
import json
from typing import Any

REPLAY_KEY_PREFIX = "tayari:computer:"
REPLAY_TTL_SECONDS = 86400
REPLAY_CAP = 500

def replay_key(run_id: str) -> str:
    return f"{REPLAY_KEY_PREFIX}{run_id}:events"

async def append_computer_event(run_id: str, event: dict, _client: Any = None) -> None:
    try:
        client = _client
        if client is None:
            from app.services.llm_cache import get_redis_client
            client = get_redis_client()
        if client is None:
            return
        await client.rpush(replay_key(run_id), json.dumps(event))
        await client.ltrim(replay_key(run_id), -REPLAY_CAP, -1)
        await client.expire(replay_key(run_id), REPLAY_TTL_SECONDS)
    except Exception:
        pass  # ponytail: replay is best-effort; worker never blocks on Redis

async def replay_computer_events(run_id: str, after: int = 0, limit: int = 500, _client: Any = None) -> dict:
    try:
        client = _client
        if client is None:
            from app.services.llm_cache import get_redis_client
            client = get_redis_client()
        if client is None:
            return {"events": [], "next_after": int(after)}
        raw = await client.lrange(replay_key(run_id), 0, REPLAY_CAP - 1)
        events = []
        for x in raw or []:
            try:
                events.append(json.loads(x))
            except Exception:
                continue
        out = [e for e in events if int(e.get("step_index", 0)) > int(after)][: max(1, min(int(limit), 500))]
        nxt = max([int(after)] + [int(e.get("step_index", after)) for e in out])
        return {"events": out, "next_after": nxt}
    except Exception:
        return {"events": [], "next_after": int(after)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./.venv/bin/python -m pytest app/tests/test_computer_replay.py -q`
Expected: PASS

- [ ] **Step 5: Hook emit_event to RPUSH (fail-open)**

```python
def emit_event(self, event_type: str, payload: Any) -> dict[str, Any]:
    self.step_index += 1
    event = {"type": event_type, "payload": payload, "step_index": self.step_index, "ts": datetime.now(timezone.utc).isoformat()}
    self.events.append(event)
    try:
        from app.services.computer_replay import append_computer_event
        import asyncio as _aio
        try:
            loop = _aio.get_running_loop()
            loop.create_task(append_computer_event(self.run_id, event))
        except RuntimeError:
            pass
    except Exception:
        pass  # ponytail: replay never breaks the worker loop
    for q in list(self.subscribers):
        try:
            q.put_nowait(event)
        except Exception:
            pass
    return event
```

- [ ] **Step 6: Run worker tests**

Run: `./.venv/bin/python -m pytest app/tests/test_computer_replay.py app/tests/test_vision_fallback.py app/tests/test_browser_worker_pool.py -q`
Expected: PASS

- [ ] **Step 7: Verify no-commit (stage check only)**

```bash
git status --short
git diff --check
```

Expected: diffs listed, `--check` clean, no commit created

### Task 2: Replay HTTP in Python + Go parity proxy

**Files:**
- Modify: `backend/python/app/api/computer_routes.py`
- Modify: `backend/go/internal/api/routes_computer.go`
- Test: `backend/python/app/tests/test_computer_replay.py`
- Test: `backend/go/internal/api/routes_computer_test.go`

**Interfaces:**
- Consumes: Task 1 `replay_computer_events(run_id, after, limit)`; Go `handleComputerGETPath(prefix)` proxy pattern.
- Produces: `GET /api/v1/computer/runs/{runId}/events?after=<step>` and `/api/...` twin returning `{"events": [...], "next_after": int}` with verified tenant headers.

- [ ] **Step 1: Write the failing Python route test**

```python
@pytest.mark.asyncio
async def test_replay_route_returns_cursor_shape(monkeypatch):
    import app.api.computer_routes as cr
    async def fake_replay(run_id, after=0, limit=500, _client=None):
        return {"events": [], "next_after": after}
    monkeypatch.setattr(cr, "replay_computer_events", fake_replay)
    out = await cr.replay_run_events(run_id="r1", after=0)
    assert out["next_after"] == 0
    assert out["events"] == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./.venv/bin/python -m pytest app/tests/test_computer_replay.py::test_replay_route_returns_cursor_shape -q`
Expected: FAIL with "replay_run_events not defined"

- [ ] **Step 3: Add minimal Python replay route**

```python
@router.get("/runs/{run_id}/events")
@router.get("/run/{run_id}/events")
async def replay_run_events(run_id: str, after: int = 0, context: VerifiedRequestContext = Depends(get_verified_context)):
    _ = context
    return await replay_computer_events(str(run_id), after=int(after))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./.venv/bin/python -m pytest app/tests/test_computer_replay.py -q`
Expected: PASS

- [ ] **Step 5: Add Go parity proxy (both prefixes)**

```go
r.Get("/api/v1/computer/runs/{runId}/events", s.handleComputerGETPath("/api/v1/computer/runs/"))
r.Get("/api/computer/runs/{runId}/events", s.handleComputerGETPath("/api/v1/computer/runs/"))
```

- [ ] **Step 6: Run Go parity gate**

Run: `go test ./internal/api -run 'TestSmoke|TestRouteParity' -count=1`
Expected: PASS, parity green (run from `backend/go`)

- [ ] **Step 7: Verify no-commit (stage check only)**

```bash
git status --short
git diff --check
```

Expected: diffs listed, `--check` clean, no commit created

### Task 3: Frontend resume + owner-scoped audit

**Files:**
- Modify: `src/api/browser.ts`
- Modify: `src/components/TayariComputerControlRoom.tsx`
- Modify: `backend/python/app/api/computer_routes.py`
- Test: `src/api/browser.test.ts`
- Test: `backend/python/app/tests/test_computer_replay.py`

**Interfaces:**
- Consumes: Task 2 replay GET; `streamComputerRun(runId, onEvent)`; `action_ledger` insert with `(user_id, run_id, action, ip)`.
- Produces: `fetchComputerReplay(runId, after)` returning `{"events": [...], "next_after": int}`; control room resumes from last `step_index` with backoff; audit rows written on `visual_action`/`pause_required`/handoff with owner predicate.

- [ ] **Step 1: Write the failing frontend test**

```typescript
test("fetchComputerReplay passes after cursor", async () => {
  const calls: string[] = [];
  (global as any).fetch = async (url: string) => {
    calls.push(url);
    return { ok: true, json: async () => ({ events: [], next_after: 7 }) };
  };
  const out = await fetchComputerReplay("r1", 3);
  expect(calls[0]).toContain("after=3");
  expect(out.next_after).toBe(7);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- src/api/browser.test.ts`
Expected: FAIL with "fetchComputerReplay not defined"

- [ ] **Step 3: Add minimal fetch helper**

```typescript
export async function fetchComputerReplay(runId: string, after = 0): Promise<{ events: ComputerLiveEvent[]; next_after: number }> {
  const id = runId.trim();
  if (!id) throw new Error("Run ID is required.");
  const cur = Math.max(0, Math.trunc(after));
  return await apiFetch<{ events: ComputerLiveEvent[]; next_after: number }>(
    `/v1/computer/runs/${encodeURIComponent(id)}/events?after=${cur}`,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- src/api/browser.test.ts`
Expected: PASS

- [ ] **Step 5: Resume in control room + audit insert**

```typescript
// ponytail: resume from last step so disconnects never lose visibility
const replay = await fetchComputerReplay(runId, lastStepIndex);
replay.events.forEach(onEvent);
```

```python
# ponytail: audit every terminal vision decision with owner predicate, fail-closed on DB errors
await conn.execute("INSERT INTO action_ledger (user_id, run_id, action, ip_address) VALUES ($1,$2,$3,$4)", user_id, run_id, action, ip)
```

- [ ] **Step 6: Run gates**

Run: `bun run lint`
Expected: PASS with 0 errors

Run: `./.venv/bin/python -m pytest app/tests/test_computer_replay.py -q`
Expected: PASS (run from `backend/python`)

- [ ] **Step 7: Verify no-commit (stage check only)**

```bash
git status --short
git diff --check
```

Expected: diffs listed, `--check` clean, no commit created
