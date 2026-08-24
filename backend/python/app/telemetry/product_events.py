"""Privacy-safe product event contract.

Technical telemetry answers whether the system is healthy; this module records
only bounded product milestones needed to measure the candidate-controlled
funnel. Raw resumes, job descriptions, names, email addresses, URLs, and
provider payloads are rejected rather than redacted after the fact.
"""
from __future__ import annotations

import hashlib
import re
import uuid
from typing import Any, Final

from app.telemetry.publisher import publish_event


EVENTS: Final = frozenset(
    {
        "signup_completed",
        "first_useful_result",
        "job_fit_completed",
        "tailoring_completed",
        "review_package_created",
        "review_completed",
        "application_tracked",
        "interview_prep_completed",
        "product_failure",
    }
)
_ALLOWED_PROPERTY_TYPES: Final = (str, int, float, bool)
_SENSITIVE_KEY = re.compile(
    r"(resume|cover|letter|description|email|phone|name|address|url|token|secret|prompt|content|text|payload|credential|document)",
    re.IGNORECASE,
)
_SYNTHETIC_IDENTITIES = frozenset({"default_user", "candidate", "unknown", "anonymous", "system"})


class ProductEventError(ValueError):
    """Raised when an event cannot be safely recorded."""


def _actor_hash(user_id: str) -> str:
    return hashlib.sha256(user_id.encode("utf-8")).hexdigest()[:24]


def record_product_event(
    event_name: str,
    *,
    user_id: str,
    properties: dict[str, Any] | None = None,
    trace_id: str | None = None,
) -> str:
    """Validate and publish a bounded product event; return its event ID."""
    if event_name not in EVENTS:
        raise ProductEventError(f"unsupported product event: {event_name}")
    normalized_user = (user_id or "").strip()
    if not normalized_user or normalized_user.lower() in _SYNTHETIC_IDENTITIES:
        raise ProductEventError("verified user identity is required")
    safe_properties: dict[str, Any] = {}
    for key, value in (properties or {}).items():
        if _SENSITIVE_KEY.search(key):
            raise ProductEventError(f"sensitive property is not allowed: {key}")
        if not isinstance(value, _ALLOWED_PROPERTY_TYPES) or isinstance(value, bytes):
            raise ProductEventError(f"property must be a scalar: {key}")
        if isinstance(value, str) and len(value) > 120:
            raise ProductEventError(f"property is too long: {key}")
        safe_properties[key] = value
    event_id = str(uuid.uuid4())
    publish_event(
        event_name,
        trace_id or event_id,
        payload={
            "event_id": event_id,
            "actor_hash": _actor_hash(normalized_user),
            "properties": safe_properties,
        },
    )
    return event_id
