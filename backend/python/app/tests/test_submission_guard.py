import time
from types import SimpleNamespace

import pytest

from app.services.browser_library import Browser
from app.services.submission_guard import (
    application_fingerprint,
    sign_approval,
    sign_guard,
    verify_approval,
    verify_guard,
)


USER_ID = "00000000-0000-0000-0000-000000000001"
JOB = {"url": "https://jobs.example.test/roles/backend", "title": "Backend", "company": "Example"}
RESUME = "Synthetic tailored resume"
COVER = "Synthetic cover letter"
FIELDS = {"full_name": "Synthetic Candidate", "work_authorization": "yes"}


def test_guard_binds_every_submission_dimension(monkeypatch):
    monkeypatch.setenv("APPROVAL_SIGNING_KEY", "test-approval-key")
    monkeypatch.setenv("AUTONOMOUS_SUBMIT_ENABLED", "true")
    monkeypatch.setenv("CAPABILITY_AUTONOMOUS_ATS_SUBMIT", "true")
    fingerprint = application_fingerprint(
        user_id=USER_ID,
        run_id="run-1",
        job=JOB,
        resume_text=RESUME,
        cover_letter=COVER,
        form_fields=FIELDS,
    )
    guard = sign_guard(fingerprint, "approval-row-1")

    assert guard is not None
    assert verify_guard(
        guard,
        user_id=USER_ID,
        run_id="run-1",
        job=JOB,
        resume_text=RESUME,
        cover_letter=COVER,
        form_fields=FIELDS,
    ) is True
    assert verify_guard(
        guard,
        user_id=USER_ID,
        run_id="run-1",
        job=JOB,
        resume_text=RESUME,
        cover_letter="changed cover",
        form_fields=FIELDS,
    ) is False
    assert verify_guard(
        guard,
        user_id=USER_ID,
        run_id="run-1",
        job={**JOB, "url": "https://jobs.example.test/roles/other"},
        resume_text=RESUME,
        cover_letter=COVER,
        form_fields=FIELDS,
    ) is False
    assert verify_guard(
        guard,
        user_id=USER_ID,
        run_id="run-1",
        job=JOB,
        resume_text=RESUME,
        cover_letter=COVER,
        form_fields={**FIELDS, "phone": "changed"},
    ) is False


def test_browser_submission_requires_guard_and_does_not_start_agent(monkeypatch):
    started = {"count": 0}

    def fake_agent(*_args, **_kwargs):
        started["count"] += 1
        return SimpleNamespace(success=True, summary="submitted", actions=[], visited_urls=[], final_url=JOB["url"], final_screenshot=None, error=None)

    monkeypatch.setattr(Browser, "_run_agent", staticmethod(fake_agent))
    rejected = Browser.apply_job_with_evidence(JOB, RESUME, COVER, form_fields=FIELDS)
    assert rejected["error"] == "submission_guard_rejected"
    assert started["count"] == 0


def test_autonomous_submission_is_disabled_by_default(monkeypatch):
    monkeypatch.delenv("AUTONOMOUS_SUBMIT_ENABLED", raising=False)
    monkeypatch.setenv("APPROVAL_SIGNING_KEY", "test-approval-key")
    fingerprint = application_fingerprint(
        user_id=USER_ID,
        run_id="run-disabled",
        job=JOB,
        resume_text=RESUME,
        cover_letter=COVER,
        form_fields=FIELDS,
    )
    guard = sign_guard(fingerprint, "approval-disabled")
    assert guard is not None
    assert verify_guard(
        guard,
        user_id=USER_ID,
        run_id="run-disabled",
        job=JOB,
        resume_text=RESUME,
        cover_letter=COVER,
        form_fields=FIELDS,
    ) is False


def test_browser_submission_rejects_cross_origin_evidence(monkeypatch):
    monkeypatch.setenv("APPROVAL_SIGNING_KEY", "test-approval-key")
    monkeypatch.setenv("AUTONOMOUS_SUBMIT_ENABLED", "true")
    monkeypatch.setenv("CAPABILITY_AUTONOMOUS_ATS_SUBMIT", "true")
    fingerprint = application_fingerprint(
        user_id=USER_ID,
        run_id="run-2",
        job=JOB,
        resume_text=RESUME,
        cover_letter=COVER,
        form_fields=FIELDS,
    )
    guard = sign_guard(fingerprint, "approval-row-2")

    monkeypatch.setattr(
        Browser,
        "_run_agent",
        staticmethod(lambda *_args, **_kwargs: SimpleNamespace(
            success=True,
            summary="submitted",
            actions=[],
            visited_urls=[],
            final_url="https://attacker.example/confirmation",
            final_screenshot=None,
            error=None,
        )),
    )
    result = Browser.apply_job_with_evidence(
        JOB,
        RESUME,
        COVER,
        form_fields=FIELDS,
        submission_guard=guard,
    )
    assert result["error"] == "final_origin_mismatch"
    assert result["success"] is False


def test_sign_and_verify_approval_valid():
    key = "test-signing-key-12345"
    payload = {"user_id": USER_ID, "action": "apply", "job_id": "job-100"}
    signed = sign_approval(payload, key)

    assert "_nonce" in signed
    assert "_timestamp" in signed
    assert "_signature" in signed
    assert signed["user_id"] == USER_ID

    assert verify_approval(signed, key) is True


def test_verify_approval_expired():
    key = "test-signing-key-12345"
    payload = {"user_id": USER_ID, "action": "apply"}
    signed = sign_approval(payload, key)

    # Artificially age the timestamp beyond max_age_seconds (900)
    signed["_timestamp"] = int(time.time()) - 901
    # Note: verify_approval checks expiration before/with timestamp
    with pytest.raises(ValueError, match="Approval expired"):
        verify_approval(signed, key, max_age_seconds=900)


def test_verify_approval_tampered():
    key = "test-signing-key-12345"
    payload = {"user_id": USER_ID, "action": "apply"}
    signed = sign_approval(payload, key)

    # Tampering with payload
    tampered = {**signed, "action": "delete"}
    assert verify_approval(tampered, key) is False

    # Tampering with signature
    tampered_sig = {**signed, "_signature": "invalid_hex_sig"}
    assert verify_approval(tampered_sig, key) is False


def test_sign_guard_includes_nonce_and_timestamp(monkeypatch):
    monkeypatch.setenv("APPROVAL_SIGNING_KEY", "test-approval-key")
    fingerprint = application_fingerprint(
        user_id=USER_ID,
        run_id="run-meta",
        job=JOB,
        resume_text=RESUME,
        cover_letter=COVER,
        form_fields=FIELDS,
    )
    guard = sign_guard(fingerprint, "approval-meta")
    assert guard is not None
    assert "nonce" in guard
    assert "timestamp" in guard
    assert isinstance(guard["timestamp"], int)
    assert abs(time.time() - guard["timestamp"]) < 5


def test_verify_guard_enforces_max_age_and_expiry(monkeypatch):
    monkeypatch.setenv("APPROVAL_SIGNING_KEY", "test-approval-key")
    monkeypatch.setenv("AUTONOMOUS_SUBMIT_ENABLED", "true")
    monkeypatch.setenv("CAPABILITY_AUTONOMOUS_ATS_SUBMIT", "true")

    fingerprint = application_fingerprint(
        user_id=USER_ID,
        run_id="run-exp",
        job=JOB,
        resume_text=RESUME,
        cover_letter=COVER,
        form_fields=FIELDS,
    )
    guard = sign_guard(fingerprint, "approval-exp")
    assert guard is not None

    # Valid when fresh
    assert verify_guard(
        guard,
        user_id=USER_ID,
        run_id="run-exp",
        job=JOB,
        resume_text=RESUME,
        cover_letter=COVER,
        form_fields=FIELDS,
    ) is True

    # Expired guard (> 900 seconds)
    guard_expired = dict(guard)
    guard_expired["timestamp"] = int(time.time()) - 950
    assert verify_guard(
        guard_expired,
        user_id=USER_ID,
        run_id="run-exp",
        job=JOB,
        resume_text=RESUME,
        cover_letter=COVER,
        form_fields=FIELDS,
    ) is False

    # Guard without timestamp is rejected
    guard_no_ts = {k: v for k, v in guard.items() if k not in ("timestamp", "_timestamp")}
    assert verify_guard(
        guard_no_ts,
        user_id=USER_ID,
        run_id="run-exp",
        job=JOB,
        resume_text=RESUME,
        cover_letter=COVER,
        form_fields=FIELDS,
    ) is False
