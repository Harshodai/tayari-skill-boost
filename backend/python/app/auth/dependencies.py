"""Shared FastAPI authentication dependency for the AI engine.

All auth-guarded handlers import ``get_current_user`` from here instead of
defining their own copy, so JWT configuration and failure semantics live in
one place. The secret is fail-fast: a missing ``JWT_SECRET`` aborts startup
instead of silently accepting unverifiable tokens, mirroring the Go gateway.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

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


def _verify_token(token: str) -> str:
    """Verify a Bearer token and return its ``sub`` claim."""
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

    subject = payload.get("sub")
    if not subject or not isinstance(subject, str) or not subject.strip():
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return subject.strip()


async def get_current_user(authorization: Optional[str] = Header(None)) -> str:
    """Extract and derive authenticated user identity from verified JWT Bearer token claims."""
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


# Convenience alias so routers can write ``Depends(get_current_user)`` uniformly.
auth_dependency = get_current_user
