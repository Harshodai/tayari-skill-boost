from __future__ import annotations

import asyncio
import inspect
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Callable, Optional

try:
    import redis.asyncio as aioredis
except ImportError:
    try:
        import aioredis  # type: ignore[no-redef]
    except ImportError:
        aioredis = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)

_redis_client: Any = None
_redis_loop: Any = None


def _get_redis_url() -> str:
    try:
        from app.config import settings

        if settings and getattr(settings, "redis_url", None):
            return settings.redis_url
    except Exception:
        pass
    return os.getenv("REDIS_URL", "redis://redis:6379")


def get_redis(url: str | None = None) -> Any:
    """Return an async Redis client using aioredis, configured via settings.redis_url or REDIS_URL."""
    global _redis_client, _redis_loop
    if aioredis is None:
        logger.warning("aioredis is not installed or unavailable")
        return None

    target_url = url or _get_redis_url()

    current_loop = None
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        pass

    # Reuse existing client if on the same running event loop and default url
    if (
        url is None
        and _redis_client is not None
        and _redis_loop is current_loop
        and current_loop is not None
        and not current_loop.is_closed()
    ):
        return _redis_client

    client = aioredis.from_url(target_url, decode_responses=True)
    if url is None:
        _redis_client = client
        _redis_loop = current_loop
    return client


async def close_redis() -> None:
    """Close the cached Redis client connection cleanly."""
    global _redis_client, _redis_loop
    if _redis_client is not None and hasattr(_redis_client, "aclose"):
        try:
            await _redis_client.aclose()
        except Exception as exc:
            logger.debug("event_bus: close_redis error: %s", exc)
    _redis_client = None
    _redis_loop = None


async def publish_event(stream: str, event_type: str, data: dict, r: Any = None) -> str:
    """Publish an event to a Redis Stream with payload serialization.

    Serializes payload with `type`, `data` (json encoded), and `timestamp` (ISO UTC).
    Appends to Redis stream with `r.xadd(stream, payload, maxlen=10000)`.
    Catches connection errors gracefully so publishing never breaks main application execution if Redis is down.
    """
    try:
        redis_client = r or get_redis()
        if redis_client is None:
            logger.warning("publish_event: Redis client unavailable for stream %s", stream)
            return ""

        payload = {
            "type": event_type,
            "data": json.dumps(data, default=str) if not isinstance(data, str) else data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        entry_id = await redis_client.xadd(stream, payload, maxlen=10000)
        return str(entry_id) if entry_id else ""
    except Exception as exc:
        logger.warning(
            "publish_event: Failed to publish event '%s' to stream '%s': %s",
            event_type,
            stream,
            exc,
        )
        return ""


async def _execute_handler(handler: Callable, msg_id: str, fields: dict) -> None:
    """Execute event handler safely supporting both sync/async and 1-arg/2-arg call signatures."""
    event = dict(fields) if isinstance(fields, dict) else {}
    event.setdefault("id", msg_id)
    if "data" in event and isinstance(event["data"], str):
        try:
            event["parsed_data"] = json.loads(event["data"])
        except Exception:
            pass

    use_one_arg = False
    try:
        sig = inspect.signature(handler)
        params = [
            p
            for p in sig.parameters.values()
            if p.kind not in (inspect.Parameter.VAR_POSITIONAL, inspect.Parameter.VAR_KEYWORD)
        ]
        if len(params) == 1:
            use_one_arg = True
    except (ValueError, TypeError):
        pass

    if use_one_arg:
        res = handler(event)
    else:
        try:
            res = handler(msg_id, fields)
        except TypeError:
            res = handler(event)

    if inspect.isawaitable(res):
        await res


async def consume_events(
    stream: str,
    group: str,
    consumer: str,
    handler: Callable,
    count: int = 10,
    block: int = 2000,
    r: Any = None,
) -> int:
    """Consume events from a Redis Stream using a consumer group.

    - Ensures consumer group exists (`xgroup_create` with mkstream=True).
    - Reads from group with `xreadgroup`, executes handler, and acknowledges with `xack`.
    - Returns the number of events successfully processed and acknowledged.
    """
    try:
        redis_client = r or get_redis()
        if redis_client is None:
            logger.warning("consume_events: Redis client unavailable for stream %s", stream)
            return 0

        try:
            await redis_client.xgroup_create(stream, group, id="0", mkstream=True)
        except Exception as exc:
            # BUSYGROUP indicates consumer group already exists in Redis
            if "BUSYGROUP" not in str(exc):
                logger.warning(
                    "consume_events: xgroup_create error on stream %s group %s: %s",
                    stream,
                    group,
                    exc,
                )

        entries = await redis_client.xreadgroup(
            groupname=group,
            consumername=consumer,
            streams={stream: ">"},
            count=count,
            block=block,
        )

        if not entries:
            return 0

        processed = 0
        for stream_entry in entries:
            if not stream_entry or len(stream_entry) < 2:
                continue
            messages = stream_entry[1]
            for message in messages:
                if not message or len(message) < 2:
                    continue
                msg_id, fields = message[0], message[1]
                try:
                    await _execute_handler(handler, msg_id, fields)
                    await redis_client.xack(stream, group, msg_id)
                    processed += 1
                except Exception as handler_err:
                    logger.error(
                        "consume_events: handler error for msg %s on stream %s: %s",
                        msg_id,
                        stream,
                        handler_err,
                    )

        return processed
    except Exception as exc:
        logger.warning("consume_events: connection error on stream %s: %s", stream, exc)
        return 0
