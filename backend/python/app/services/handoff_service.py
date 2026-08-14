"""Durable, owner-bound browser/user handoff tokens."""
from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from app.services.db import HITL_STATES, get_pool, transition_agent_run_for_user

HANDOFF_STATES = {
    "needs_browser_handoff",
    "needs_user_login",
    "needs_otp_or_mfa",
    "needs_captcha",
    "needs_terms_review",
    "needs_sensitive_answer",
}


def hash_handoff_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _require_owner(user_id: str) -> None:
    if not user_id or user_id == "default_user":
        raise ValueError("authenticated owner is required")


async def issue_handoff(
    run_id: str,
    user_id: str,
    state: str,
    *,
    expected_state: str | None = None,
    expected_version: int | None = None,
    ttl_seconds: int = 900,
) -> dict[str, object]:
    _require_owner(user_id)
    if state not in HANDOFF_STATES:
        raise ValueError("invalid handoff state")
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=min(max(ttl_seconds, 60), 3600))
    transitioned = await transition_agent_run_for_user(
        run_id,
        user_id,
        state,
        expected_state=expected_state,
        expected_version=expected_version,
        handoff_token_hash=hash_handoff_token(token),
        handoff_expires_at=expires_at,
    )
    if not transitioned:
        raise LookupError("run transition rejected")
    return {"run_id": run_id, "state": state, "handoff_token": token, "expires_at": expires_at.isoformat()}


async def resume_handoff(
    run_id: str,
    user_id: str,
    token: str,
    *,
    expected_state: str | None = None,
    expected_version: int | None = None,
) -> bool:
    _require_owner(user_id)
    if not token:
        return False
    pool = await get_pool()
    if not pool:
        return False
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT handoff_state, state_version, handoff_token_hash, handoff_expires_at
            FROM agent_runs
            WHERE run_id = $1 AND user_id = $2
            """,
            run_id,
            user_id,
        )
    if not row or row["handoff_state"] not in HANDOFF_STATES:
        return False
    if expected_state is not None and row["handoff_state"] != expected_state:
        return False
    if expected_version is not None and row["state_version"] != expected_version:
        return False
    expires_at = row["handoff_expires_at"]
    if expires_at and expires_at <= datetime.now(timezone.utc):
        return False
    stored_hash = row["handoff_token_hash"] or ""
    if not hmac.compare_digest(stored_hash, hash_handoff_token(token)):
        return False
    return await transition_agent_run_for_user(
        run_id,
        user_id,
        "preparing",
        expected_state=row["handoff_state"],
        expected_version=row["state_version"],
        handoff_token_hash=None,
        handoff_expires_at=None,
    )
