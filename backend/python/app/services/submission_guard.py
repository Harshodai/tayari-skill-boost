"""Deterministic final-action guard for browser submission."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
from typing import Any

from app.services.approval_gate import job_fingerprint, resume_fingerprint


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def cover_fingerprint(cover_letter: str | None) -> str:
    return _sha256(" ".join((cover_letter or "").split()))


def canonical_form_fields(fields: Any) -> str:
    if fields is None:
        fields = {}
    if not isinstance(fields, dict):
        raise ValueError("form_fields must be an object")
    return json.dumps(fields, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def form_fields_fingerprint(fields: Any) -> str:
    return _sha256(canonical_form_fields(fields))


def application_fingerprint(
    *,
    user_id: str,
    run_id: str,
    job: dict[str, Any],
    resume_text: str,
    cover_letter: str | None,
    form_fields: Any = None,
) -> dict[str, str]:
    job_url = str(job.get("url") or "").strip()
    if not user_id or not run_id or not job_url:
        raise ValueError("user_id, run_id, and job URL are required")
    return {
        "user_id": str(user_id),
        "run_id": str(run_id),
        "job_url_sha256": job_fingerprint(job_url),
        "resume_sha256": resume_fingerprint(resume_text),
        "cover_letter_sha256": cover_fingerprint(cover_letter),
        "form_fields_sha256": form_fields_fingerprint(form_fields),
    }


def _signing_key() -> bytes | None:
    raw = os.getenv("APPROVAL_SIGNING_KEY") or os.getenv("AI_INTERNAL_TOKEN")
    return raw.encode("utf-8") if raw else None


def sign_guard(fingerprint: dict[str, str], approval_id: str) -> dict[str, str] | None:
    """Return a server-MACed guard only when a signing key is configured."""
    key = _signing_key()
    if not key or not approval_id:
        return None
    payload = {
        **fingerprint,
        "approval_id": str(approval_id),
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    payload["signature"] = hmac.new(key, canonical.encode("utf-8"), hashlib.sha256).hexdigest()
    return payload


def autonomous_submission_enabled() -> bool:
    """Return true only when an operator explicitly enables final browser submit."""
    return os.getenv("AUTONOMOUS_SUBMIT_ENABLED", "false").strip().lower() == "true"


def verify_guard(
    guard: dict[str, Any] | None,
    *,
    user_id: str,
    run_id: str,
    job: dict[str, Any],
    resume_text: str,
    cover_letter: str | None,
    form_fields: Any = None,
) -> bool:
    if not autonomous_submission_enabled():
        return False
    if not isinstance(guard, dict):
        return False
    signature = str(guard.get("signature") or "")
    unsigned = {key: value for key, value in guard.items() if key != "signature"}
    key = _signing_key()
    if not key or not signature:
        return False
    canonical = json.dumps(unsigned, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    expected_signature = hmac.new(key, canonical.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected_signature):
        return False
    expected = application_fingerprint(
        user_id=user_id,
        run_id=run_id,
        job=job,
        resume_text=resume_text,
        cover_letter=cover_letter,
        form_fields=form_fields,
    )
    return all(guard.get(key) == value for key, value in expected.items())
