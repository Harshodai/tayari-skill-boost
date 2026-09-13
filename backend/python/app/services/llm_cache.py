from __future__ import annotations

import hashlib
import json
import logging
import os

logger = logging.getLogger(__name__)

try:
    from app.services.prompt_registry import get_prompt as _get_prompt

    OPTIMIZER_PROMPT_VERSION, _ = _get_prompt("optimizer.generate")
except Exception:
    # ponytail: registry is canonical; static fallback keeps cache keying alive if it can't load.
    OPTIMIZER_PROMPT_VERSION = "1.0.0"
ATS_CACHE_TTL_SECONDS = 3600
OPTIMIZER_CACHE_TTL_SECONDS = 3600


def _redis_url() -> str:
    return os.getenv("REDIS_URL", "redis://redis:6379/0")


def get_redis_client():
    try:
        from redis.asyncio import Redis

        return Redis.from_url(_redis_url(), decode_responses=True)
    except Exception as exc:
        logger.warning("llm_cache: redis client unavailable: %s", exc)
        return None


async def _close_client(client) -> None:
    try:
        if client is not None and hasattr(client, "aclose"):
            await client.aclose()
    except Exception as exc:
        logger.warning("llm_cache: redis close failed: %s", exc)


def _material(parts: list[str]) -> bytes:
    return "\x00".join(parts).encode("utf-8")


def build_optimizer_cache_key(
    resume_text: str,
    jd_text: str | None,
    prompt_version: str = OPTIMIZER_PROMPT_VERSION,
    target_role: str | None = None,
    job_label: str | None = None,
    custom_instructions: str | None = None,
    transition: dict | None = None,
) -> str:
    # ponytail: transition dict is JSON-canonicalized (sorted keys) so key order never causes a false miss.
    try:
        transition_s = json.dumps(transition, sort_keys=True, default=str) if transition else ""
    except Exception:
        transition_s = str(transition or "")
    digest = hashlib.sha256(
        _material(
            [
                resume_text or "",
                jd_text or "",
                prompt_version or "",
                target_role or "",
                job_label or "",
                custom_instructions or "",
                transition_s,
            ]
        )
    ).hexdigest()
    # ponytail: prompt_version in the prefix namespaces keys AND in the hash invalidates content on prompt change.
    return f"tayari:opt:{prompt_version}:{digest}"


def build_ats_cache_key(
    resume_text: str,
    jd_text: str | None,
    prompt_version: str = OPTIMIZER_PROMPT_VERSION,
) -> str:
    digest = hashlib.sha256(
        _material([resume_text or "", jd_text or "", prompt_version or ""])
    ).hexdigest()
    return f"tayari:ats:{prompt_version}:{digest}"


async def get_optimizer_result(client, key: str) -> dict | None:
    # ponytail: fail-open by design — cache is a speedup, never a correctness gate.
    if client is None or not key:
        return None
    try:
        raw = await client.get(key)
    except Exception as exc:
        logger.warning("llm_cache: get failed: %s", exc)
        return None
    if not raw:
        return None
    try:
        value = json.loads(raw)
    except Exception:
        return None
    return value if isinstance(value, dict) else None


async def set_optimizer_result(client, key: str, value: dict, ttl: int = OPTIMIZER_CACHE_TTL_SECONDS) -> bool:
    if client is None or not key or not isinstance(value, dict):
        return False
    try:
        payload = json.dumps(value, default=str)
    except Exception as exc:
        logger.warning("llm_cache: serialize failed: %s", exc)
        return False
    try:
        await client.set(key, payload, ex=ttl)
        return True
    except Exception as exc:
        logger.warning("llm_cache: set failed: %s", exc)
        return False
