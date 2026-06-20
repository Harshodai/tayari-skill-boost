"""Async read/write cache for scraped jobs in the ``scraped_jobs`` table.

Uses a lazily-created asyncpg pool bound to ``DATABASE_URL``. When the
database URL is empty or asyncpg is not installed, every function becomes a
no-op (returns ``None`` / ``[]``) so the rest of Hermes never breaks in
keyless/DB-less environments.

The table is created by WS-B's migration; this module only reads/writes it.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from app.services.hermes.config import DATABASE_URL, SCRAPE_CACHE_TTL_SECONDS

logger = logging.getLogger(__name__)

_pool: Any = None
_pool_checked: bool = False


async def _get_pool() -> Any:
    """Return a cached asyncpg pool, or ``None`` when unavailable."""
    global _pool, _pool_checked
    if _pool_checked:
        return _pool
    _pool_checked = True
    if not DATABASE_URL:
        logger.debug("hermes.cache: DATABASE_URL unset, caching disabled")
        return None
    try:
        import asyncpg  # lazy: not a hard dependency
    except ImportError:
        logger.warning("hermes.cache: asyncpg not installed, caching disabled")
        return None
    try:
        _pool = await asyncpg.create_pool(dsn=DATABASE_URL, min_size=1, max_size=4)
    except Exception as exc:  # noqa: BLE001 - DB optional, never fatal
        logger.warning("hermes.cache: pool init failed (%s), caching disabled", exc)
        _pool = None
    return _pool


async def get_cached(
    board_class: str | None,
    query: str,
    location: str,
    ttl_seconds: int = SCRAPE_CACHE_TTL_SECONDS,
) -> list[dict] | None:
    """Return cached jobs younger than ``ttl_seconds``, or ``None``."""
    pool = await _get_pool()
    if not pool:
        return None
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT jobs FROM scraped_jobs
                WHERE board_class = $1 AND query = $2 AND location = $3
                  AND fetched_at > now() - make_interval(secs => $4)
                ORDER BY fetched_at DESC LIMIT 1
                """,
                board_class, query or "", location or "", ttl_seconds,
            )
            if not row:
                return None
            return json.loads(row["jobs"]) if row["jobs"] else []
    except Exception as exc:  # noqa: BLE001 - cache miss must never break scrape
        logger.warning("hermes.cache: get_cached failed (%s)", exc)
        return None


async def write_cached(
    source: str,
    board_class: str | None,
    board_token: str | None,
    query: str,
    location: str,
    jobs: list[dict],
) -> None:
    """Persist a scrape batch, keyed by (board_class, query, location)."""
    pool = await _get_pool()
    if not pool:
        return
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO scraped_jobs
                    (dedupe_key, source, board_class, board_token, query,
                     location, jobs, fetched_at, expires_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now(),
                        now() + make_interval(secs => $8))
                ON CONFLICT (dedupe_key) DO UPDATE
                    SET jobs = EXCLUDED.jobs, fetched_at = now(),
                        expires_at = EXCLUDED.expires_at
                """,
                _dedupe_key(board_class, query, location),
                source, board_class, board_token, query or "", location or "",
                json.dumps(jobs), SCRAPE_CACHE_TTL_SECONDS,
            )
    except Exception as exc:  # noqa: BLE001 - write failure must not break scrape
        logger.warning("hermes.cache: write_cached failed (%s)", exc)


async def list_by_board(board_class: str, limit: int = 50) -> list[dict]:
    """List the most recent cached jobs for a board class."""
    pool = await _get_pool()
    if not pool:
        return []
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT jobs FROM scraped_jobs
                WHERE board_class = $1
                ORDER BY fetched_at DESC LIMIT $2
                """,
                board_class, limit,
            )
            out: list[dict] = []
            for r in rows:
                out.extend(json.loads(r["jobs"]) if r["jobs"] else [])
            return out[:limit]
    except Exception as exc:  # noqa: BLE001
        logger.warning("hermes.cache: list_by_board failed (%s)", exc)
        return []


def _dedupe_key(board_class: str | None, query: str, location: str) -> str:
    """Stable cache key for a (board, query, location) triple."""
    return f"{board_class or 'any'}|{(query or '').lower()}|{(location or '').lower()}"


async def close_pool() -> None:
    """Close the cached pool (used on app shutdown)."""
    global _pool, _pool_checked
    if _pool is not None:
        try:
            await _pool.close()
        except Exception:  # noqa: BLE001
            pass
    _pool = None
    _pool_checked = False


# Re-export for orchestrator convenience.
__all__ = [
    "get_cached",
    "write_cached",
    "list_by_board",
    "close_pool",
    "SCRAPE_CACHE_TTL_SECONDS",
]