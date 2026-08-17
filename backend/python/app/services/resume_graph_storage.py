"""Persistent storage helpers for resume graphs.

Implements simple upsert / load / delete operations against the ``resume_graphs``
PostgreSQL table using the shared asyncpg pool from :mod:`app.services.db`.

Every operation is owner-scoped: the caller's verified ``user_id`` is part of
the WHERE/INSERT predicate, so one user can never read, overwrite, or delete
another user's resume graph by guessing a ``run_id``.

All functions are async and gracefully degrade when the DB pool is unavailable –
they log a warning and become no‑ops, mirroring the behaviour of other DB
helpers in the codebase.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

from app.services.db import get_pool

logger = logging.getLogger(__name__)


async def store_graph(run_id: str, graph: Any, user_id: str) -> None:
    """Upsert a resume ``graph`` for ``run_id``.

    The ``graph`` value is JSON‑serialisable. When the DB pool is unavailable the
    function logs a warning and returns without error, matching the optional‑DB
    pattern used elsewhere in the project.
    """
    pool = await get_pool()
    if not pool:
        logger.warning("DB disabled – resume graph not persisted for run_id %s", run_id)
        return
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO resume_graphs (run_id, graph, user_id)
                VALUES ($1, $2::jsonb, $3)
                ON CONFLICT (run_id) DO UPDATE
                    SET graph = EXCLUDED.graph, updated_at = now()
                    WHERE resume_graphs.user_id = EXCLUDED.user_id
                """,
                run_id,
                json.dumps(graph),
                user_id,
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to store resume graph for run_id %s: %s", run_id, exc)


async def load_graph(run_id: str, user_id: str) -> Optional[Any]:
    """Fetch the stored graph for ``run_id``.

    Returns ``None`` when the row does not exist or the DB is unavailable.
    """
    pool = await get_pool()
    if not pool:
        logger.debug("DB disabled – cannot load resume graph for %s", run_id)
        return None
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT graph FROM resume_graphs WHERE run_id = $1 AND user_id = $2",
                run_id,
                user_id,
            )
            if not row:
                return None
            # asyncpg returns jsonb columns as str (default codec, as in
            # ``app.services.db.load_agent_run``), so decode it when needed.
            graph = row["graph"]
            if isinstance(graph, str):
                graph = json.loads(graph)
            return graph
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to load resume graph for run_id %s: %s", run_id, exc)
        return None


async def delete_graph(run_id: str, user_id: str) -> None:
    """Delete the stored graph for ``run_id``.

    No‑op when the DB is unavailable.
    """
    pool = await get_pool()
    if not pool:
        logger.debug("DB disabled – cannot delete resume graph for %s", run_id)
        return
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM resume_graphs WHERE run_id = $1 AND user_id = $2",
                run_id,
                user_id,
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to delete resume graph for run_id %s: %s", run_id, exc)
