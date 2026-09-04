"""Durable Postgres-backed checkpoint store and state rewind for automation runs.

Adheres to WP-11:
- Table: public.run_checkpoints
- State hashing via SHA-256 canonical JSON
- Owner isolation and RLS compatibility
- State rewind and resumption primitives
"""
from __future__ import annotations

import copy
import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any

from app.services.db import get_pool

logger = logging.getLogger(__name__)


class CheckpointError(Exception):
    """Base exception for checkpoint store operations."""


class CheckpointOwnershipError(CheckpointError, PermissionError):
    """Raised when checkpoint access is attempted by a non-owner candidate."""


class CheckpointIntegrityError(CheckpointError, ValueError):
    """Raised when checkpoint state hash verification fails."""


class CheckpointNotFoundError(CheckpointError, KeyError):
    """Raised when a requested checkpoint does not exist."""


class CheckpointStoreUnavailable(CheckpointError, RuntimeError):
    """Raised when database pool or connection is unavailable."""


def compute_state_hash(state_dict: dict[str, Any]) -> str:
    """Compute deterministic SHA-256 hash for state dictionary using canonical JSON."""
    if not isinstance(state_dict, dict):
        raise ValueError("state_dict must be a dictionary")
    canonical_bytes = json.dumps(state_dict, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(canonical_bytes).hexdigest()


def verify_checkpoint_hash(state_dict: dict[str, Any], expected_hash: str) -> bool:
    """Verify that state_dict matches the expected SHA-256 hash."""
    if not expected_hash:
        return False
    try:
        computed = compute_state_hash(state_dict)
        return computed.lower() == expected_hash.strip().lower()
    except Exception:
        return False


def _row_to_dict(row: Any) -> dict[str, Any]:
    """Convert an asyncpg record or dictionary to a normalized checkpoint dict."""
    if row is None:
        return {}
    d = dict(row)
    for k in ("id", "run_id", "user_id", "approver_user_id"):
        if k in d and d[k] is not None:
            d[k] = str(d[k])
    if "step_index" in d and d["step_index"] is not None:
        d["step_index"] = int(d["step_index"])
    if "created_at" in d and hasattr(d["created_at"], "isoformat"):
        d["created_at"] = d["created_at"].isoformat()
    if "state_json" in d and isinstance(d["state_json"], str):
        try:
            d["state_json"] = json.loads(d["state_json"])
        except Exception:
            pass
    return d


async def _verify_run_owner(conn: Any, run_id: str, user_id: str) -> None:
    """Verify that run_id is not owned by a different user."""
    if not user_id:
        return
    norm_user = str(user_id).strip()
    norm_run = str(run_id).strip()

    # 1. Check existing checkpoints for this run
    try:
        existing_owner = await conn.fetchval(
            """
            SELECT user_id FROM public.run_checkpoints
            WHERE run_id = $1::uuid AND user_id IS NOT NULL AND user_id != $2::uuid
            LIMIT 1
            """,
            norm_run,
            norm_user,
        )
        if existing_owner:
            raise CheckpointOwnershipError(f"run {run_id} belongs to a different candidate")
    except CheckpointOwnershipError:
        raise
    except Exception as exc:
        raise CheckpointStoreUnavailable(
            f"checkpoint store: ownership probe unavailable ({exc})"
        ) from exc

    # 2. Check agent_runs table
    try:
        agent_owner = await conn.fetchval(
            "SELECT user_id FROM public.agent_runs WHERE run_id = $1::uuid",
            norm_run,
        )
        if agent_owner and str(agent_owner).strip() != norm_user:
            raise CheckpointOwnershipError(f"run {run_id} belongs to a different candidate")
    except CheckpointOwnershipError:
        raise
    except Exception as exc:
        raise CheckpointStoreUnavailable(
            f"checkpoint store: ownership probe unavailable ({exc})"
        ) from exc

    # 3. Check application_runs table
    try:
        app_owner = await conn.fetchval(
            "SELECT user_id FROM public.application_runs WHERE id = $1::uuid",
            norm_run,
        )
        if app_owner and str(app_owner).strip() != norm_user:
            raise CheckpointOwnershipError(f"run {run_id} belongs to a different candidate")
    except CheckpointOwnershipError:
        raise
    except Exception as exc:
        raise CheckpointStoreUnavailable(
            f"checkpoint store: ownership probe unavailable ({exc})"
        ) from exc


async def save_checkpoint(
    run_id: str,
    step_index: int,
    state_dict: dict[str, Any],
    approver_user_id: str | None = None,
    user_id: str | None = None,
    *,
    pool: Any = None,
) -> dict[str, Any]:
    """Save or update a durable checkpoint for a run at a given step index.
    
    Computes cryptographic state_hash and enforces owner isolation.
    """
    if not run_id or not str(run_id).strip():
        raise ValueError("run_id is required")
    if step_index is None or int(step_index) < 0:
        raise ValueError("step_index must be non-negative integer")
    if not isinstance(state_dict, dict):
        raise ValueError("state_dict must be a dictionary")

    norm_run_id = str(run_id).strip()
    step_idx = int(step_index)
    state_hash = compute_state_hash(state_dict)
    state_json_str = json.dumps(state_dict, sort_keys=True)

    db_pool = pool or await get_pool()
    if db_pool is None:
        raise CheckpointStoreUnavailable("database pool unavailable")

    async with db_pool.acquire() as conn:
        if user_id:
            await _verify_run_owner(conn, norm_run_id, user_id)

        row = await conn.fetchrow(
            """
            INSERT INTO public.run_checkpoints (
                run_id, step_index, state_json, state_hash, approver_user_id, user_id
            ) VALUES (
                $1::uuid, $2, $3::jsonb, $4, $5::uuid, $6::uuid
            )
            ON CONFLICT (run_id, step_index) DO UPDATE
            SET state_json = EXCLUDED.state_json,
                state_hash = EXCLUDED.state_hash,
                approver_user_id = COALESCE(EXCLUDED.approver_user_id, run_checkpoints.approver_user_id),
                user_id = COALESCE(EXCLUDED.user_id, run_checkpoints.user_id),
                created_at = now()
            RETURNING id, run_id, step_index, state_json, state_hash, approver_user_id, user_id, created_at
            """,
            norm_run_id,
            step_idx,
            state_json_str,
            state_hash,
            str(approver_user_id).strip() if approver_user_id else None,
            str(user_id).strip() if user_id else None,
        )

    return _row_to_dict(row)


async def get_checkpoint(
    run_id: str,
    step_index: int,
    user_id: str | None = None,
    *,
    pool: Any = None,
) -> dict[str, Any] | None:
    """Retrieve and integrity-verify a specific checkpoint for a run."""
    if not run_id or not str(run_id).strip():
        raise ValueError("run_id is required")
    if step_index is None:
        raise ValueError("step_index is required")

    norm_run_id = str(run_id).strip()
    step_idx = int(step_index)

    db_pool = pool or await get_pool()
    if db_pool is None:
        raise CheckpointStoreUnavailable("database pool unavailable")

    async with db_pool.acquire() as conn:
        if user_id:
            await _verify_run_owner(conn, norm_run_id, user_id)

        row = await conn.fetchrow(
            """
            SELECT id, run_id, step_index, state_json, state_hash, approver_user_id, user_id, created_at
            FROM public.run_checkpoints
            WHERE run_id = $1::uuid AND step_index = $2
            """,
            norm_run_id,
            step_idx,
        )

    if not row:
        return None

    checkpoint = _row_to_dict(row)

    # Owner check on checkpoint row if user_id was specified
    if user_id and checkpoint.get("user_id"):
        if checkpoint["user_id"] != str(user_id).strip():
            raise CheckpointOwnershipError("checkpoint belongs to a different candidate")

    # Hash verification — guard against non-dict state_json (e.g., DB type mismatch)
    state_json = checkpoint.get("state_json")
    if not isinstance(state_json, dict):
        raise ValueError(
            f"checkpoint state_json has unexpected type {type(state_json).__name__} for run {run_id}, step {step_index}"
        )
    if not verify_checkpoint_hash(state_json, checkpoint["state_hash"]):
        raise CheckpointIntegrityError(
            f"checkpoint hash verification failed for run {run_id}, step {step_index}"
        )

    return checkpoint


async def list_checkpoints(
    run_id: str,
    user_id: str | None = None,
    *,
    pool: Any = None,
) -> list[dict[str, Any]]:
    """List all checkpoints for a run ordered by step index ascending with hash verification."""
    if not run_id or not str(run_id).strip():
        raise ValueError("run_id is required")

    norm_run_id = str(run_id).strip()

    db_pool = pool or await get_pool()
    if db_pool is None:
        raise CheckpointStoreUnavailable("database pool unavailable")

    async with db_pool.acquire() as conn:
        if user_id:
            await _verify_run_owner(conn, norm_run_id, user_id)

        rows = await conn.fetch(
            """
            SELECT id, run_id, step_index, state_json, state_hash, approver_user_id, user_id, created_at
            FROM public.run_checkpoints
            WHERE run_id = $1::uuid
            ORDER BY step_index ASC
            """,
            norm_run_id,
        )

    checkpoints: list[dict[str, Any]] = []
    for r in rows:
        cp = _row_to_dict(r)
        if user_id and cp.get("user_id") and cp["user_id"] != str(user_id).strip():
            raise CheckpointOwnershipError("checkpoint belongs to a different candidate")
        if not verify_checkpoint_hash(cp["state_json"], cp["state_hash"]):
            raise CheckpointIntegrityError(
                f"checkpoint hash verification failed for run {run_id}, step {cp.get('step_index')}"
            )
        checkpoints.append(cp)

    return checkpoints


async def get_latest_checkpoint(
    run_id: str,
    user_id: str | None = None,
    *,
    pool: Any = None,
) -> dict[str, Any] | None:
    """Retrieve the latest (highest step_index) verified checkpoint for a run."""
    if not run_id or not str(run_id).strip():
        raise ValueError("run_id is required")

    norm_run_id = str(run_id).strip()

    db_pool = pool or await get_pool()
    if db_pool is None:
        raise CheckpointStoreUnavailable("database pool unavailable")

    async with db_pool.acquire() as conn:
        if user_id:
            await _verify_run_owner(conn, norm_run_id, user_id)

        row = await conn.fetchrow(
            """
            SELECT id, run_id, step_index, state_json, state_hash, approver_user_id, user_id, created_at
            FROM public.run_checkpoints
            WHERE run_id = $1::uuid
            ORDER BY step_index DESC
            LIMIT 1
            """,
            norm_run_id,
        )

    if not row:
        return None

    checkpoint = _row_to_dict(row)
    if user_id and checkpoint.get("user_id"):
        if checkpoint["user_id"] != str(user_id).strip():
            raise CheckpointOwnershipError("checkpoint belongs to a different candidate")

    if not verify_checkpoint_hash(checkpoint["state_json"], checkpoint["state_hash"]):
        raise CheckpointIntegrityError(
            f"checkpoint hash verification failed for run {run_id}, step {checkpoint.get('step_index')}"
        )

    return checkpoint


async def resume_from_checkpoint(
    run_id: str,
    step_index: int | None = None,
    user_id: str | None = None,
    *,
    prune_subsequent: bool = False,
    pool: Any = None,
) -> dict[str, Any]:
    """Restore state from the given checkpoint so worker can resume after failure or restart.
    
    If step_index is None, resumes from the latest recorded checkpoint.
    If prune_subsequent is True (rewind mode), discards checkpoints strictly after step_index.
    """
    if not run_id or not str(run_id).strip():
        raise ValueError("run_id is required")

    norm_run_id = str(run_id).strip()
    db_pool = pool or await get_pool()
    if db_pool is None:
        raise CheckpointStoreUnavailable("database pool unavailable")

    if step_index is None:
        checkpoint = await get_latest_checkpoint(norm_run_id, user_id=user_id, pool=db_pool)
        if not checkpoint:
            raise CheckpointNotFoundError(f"no checkpoint found for run {run_id}")
    else:
        checkpoint = await get_checkpoint(norm_run_id, step_index, user_id=user_id, pool=db_pool)
        if not checkpoint:
            raise CheckpointNotFoundError(f"checkpoint at step {step_index} not found for run {run_id}")

    # If state rewind requested, prune orphaned subsequent checkpoints
    if prune_subsequent:
        target_step = int(checkpoint["step_index"])
        async with db_pool.acquire() as conn:
            if user_id:
                await conn.execute(
                    """
                    DELETE FROM public.run_checkpoints
                    WHERE run_id = $1::uuid AND user_id = $2::uuid AND step_index > $3
                    """,
                    norm_run_id,
                    str(user_id).strip(),
                    target_step,
                )
            else:
                await conn.execute(
                    """
                    DELETE FROM public.run_checkpoints
                    WHERE run_id = $1::uuid AND step_index > $2
                    """,
                    norm_run_id,
                    target_step,
                )

    return checkpoint


async def rewind_to_checkpoint(
    run_id: str,
    step_index: int,
    user_id: str | None = None,
    *,
    pool: Any = None,
) -> dict[str, Any]:
    """Rewind a run's state to a specific checkpoint and discard forward steps."""
    return await resume_from_checkpoint(
        run_id,
        step_index=step_index,
        user_id=user_id,
        prune_subsequent=True,
        pool=pool,
    )


__all__ = [
    "CheckpointError",
    "CheckpointOwnershipError",
    "CheckpointIntegrityError",
    "CheckpointNotFoundError",
    "CheckpointStoreUnavailable",
    "compute_state_hash",
    "verify_checkpoint_hash",
    "save_checkpoint",
    "get_checkpoint",
    "list_checkpoints",
    "get_latest_checkpoint",
    "resume_from_checkpoint",
    "rewind_to_checkpoint",
]
