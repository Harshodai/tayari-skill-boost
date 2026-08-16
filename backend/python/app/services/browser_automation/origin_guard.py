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
``CredentialEntryBlockedError`` (subclass of ``OriginGuardError``); the agent loop catches that, logs it, and aborts the run
with ``status='blocked_origin_guard'`` — nothing is typed into the field.
"""

from __future__ import annotations

import logging
import re
from typing import Any
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

__all__ = [
    "OriginGuardError",
    "CredentialEntryBlockedError",
    "extract_origin",
    "is_allowed_origin",
    "is_approved_ats_domain",
    "APPROVED_ATS_DOMAINS",
    "credential_field_heuristic",
    "assert_origin_for_credential_entry",
    "assert_strict_ats_origin",
    "route_to_human_handoff",
]


class OriginGuardError(RuntimeError):
    """Raised when a credential fill is attempted on a disallowed origin."""


class CredentialEntryBlockedError(OriginGuardError):
    """Raised when credential/sensitive/captcha fields are encountered during automated browsing."""


_CREDENTIAL_LABEL_RE = re.compile(
    r"\b(?:password|passwd|passcode|pwd)\b"
    r"|\b(?:sign[\s.\-]?in|login|log[\s.\-]?in|credentials?)\b"
    r"|\b(?:2fa|mfa|otp|pin|pin[\s.\-]?code)\b"
    r"|\b(?:verification|auth(?:entication)?|security)[\s.\-]?code\b"
    r"|\bauthenticator\b"
    r"|\b(?:ssn|social\s+security(?:\s+number)?|national\s+id|tax\s+id)\b"
    r"|\b(?:secret|security)\s+question\b"
    r"|\bmother'?s\s+maiden\s+name\b"
    r"|\b(?:captcha|recaptcha|hcaptcha|turnstile|cloudflare\s+challenge|bot\s+verification|bot\s+detection)\b"
    r"|email.{0,12}password",
    re.IGNORECASE,
)

APPROVED_ATS_DOMAINS: tuple[str, ...] = (
    "greenhouse.io",
    "lever.co",
    "workday.com",
    "myworkdayjobs.com",
    "ashbyhq.com",
    "smartrecruiters.com",
    "icims.com",
    "taleo.net",
    "successfactors.com",
    "bamboohr.com",
    "jobvite.com",
    "workable.com",
    "recruitee.com",
    "rippling.com",
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


def is_approved_ats_domain(url_or_host: str) -> bool:
    """True when the URL or hostname belongs to an approved ATS provider."""
    if not url_or_host:
        return False
    target = url_or_host.strip().lower()
    if "://" in target or "/" in target:
        try:
            parsed = urlparse(target if "://" in target else f"https://{target}")
            host = (parsed.hostname or "").lower()
        except Exception:
            return False
    else:
        host = target
    host = host.rstrip(".")
    for domain in APPROVED_ATS_DOMAINS:
        if host == domain or host.endswith(f".{domain}"):
            return True
    return False


def assert_strict_ats_origin(
    current_url: str,
    start_url: str = "",
    allowed_origins: list[str] | None = None,
) -> None:
    """Validate that current_url matches an approved ATS domain, the start_url origin,
    or an explicit entry in allowed_origins.
    """
    if is_approved_ats_domain(current_url):
        return

    start_origin = extract_origin(start_url)
    allowed = {o for o in (extract_origin(o) for o in (allowed_origins or [])) if o}
    if start_origin:
        allowed.add(start_origin)

    current_origin = extract_origin(current_url)
    if current_origin and current_origin in allowed:
        return

    raise CredentialEntryBlockedError(
        f"origin '{current_origin or '<unknown>'}' is not an approved ATS domain or allowed origin; "
        f"approved ATS list: {APPROVED_ATS_DOMAINS}"
    )


def credential_field_heuristic(label: str) -> bool:
    """True when ``label`` looks like a credential entry or human-gate field.

    Matches password / login / sign-in / 2FA / MFA / OTP / PIN / SSN /
    secret question / CAPTCHA (recaptcha, hcaptcha, turnstile) labels,
    including the ``email + password`` composite login form pattern.
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
    """Raise ``CredentialEntryBlockedError`` if a credential fill is unsafe here.

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

    raise CredentialEntryBlockedError(
        f"credential entry blocked on origin '{current_origin or '<unknown>'}'; "
        f"allowed origins: {sorted(allowed) or '<start origin only>'}"
    )


async def route_to_human_handoff(
    field_label: str,
    *,
    user_id: str | None = None,
    run_id: str | None = None,
    job_title: str | None = None,
    company: str | None = None,
    current_url: str | None = None,
    application_id: str | None = None,
) -> dict[str, Any]:
    """Enqueue a human handoff for a blocked credential or sensitive question."""
    from app.services.question_queue import enqueue_questions, normalize_field_key, sensitivity_class

    normalized_key = normalize_field_key(field_label)
    sens_class = "credential" if credential_field_heuristic(field_label) else sensitivity_class(field_label)

    question_payload = [
        {
            "field_label": field_label,
            "field_key": normalized_key,
            "sensitivity_class": sens_class,
            "field_type": "text",
            "options": [],
            "redacted_context": f"Credential/security field '{field_label}' requires direct human entry. Automation paused for safety.",
        }
    ]

    written = 0
    if user_id:
        try:
            written = await enqueue_questions(
                question_payload,
                user_id=user_id,
                run_id=run_id,
                job_title=job_title,
                company=company,
                application_id=application_id,
            )
        except Exception as exc:
            logger.warning("origin_guard: failed to enqueue human handoff question: %s", exc)

    return {
        "status": "human_handoff_enqueued",
        "field_label": field_label,
        "enqueued": written > 0,
        "run_id": run_id,
        "user_id": user_id,
    }