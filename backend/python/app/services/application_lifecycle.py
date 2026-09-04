"""Canonical application lifecycle and optimistic transition checks.

The legacy ``status`` field is retained for API compatibility, while callers can
use ``lifecycle_state`` and ``lifecycle_version`` to distinguish preparation,
review, approval, attempts, receipts, and external verification. This module is
pure and persistence-agnostic so database-backed callers can apply the same
rules inside an atomic transaction.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Final


PREPARED: Final = "prepared"
REVIEWED: Final = "reviewed"
CANDIDATE_CONFIRMED: Final = "candidate_confirmed"
APPROVED: Final = "approved"
ATTEMPTED: Final = "attempted"
RECEIPT_CONFIRMED: Final = "receipt_confirmed"
EXTERNALLY_VERIFIED: Final = "externally_verified"
FAILED: Final = "failed"
WITHDRAWN: Final = "withdrawn"

CANONICAL_STATES: Final = frozenset(
    {
        PREPARED,
        REVIEWED,
        CANDIDATE_CONFIRMED,
        APPROVED,
        ATTEMPTED,
        RECEIPT_CONFIRMED,
        EXTERNALLY_VERIFIED,
        FAILED,
        WITHDRAWN,
    }
)

# A receipt or provider response is not an external verification by itself.
# The final edge requires an independent, owner-visible verification event.
VALID_TRANSITIONS: Final = {
    PREPARED: frozenset({REVIEWED, FAILED, WITHDRAWN}),
    REVIEWED: frozenset({CANDIDATE_CONFIRMED, PREPARED, FAILED, WITHDRAWN}),
    CANDIDATE_CONFIRMED: frozenset({APPROVED, REVIEWED, FAILED, WITHDRAWN}),
    APPROVED: frozenset({ATTEMPTED, REVIEWED, FAILED, WITHDRAWN}),
    ATTEMPTED: frozenset({RECEIPT_CONFIRMED, FAILED, WITHDRAWN}),
    RECEIPT_CONFIRMED: frozenset({EXTERNALLY_VERIFIED, FAILED, WITHDRAWN}),
    EXTERNALLY_VERIFIED: frozenset({WITHDRAWN}),
    FAILED: frozenset({PREPARED, REVIEWED, WITHDRAWN}),
    WITHDRAWN: frozenset(),
}

LEGACY_TO_CANONICAL: Final = {
    "ready_to_submit": PREPARED,
    "gate_blocked": PREPARED,
    "skipped_ats_tier": PREPARED,
    "prepared_ats_difficult": PREPARED,
    "awaiting_approval": REVIEWED,
    "approval_expired_or_replayed": REVIEWED,
    "skipped_linkedin_policy": REVIEWED,
    "submitted_unverified": ATTEMPTED,
    "applied": RECEIPT_CONFIRMED,
    "apply_failed": FAILED,
}


class InvalidApplicationTransition(ValueError):
    """Raised when a lifecycle edge or optimistic version check fails."""


@dataclass(frozen=True)
class LifecycleTransition:
    state: str
    version: int


def canonical_state(value: str | None) -> str:
    """Normalize a canonical or legacy status, failing closed on unknown input."""
    candidate = (value or PREPARED).strip().lower()
    if candidate in CANONICAL_STATES:
        return candidate
    if candidate in LEGACY_TO_CANONICAL:
        return LEGACY_TO_CANONICAL[candidate]
    raise InvalidApplicationTransition(f"unknown application lifecycle state: {value!r}")


def can_transition(current: str | None, new: str, *, expected_version: int | None = None, version: int = 1) -> bool:
    """Return whether a transition is valid without changing state."""
    try:
        current_state = canonical_state(current)
        new_state = canonical_state(new)
    except InvalidApplicationTransition:
        return False
    if expected_version is not None and expected_version != version:
        return False
    return current_state == new_state or new_state in VALID_TRANSITIONS[current_state]


def transition(current: str | None, new: str, *, version: int = 1, expected_version: int | None = None) -> LifecycleTransition:
    """Validate a transition and return the next state/version.

    ``expected_version`` is the optimistic-concurrency guard that persistence
    callers should include in their ``UPDATE ... WHERE version = ?`` predicate.
    """
    current_state = canonical_state(current)
    new_state = canonical_state(new)
    if expected_version is not None and expected_version != version:
        raise InvalidApplicationTransition("stale application lifecycle version")
    if current_state != new_state and new_state not in VALID_TRANSITIONS[current_state]:
        raise InvalidApplicationTransition(f"illegal application transition: {current_state} -> {new_state}")
    return LifecycleTransition(new_state, version if current_state == new_state else version + 1)


# -------------------------------------------------------------------
# Canonical Application State Machine & Action Ledger (WP-03)
# -------------------------------------------------------------------
import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any

from app.services.db import get_pool

logger = logging.getLogger(__name__)

CANONICAL_RUN_STATES: Final = (
    PREPARED,
    REVIEWED,
    CANDIDATE_CONFIRMED,
    APPROVED,
    ATTEMPTED,
    RECEIPT_CONFIRMED,
    EXTERNALLY_VERIFIED,
)

ALLOWED_STATE_MACHINE_TRANSITIONS: Final = {
    PREPARED: frozenset({REVIEWED}),
    REVIEWED: frozenset({CANDIDATE_CONFIRMED}),
    CANDIDATE_CONFIRMED: frozenset({APPROVED}),
    APPROVED: frozenset({ATTEMPTED}),
    ATTEMPTED: frozenset({RECEIPT_CONFIRMED}),
    RECEIPT_CONFIRMED: frozenset({EXTERNALLY_VERIFIED}),
    EXTERNALLY_VERIFIED: frozenset(),
}


def _row_to_dict(row: Any) -> dict[str, Any]:
    if row is None:
        return {}
    d = dict(row)
    for k in ("id", "user_id", "run_id", "approval_token_id"):
        if k in d and d[k] is not None:
            d[k] = str(d[k])
    for k in ("created_at", "updated_at"):
        if k in d and hasattr(d[k], "isoformat"):
            d[k] = d[k].isoformat()
    for k in ("state_history", "receipt"):
        if k in d and isinstance(d[k], str):
            try:
                d[k] = json.loads(d[k])
            except Exception:
                pass
    return d


async def create_application_run(
    user_id: str,
    *,
    job_id: str | None = None,
    resume_version_hash: str | None = None,
    cover_letter_version_hash: str | None = None,
    initial_state: str = PREPARED,
    pool: Any = None,
) -> dict[str, Any]:
    """Create a new application run row initialized in canonical state."""
    if not user_id or not str(user_id).strip():
        raise ValueError("user_id is required")
    norm_initial = (initial_state or PREPARED).strip().lower()
    if norm_initial not in CANONICAL_RUN_STATES:
        raise InvalidApplicationTransition(f"invalid initial application state: {initial_state!r}")

    db_pool = pool or await get_pool()
    if db_pool is None:
        raise RuntimeError("database pool unavailable")

    initial_history = [
        {
            "from_state": None,
            "to_state": norm_initial,
            "actor": "system:initial",
            "evidence": {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    ]
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO public.application_runs
                (user_id, job_id, resume_version_hash, cover_letter_version_hash, state, state_history)
            VALUES
                ($1::uuid, $2, $3, $4, $5, $6::jsonb)
            RETURNING id, user_id, job_id, resume_version_hash, cover_letter_version_hash,
                      state, state_history, approval_token_id, receipt_hash, created_at, updated_at
            """,
            user_id.strip(),
            job_id,
            resume_version_hash,
            cover_letter_version_hash,
            norm_initial,
            json.dumps(initial_history),
        )
    return _row_to_dict(row)


async def get_application_run(
    run_id: str,
    user_id: str,
    *,
    pool: Any = None,
) -> dict[str, Any] | None:
    """Fetch an application run strictly scoped to the authenticated owner."""
    if not run_id or not user_id:
        return None
    db_pool = pool or await get_pool()
    if db_pool is None:
        raise RuntimeError("database pool unavailable")
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, user_id, job_id, resume_version_hash, cover_letter_version_hash,
                   state, state_history, approval_token_id, receipt_hash, created_at, updated_at
            FROM public.application_runs
            WHERE id = $1::uuid AND user_id = $2::uuid
            """,
            str(run_id).strip(),
            str(user_id).strip(),
        )
    return _row_to_dict(row) if row else None


async def transition_state(
    run_id: str,
    new_state: str,
    actor: str,
    evidence: dict[str, Any] | None = None,
    user_id: str | None = None,
    *,
    pool: Any = None,
) -> dict[str, Any]:
    """Transition application run through the canonical state graph, rejecting state skips."""
    if not run_id or not str(run_id).strip():
        raise ValueError("run_id is required")
    if not user_id or not str(user_id).strip():
        raise ValueError("user_id is required")

    norm_state = (new_state or "").strip().lower()
    if norm_state not in CANONICAL_RUN_STATES:
        raise InvalidApplicationTransition(f"unknown application state: {new_state!r}")

    current_run = await get_application_run(run_id, user_id, pool=pool)
    if not current_run:
        raise ValueError(f"application run {run_id} not found for user")

    current_state = current_run["state"]
    if current_state == norm_state:
        return current_run

    allowed_next = ALLOWED_STATE_MACHINE_TRANSITIONS.get(current_state, frozenset())
    if norm_state not in allowed_next:
        raise InvalidApplicationTransition(
            f"invalid state transition: {current_state} -> {norm_state} (reject invalid state skips)"
        )

    history = current_run.get("state_history") or []
    if isinstance(history, str):
        try:
            history = json.loads(history)
        except Exception:
            history = []

    evidence_dict = dict(evidence or {})
    approval_token_id = evidence_dict.get("approval_token_id")
    receipt_hash = evidence_dict.get("receipt_hash")

    history_entry = {
        "from_state": current_state,
        "to_state": norm_state,
        "actor": actor,
        "evidence": evidence_dict,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    updated_history = [*history, history_entry]

    db_pool = pool or await get_pool()
    if db_pool is None:
        raise RuntimeError("database pool unavailable")

    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            UPDATE public.application_runs
            SET state = $1,
                state_history = $2::jsonb,
                approval_token_id = COALESCE($3::uuid, approval_token_id),
                receipt_hash = COALESCE($4, receipt_hash),
                updated_at = NOW()
            WHERE id = $5::uuid AND user_id = $6::uuid AND state = $7
            RETURNING id, user_id, job_id, resume_version_hash, cover_letter_version_hash,
                      state, state_history, approval_token_id, receipt_hash, created_at, updated_at
            """,
            norm_state,
            json.dumps(updated_history),
            str(approval_token_id) if approval_token_id else None,
            str(receipt_hash) if receipt_hash else None,
            str(run_id).strip(),
            str(user_id).strip(),
            current_state,
        )
    if row is None:
        raise InvalidApplicationTransition(
            f"stale transition: run {run_id} state changed concurrently or not found"
        )
    return _row_to_dict(row)


async def log_action(
    run_id: str,
    user_id: str,
    action_type: str,
    idempotency_key: str,
    status: str = "pending",
    receipt: dict[str, Any] | None = None,
    external_url: str | None = None,
    *,
    pool: Any = None,
) -> dict[str, Any]:
    """Idempotently record or update an action in action_ledger."""
    if not run_id or not str(run_id).strip():
        raise ValueError("run_id is required")
    if not user_id or not str(user_id).strip():
        raise ValueError("user_id is required")
    if not action_type or not str(action_type).strip():
        raise ValueError("action_type is required")
    if not idempotency_key or not str(idempotency_key).strip():
        raise ValueError("idempotency_key is required")

    db_pool = pool or await get_pool()
    if db_pool is None:
        raise RuntimeError("database pool unavailable")

    receipt_json = json.dumps(receipt) if receipt is not None else None

    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO public.action_ledger (
                run_id, user_id, action_type, idempotency_key, attempt_count, status, receipt, external_url
            ) VALUES (
                $1::uuid, $2::uuid, $3, $4, 1, $5, $6::jsonb, $7
            )
            ON CONFLICT (run_id, idempotency_key) DO UPDATE
            SET attempt_count = action_ledger.attempt_count + 1,
                -- Never overwrite terminal statuses (completed/failed) with a retry
                status = CASE
                    WHEN action_ledger.status IN ('completed', 'failed') THEN action_ledger.status
                    ELSE EXCLUDED.status
                END,
                receipt = COALESCE(EXCLUDED.receipt, action_ledger.receipt),
                external_url = COALESCE(EXCLUDED.external_url, action_ledger.external_url)
            RETURNING id, run_id, user_id, action_type, idempotency_key, attempt_count, status, receipt, external_url, created_at
            """,
            str(run_id).strip(),
            str(user_id).strip(),
            action_type.strip(),
            idempotency_key.strip(),
            status.strip(),
            receipt_json,
            external_url,
        )
    return _row_to_dict(row)


record_action = log_action


async def reconcile_receipt(
    run_id: str,
    receipt_hash: str,
    user_id: str,
    *,
    pool: Any = None,
) -> dict[str, Any]:
    """Validate receipt against action ledger before advancing run to receipt_confirmed."""
    if not run_id or not str(run_id).strip():
        raise ValueError("run_id is required")
    if not receipt_hash or not str(receipt_hash).strip():
        raise ValueError("receipt_hash is required")
    if not user_id or not str(user_id).strip():
        raise ValueError("user_id is required")

    db_pool = pool or await get_pool()
    if db_pool is None:
        raise RuntimeError("database pool unavailable")

    # Verify that the run exists
    run = await get_application_run(run_id, user_id, pool=db_pool)
    if not run:
        raise ValueError(f"application run {run_id} not found for user")

    # Fetch ledger actions for this run & user
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, run_id, user_id, action_type, idempotency_key, attempt_count, status, receipt, external_url
            FROM public.action_ledger
            WHERE run_id = $1::uuid AND user_id = $2::uuid
            """,
            str(run_id).strip(),
            str(user_id).strip(),
        )

    target_hash = receipt_hash.strip().lower()
    matching_entry: dict[str, Any] | None = None

    for r in rows:
        d = _row_to_dict(r)
        if d.get("status") == "failed":
            continue
        if (d.get("idempotency_key") or "").strip().lower() == target_hash:
            matching_entry = d
            break
        receipt_data = d.get("receipt")
        if isinstance(receipt_data, dict):
            r_hash = str(
                receipt_data.get("receipt_hash")
                or receipt_data.get("hash")
                or receipt_data.get("confirmation_number")
                or ""
            ).strip().lower()
            if r_hash == target_hash:
                matching_entry = d
                break
            computed_sha = hashlib.sha256(json.dumps(receipt_data, sort_keys=True).encode("utf-8")).hexdigest()
            if computed_sha.lower() == target_hash:
                matching_entry = d
                break

    if not matching_entry:
        raise ValueError(f"receipt hash {receipt_hash} not validated against action ledger for run {run_id}")

    return await transition_state(
        run_id=run_id,
        new_state=RECEIPT_CONFIRMED,
        actor="system:reconciliation",
        evidence={
            "receipt_hash": receipt_hash,
            "ledger_id": matching_entry.get("id"),
            "action_type": matching_entry.get("action_type"),
        },
        user_id=user_id,
        pool=db_pool,
    )
