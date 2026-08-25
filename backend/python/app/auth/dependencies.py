"""Shared FastAPI authentication dependency for the AI engine.

All auth-guarded handlers import ``get_current_user`` from here instead of
defining their own copy, so JWT configuration and failure semantics live in
one place. The secret is fail-fast: a missing ``JWT_SECRET`` aborts startup
instead of silently accepting unverifiable tokens, mirroring the Go gateway.
"""
from __future__ import annotations

import hmac
import logging
import os
from dataclasses import dataclass
from typing import Any, Optional
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, Header

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# JWT configuration — environment precedence, fail-fast, HS-only
# ---------------------------------------------------------------------------

JWT_SECRET = os.getenv("JWT_SECRET") or os.getenv("SUPABASE_JWT_SECRET")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_ISSUER = os.getenv("JWT_ISSUER")
JWT_AUDIENCE = os.getenv("JWT_AUDIENCE")

if not JWT_SECRET:
    # ponytail: fail fast like the Go gateway — a baked-in default would silently
    # pair with supabase-local's different default and 401 every login with no
    # distinguishing error. Requires an explicit secret in any environment that
    # enables JWT-protected routes.
    raise RuntimeError(
        "JWT_SECRET is required (or SUPABASE_JWT_SECRET). Set it explicitly; "
        "no default is allowed. In Supabase mode it must match supabase-local/.env's JWT_SECRET."
    )

_SYMMETRIC_ALGORITHMS = frozenset({"HS256", "HS384", "HS512"})

if JWT_ALGORITHM not in _SYMMETRIC_ALGORITHMS:
    # ponytail: shared-secret verification only makes sense for symmetric (HS*)
    # algorithms. Reject asymmetric choices before any token is verified so an
    # operator cannot silently run a mode the secret can't support.
    raise RuntimeError(
        f"JWT_ALGORITHM={JWT_ALGORITHM!r} is not supported for shared-secret "
        f"verification; use one of {sorted(_SYMMETRIC_ALGORITHMS)}."
    )


def _decode_token(token: str) -> dict[str, Any]:
    """Verify a bearer token and return its claims."""
    options = {
        "verify_signature": True,
        "verify_exp": True,
        "verify_iss": bool(JWT_ISSUER),
        "verify_aud": bool(JWT_AUDIENCE),
        "require": ["exp", "sub"],
    }
    if JWT_ISSUER:
        options["require"].append("iss")
    if JWT_AUDIENCE:
        options["require"].append("aud")
    payload = jwt.decode(
        token,
        JWT_SECRET,
        algorithms=[JWT_ALGORITHM],
        options=options,
        issuer=JWT_ISSUER if JWT_ISSUER else None,
        audience=JWT_AUDIENCE if JWT_AUDIENCE else None,
    )
    if not isinstance(payload, dict):
        raise HTTPException(status_code=401, detail="Invalid or missing authentication credentials")
    subject = payload.get("sub")
    if not subject or not isinstance(subject, str) or not subject.strip():
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


def _verify_token(token: str) -> str:
    """Verify a Bearer token and return its ``sub`` claim."""
    return str(_decode_token(token)["sub"]).strip()


@dataclass(frozen=True)
class VerifiedRequestContext:
    subject: str
    tenant_id: str


def _uuid_text(value: str | None, label: str) -> str:
    if not value or not value.strip():
        raise HTTPException(status_code=401, detail=f"verified {label} is required")
    try:
        return str(UUID(value.strip()))
    except (ValueError, AttributeError) as exc:
        raise HTTPException(status_code=401, detail=f"verified {label} is invalid") from exc


async def get_current_user(
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_internal_token: Optional[str] = Header(None, alias="X-Internal-Token"),
) -> str:
    """Return a verified user from a Bearer token or the trusted Go gateway.

    The gateway already verifies the user's JWT, then forwards the canonical
    UUID in ``X-User-Id`` alongside the service-only internal token. Direct
    callers still need a valid Bearer token; an arbitrary identity header never
    grants access on its own.
    """
    if x_internal_token:
        configured_token = os.getenv("AI_INTERNAL_TOKEN", "")
        if configured_token and hmac.compare_digest(x_internal_token, configured_token):
            if x_user_id and x_user_id.strip():
                try:
                    return str(UUID(x_user_id.strip()))
                except (ValueError, AttributeError):
                    return x_user_id.strip()
            # A valid internal token with no forwarded user identity must fail
            # closed, not synthesize one: CLAUDE.md bans default_user/synthetic
            # identities, and a fabricated UUID here previously masked a real
            # Go-side bug (call sites that dropped X-User-Id) as a silent
            # misattribution instead of a loud failure.
            raise HTTPException(status_code=401, detail="X-User-Id is required with the internal service token")

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1].strip()
    if not token or token == "demo-user":
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        return _verify_token(token)
    except HTTPException:
        raise
    except jwt.PyJWTError as exc:
        # ponytail: authentication failures are always 401; do not leak internals.
        logger.info("JWT verification failed: %s", exc)
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except Exception as exc:  # noqa: BLE001
        # Unexpected failures (e.g. a bug in decoding options) must NOT be
        # converted to 401 — they are server faults. Log them separately and
        # let the generic error path produce a 500.
        logger.exception("Unexpected error during JWT verification: %s", exc)
        raise


async def get_verified_context(
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-Id"),
    x_internal_token: Optional[str] = Header(None, alias="X-Internal-Token"),
) -> VerifiedRequestContext:
    """Return a verified subject/tenant pair for multi-tenant control routes.

    The internal-token branch is only valid for the Go gateway, which must
    derive both values from its immutable authorization context. Direct bearer
    callers must carry a verified ``tenant_id`` claim; a caller-supplied header
    alone never establishes tenant authority.
    """
    if x_internal_token:
        configured_token = os.getenv("AI_INTERNAL_TOKEN", "")
        if configured_token and hmac.compare_digest(x_internal_token, configured_token):
            return VerifiedRequestContext(
                subject=_uuid_text(x_user_id, "user identity"),
                tenant_id=_uuid_text(x_tenant_id, "tenant identity"),
            )

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Invalid or missing authentication credentials", headers={"WWW-Authenticate": "Bearer"})
    token = authorization.split(" ", 1)[1].strip()
    if not token or token == "demo-user":
        raise HTTPException(status_code=401, detail="Invalid or missing authentication credentials", headers={"WWW-Authenticate": "Bearer"})
    try:
        claims = _decode_token(token)
        return VerifiedRequestContext(
            subject=_uuid_text(str(claims.get("sub") or ""), "user identity"),
            tenant_id=_uuid_text(str(claims.get("tenant_id") or ""), "tenant identity"),
        )
    except HTTPException:
        raise
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or missing authentication credentials", headers={"WWW-Authenticate": "Bearer"}) from exc


# Convenience alias so routers can write ``Depends(get_current_user)`` uniformly.
auth_dependency = get_current_user
