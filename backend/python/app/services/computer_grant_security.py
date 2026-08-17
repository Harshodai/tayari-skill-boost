"""Security primitives for Tayari Computer grants.

The local bridge receives only short-lived, signed grants. It never receives a
browser cookie, profile, password, or long-lived server credential.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from app.services.computer_control import ComputerGrant, ComputerRun


class ComputerGrantRejected(RuntimeError):
    pass


class ComputerGrantReplayUnavailable(RuntimeError):
    pass


def _canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")


def _signature(secret: str, payload: bytes) -> str:
    return hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()


def grant_payload(grant: ComputerGrant) -> bytes:
    return _canonical(grant.model_dump(mode="json"))


def sign_grant(grant: ComputerGrant, secret: str) -> str:
    if not secret:
        raise ComputerGrantRejected("computer grant signing key is not configured")
    return _signature(secret, grant_payload(grant))


def issue_grant(
    run: ComputerRun,
    *,
    audience: str,
    key_id: str,
    now: datetime | None = None,
    nonce: str | None = None,
) -> tuple[ComputerGrant, str]:
    issued_at = now or datetime.now(timezone.utc)
    grant = ComputerGrant(
        run_id=run.run_id,
        user_id=run.user_id,
        tenant_id=run.tenant_id,
        audience=audience,
        nonce=nonce or new_nonce(),
        issued_at=issued_at,
        expires_at=issued_at + timedelta(seconds=run.policy.grant_ttl_seconds),
        mode=run.mode,
        capability=run.capability,
        policy=run.policy,
        key_id=key_id,
    )
    return grant, sign_grant(grant, _secret())


class ComputerGrantReplayProtector:
    """Durable nonce claim for bridge grants.

    Development can use a bounded memory set for tests. Staging/production must
    use Redis so process restarts and multiple workers cannot reopen a nonce.
    """

    def __init__(self, redis_url: str | None = None, environment: str | None = None):
        self.redis_url = redis_url or os.getenv("COMPUTER_GRANT_REPLAY_REDIS_URL") or os.getenv("REDIS_URL")
        self.environment = (environment or os.getenv("APP_ENV", "development")).strip().lower()
        self._memory: dict[str, float] = {}

    async def claim(self, nonce: str, ttl_seconds: int = 300) -> bool:
        if self.redis_url:
            try:
                import redis.asyncio as redis

                client = redis.from_url(self.redis_url, decode_responses=True)
                try:
                    return bool(await client.set(f"tayari:computer:grant:{nonce}", "1", ex=ttl_seconds, nx=True))
                finally:
                    await client.aclose()
            except Exception as exc:  # noqa: BLE001
                if self.environment in {"staging", "production", "prod"}:
                    raise ComputerGrantReplayUnavailable("durable computer-grant replay protection is unavailable") from exc
        if self.environment in {"staging", "production", "prod"}:
            raise ComputerGrantReplayUnavailable("computer-grant replay protection requires Redis in this environment")
        now = time.time()
        self._memory = {key: expiry for key, expiry in self._memory.items() if expiry > now}
        if nonce in self._memory:
            return False
        if len(self._memory) >= 4096:
            oldest = min(self._memory, key=self._memory.get)
            del self._memory[oldest]
        self._memory[nonce] = now + ttl_seconds
        return True


def _secret() -> str:
    return (os.getenv("COMPUTER_BRIDGE_SIGNING_KEY") or os.getenv("TAYARI_NATIVE_CAPABILITY_TOKEN") or "").strip()


def new_nonce() -> str:
    return secrets.token_urlsafe(24)


async def verify_grant(
    grant: ComputerGrant,
    signature: str,
    *,
    expected_audience: str,
    replay_protector: ComputerGrantReplayProtector | None = None,
    secret: str | None = None,
    now: datetime | None = None,
    consume_nonce: bool = True,
) -> None:
    key = secret if secret is not None else _secret()
    if not key:
        raise ComputerGrantRejected("computer grant signing key is not configured")
    if grant.audience != expected_audience:
        raise ComputerGrantRejected("computer grant audience mismatch")
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    if grant.expires_at <= current:
        raise ComputerGrantRejected("computer grant has expired")
    if grant.issued_at > current:
        raise ComputerGrantRejected("computer grant is not yet valid")
    if len(signature) != 64 or not all(ch in "0123456789abcdef" for ch in signature):
        raise ComputerGrantRejected("invalid computer grant signature format")
    expected = sign_grant(grant, key)
    if not hmac.compare_digest(expected, signature):
        raise ComputerGrantRejected("invalid computer grant signature")
    ttl = max(1, int((grant.expires_at - current).total_seconds()))
    if not consume_nonce:
        return
    protector = replay_protector or ComputerGrantReplayProtector()
    try:
        claimed = await protector.claim(str(grant.nonce), ttl_seconds=min(ttl, 900))
    except ComputerGrantReplayUnavailable as exc:
        raise ComputerGrantRejected(str(exc)) from exc
    if not claimed:
        raise ComputerGrantRejected("computer grant nonce has already been used")
