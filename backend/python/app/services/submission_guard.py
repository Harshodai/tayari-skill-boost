"""Deterministic final-action guard for browser submission."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any

from app.services.approval_gate import job_fingerprint, resume_fingerprint
from app.services.capabilities import Capability, capability_enabled


def sign_approval(payload: dict, signing_key: str) -> dict:
    if not isinstance(payload, dict):
        raise ValueError("payload must be a dict")
    if not signing_key:
        raise ValueError("signing_key is required")
    nonce = secrets.token_hex(16)
    timestamp = int(time.time())
    payload_with_meta = {**payload, "_nonce": nonce, "_timestamp": timestamp}
    canonical = json.dumps(payload_with_meta, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    key_bytes = signing_key.encode("utf-8") if isinstance(signing_key, str) else signing_key
    signature = hmac.new(key_bytes, canonical.encode("utf-8"), hashlib.sha256).hexdigest()
    return {**payload_with_meta, "_signature": signature}


def verify_approval(signed_payload: dict, signing_key: str, max_age_seconds: int = 900) -> bool:
    if not isinstance(signed_payload, dict):
        return False
    if not signing_key:
        return False
    timestamp = signed_payload.get("_timestamp", 0)
    try:
        ts = float(timestamp)
    except (ValueError, TypeError):
        raise ValueError("Invalid timestamp")
    if time.time() - ts > max_age_seconds:
        raise ValueError("Approval expired")
    signature = str(signed_payload.get("_signature") or "")
    if not signature:
        return False
    unsigned = {k: v for k, v in signed_payload.items() if k != "_signature"}
    canonical = json.dumps(unsigned, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    key_bytes = signing_key.encode("utf-8") if isinstance(signing_key, str) else signing_key
    expected_signature = hmac.new(key_bytes, canonical.encode("utf-8"), hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature, expected_signature)


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


def sign_guard(fingerprint: dict[str, str], approval_id: str) -> dict[str, Any] | None:
    """Return a server-MACed guard only when a signing key is configured."""
    key = _signing_key()
    if not key or not approval_id:
        return None
    nonce = secrets.token_hex(16)
    timestamp = int(time.time())
    payload = {
        **fingerprint,
        "approval_id": str(approval_id),
        "nonce": nonce,
        "timestamp": timestamp,
        "_nonce": nonce,
        "_timestamp": timestamp,
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    payload["signature"] = hmac.new(key, canonical.encode("utf-8"), hashlib.sha256).hexdigest()
    return payload


def autonomous_submission_enabled() -> bool:
    """Return true only when the server-side capability and legacy flag agree."""
    legacy_flag = os.getenv("AUTONOMOUS_SUBMIT_ENABLED", "false").strip().lower() == "true"
    return legacy_flag and capability_enabled(Capability.AUTONOMOUS_ATS_SUBMIT)


def verify_guard(
    guard: dict[str, Any] | None,
    *,
    user_id: str,
    run_id: str,
    job: dict[str, Any],
    resume_text: str,
    cover_letter: str | None,
    form_fields: Any = None,
    max_age_seconds: int = 900,
) -> bool:
    if not autonomous_submission_enabled():
        return False
    if not isinstance(guard, dict):
        return False
    key = _signing_key()
    if not key:
        return False

    effective_max_age = min(max_age_seconds, 900)
    timestamp = guard.get("timestamp") if "timestamp" in guard else guard.get("_timestamp")
    if timestamp is None:
        return False
    try:
        ts = float(timestamp)
    except (ValueError, TypeError):
        return False
    if time.time() - ts > effective_max_age:
        return False

    signature = str(guard.get("signature") or guard.get("_signature") or "")
    if not signature:
        return False
    unsigned = {key: value for key, value in guard.items() if key not in ("signature", "_signature")}
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
