from types import SimpleNamespace

from app.services.browser_library import Browser
from app.services.submission_guard import (
    application_fingerprint,
    sign_guard,
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
