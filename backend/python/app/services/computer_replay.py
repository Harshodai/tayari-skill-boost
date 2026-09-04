"""Hot replay log for computer runs (Redis, best-effort)."""
from __future__ import annotations
import json
from typing import Any

REPLAY_KEY_PREFIX = "tayari:computer:"
REPLAY_TTL_SECONDS = 86400
REPLAY_CAP = 500

def replay_key(run_id: str, user_id: str = "") -> str:
    # ponytail: owner-scoped key — a guessed run_id alone never reads another tenant's replay
    if user_id:
        return f"{REPLAY_KEY_PREFIX}{user_id}:{run_id}:events"
    return f"{REPLAY_KEY_PREFIX}{run_id}:events"

async def append_computer_event(run_id: str, event: dict, _client: Any = None, user_id: str = "") -> None:
    try:
        client = _client
        if client is None:
            from app.services.llm_cache import get_redis_client
            client = get_redis_client()
        if client is None:
            return
        await client.rpush(replay_key(run_id, user_id), json.dumps(event))
        await client.ltrim(replay_key(run_id, user_id), -REPLAY_CAP, -1)
        await client.expire(replay_key(run_id, user_id), REPLAY_TTL_SECONDS)
    except Exception:
        pass  # ponytail: replay is best-effort; worker never blocks on Redis

async def replay_computer_events(run_id: str, after: int = 0, limit: int = 500, _client: Any = None, user_id: str = "") -> dict:
    try:
        client = _client
        if client is None:
            from app.services.llm_cache import get_redis_client
            client = get_redis_client()
        if client is None:
            return {"events": [], "next_after": int(after)}
        raw = await client.lrange(replay_key(run_id, user_id), 0, REPLAY_CAP - 1)
        events = []
        for x in raw or []:
            try:
                events.append(json.loads(x))
            except Exception:
                continue
        # ponytail: per-event fail-open — one malformed step_index skips that event, never drops the replay
        after_int = int(after)
        out = []
        for e in events:
            try:
                if int(e.get("step_index", 0)) > after_int:
                    out.append(e)
            except (ValueError, TypeError):
                continue
        out = out[: max(1, min(int(limit), 500))]
        steps = [after_int]
        for e in out:
            try:
                steps.append(int(e.get("step_index", after_int)))
            except (ValueError, TypeError):
                continue
        return {"events": out, "next_after": max(steps)}
    except Exception:
        return {"events": [], "next_after": int(after)}
