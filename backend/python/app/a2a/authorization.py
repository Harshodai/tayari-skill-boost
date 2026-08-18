"""A2A peer and skill authorization policy.

Transport authentication is not task authorization. This module keeps the
verified peer principal separate from the untrusted message sender field and
requires exact recipient/method policy in staging and production.
"""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class A2APeerPrincipal:
    peer_id: str
    auth_mode: str
    tenant_id: str | None = None


def _environment() -> str:
    return os.getenv("APP_ENV", "development").strip().lower()


def _production_like() -> bool:
    return _environment() in {"production", "prod", "staging"}


def _parse_policy() -> dict[str, set[str]]:
    """Parse `peer=Agent.method;Agent2.method` entries.

    The policy is intentionally exact-match. Empty policy is never treated as
    allow-all in staging or production.
    """
    raw = os.getenv("A2A_ALLOWED_PEER_SKILLS", "")
    result: dict[str, set[str]] = {}
    for entry in raw.split(","):
        entry = entry.strip()
        if not entry or "=" not in entry:
            continue
        peer, skills = entry.split("=", 1)
        peer = peer.strip()
        if not peer:
            continue
        result[peer] = {skill.strip() for skill in skills.split(";") if skill.strip()}
    return result


def peer_allows(principal: A2APeerPrincipal, recipient: str, method: str) -> bool:
    """Return whether a verified peer may invoke this exact agent method."""
    if not principal.peer_id or not recipient or not method:
        return False
    if principal.auth_mode == "development_bearer" and not _production_like():
        return os.getenv("A2A_DEV_ALLOW_ALL_SKILLS", "true").strip().lower() in {"1", "true", "yes", "on"}
    allowed = _parse_policy().get(principal.peer_id, set())
    return f"{recipient}.{method}" in allowed


def card_allows(principal: A2APeerPrincipal, recipient: str, method: str) -> bool:
    """Alias used when filtering Agent Card capability disclosure."""
    return peer_allows(principal, recipient, method)


def require_tenant_binding(principal: A2APeerPrincipal) -> bool:
    """Require an explicit tenant binding for signed production federation."""
    if not _production_like() and principal.auth_mode == "development_bearer":
        return True
    return bool(principal.tenant_id and len(principal.tenant_id) <= 128)
