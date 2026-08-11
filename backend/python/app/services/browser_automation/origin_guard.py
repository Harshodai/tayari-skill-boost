"""Origin allowlist guard for the browser agent (Flow 6 tier 2 / §1.5).

Security boundary
==================
The browser agent handles real credentials on real ATS portals. Indirect
prompt-injection attacks (LoginTrap, arXiv:2608.04741) can lure the agent into
navigating to an attacker-controlled page and entering credentials there.
``prompt_safety.untrusted()`` fences the JD text, but the attack surface is the
page the agent lands on, not the JD string. This module enforces a hard rule:

    The agent must NEVER enter credentials on an origin it did not start on.

``assert_origin_for_credential_entry`` is called from the agent step callback
before any field-fill action whose target label matches
``credential_field_heuristic``. If the current page's origin is not in the
allowlist (which always includes the run's start origin), it raises
``OriginGuardError``; the agent loop catches that, logs it, and aborts the run
with ``status='blocked_origin_guard'`` — nothing is typed into the field.
"""

from __future__ import annotations

import re
from urllib.parse import urlparse

__all__ = [
    "OriginGuardError",
    "extract_origin",
    "is_allowed_origin",
    "credential_field_heuristic",
    "assert_origin_for_credential_entry",
]


class OriginGuardError(RuntimeError):
    """Raised when a credential fill is attempted on a disallowed origin."""


_CREDENTIAL_LABEL_RE = re.compile(
    r"password|passwd|login|sign[\s.\-]?in|credentials|2fa|mfa|otp|verification\s+code"
    r"|email.{0,12}password",
    re.IGNORECASE,
)


def extract_origin(url: str) -> str:
    """Return ``scheme://host[:port]`` for ``url``.

    Port is included only when it is non-default for the scheme, matching how
    browsers compare origins. Returns an empty string when ``url`` is not
    parseable into an origin (callers treat that as "no origin", which never
    matches the allowlist).
    """
    if not url:
        return ""
    parsed = urlparse(url.strip())
    scheme = (parsed.scheme or "").lower()
    host = (parsed.hostname or "").lower()
    if not scheme or not host:
        return ""
    port = parsed.port
    if port is None:
        return f"{scheme}://{host}"
    default_port = 443 if scheme == "https" else 80
    if port == default_port:
        return f"{scheme}://{host}"
    return f"{scheme}://{host}:{port}"


def is_allowed_origin(url: str, allowed_origins: list[str]) -> bool:
    """True when ``url``'s origin matches one of ``allowed_origins``.

    Comparison is scheme+host+port, case-normalized. An empty/invalid ``url``
    is never allowed (it has no origin to match).
    """
    target = extract_origin(url)
    if not target:
        return False
    allowed = {extract_origin(o) for o in (allowed_origins or []) if o}
    return target in allowed


def credential_field_heuristic(label: str) -> bool:
    """True when ``label`` looks like a credential entry field.

    Matches password / login / sign-in / 2FA / MFA / OTP / verification-code
    labels, including the ``email + password`` composite login form pattern.
    The check is deliberately narrow to the credential-entry surface only;
    ordinary ATS fields (email alone, name, phone, work authorization) do not
    trip it, so the guard does not block legitimate form fills.
    """
    if not label:
        return False
    return bool(_CREDENTIAL_LABEL_RE.search(label))


def assert_origin_for_credential_entry(
    current_url: str,
    start_url: str,
    allowed_origins: list[str],
) -> None:
    """Raise ``OriginGuardError`` if a credential fill is unsafe here.

    The start_url's origin is always implicitly allowed. Extra origins come
    from the ``BROWSER_ALLOWED_ORIGINS`` env var. When ``current_url`` is on
    an origin NOT in that set, the fill is blocked before any keystroke.
    """
    start_origin = extract_origin(start_url)
    allowed = {o for o in (extract_origin(o) for o in (allowed_origins or [])) if o}
    if start_origin:
        allowed.add(start_origin)

    current_origin = extract_origin(current_url)
    if current_origin and current_origin in allowed:
        return

    raise OriginGuardError(
        f"credential entry blocked on origin '{current_origin or '<unknown>'}'; "
        f"allowed origins: {sorted(allowed) or '<start origin only>'}"
    )