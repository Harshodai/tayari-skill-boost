"""Tests for the LinkedIn automation policy and its automation_engine wiring.

Covers: (a) LinkedIn submit raises; (b) LinkedIn view does NOT raise;
(c) non-LinkedIn URL does NOT raise; (d) automation_engine integration —
a LinkedIn job in the selected set is skipped, not submitted.
"""
from __future__ import annotations

import asyncio
from typing import Any
from unittest import mock
from unittest.mock import patch

import pytest

from app.services.linkedin_policy import (
    LinkedInAutomationBlocked,
    assert_not_linkedin_automation,
    is_linkedin_url,
)


def test_linkedin_submit_raises() -> None:
    with pytest.raises(LinkedInAutomationBlocked):
        assert_not_linkedin_automation("https://www.linkedin.com/jobs/view/123", "submit")


def test_linkedin_apply_raises() -> None:
    with pytest.raises(LinkedInAutomationBlocked):
        assert_not_linkedin_automation("https://linkedin.com/jobs/view/456", "apply")


def test_linkedin_view_does_not_raise() -> None:
    # Read-only actions are allowed — user can still save a posting.
    assert_not_linkedin_automation("https://www.linkedin.com/jobs/view/123", "view")


def test_linkedin_save_does_not_raise() -> None:
    assert_not_linkedin_automation("https://linkedin.com/jobs/view/456", "save")


def test_non_linkedin_url_does_not_raise() -> None:
    assert_not_linkedin_automation("https://jobs.lever.co/acme/abc", "submit")
    assert_not_linkedin_automation("https://boards.greenhouse.io/acme/123", "apply")


def test_url_without_scheme_detected() -> None:
    assert is_linkedin_url("www.linkedin.com/jobs/123")
    assert is_linkedin_url("linkedin.com/jobs/456")


def test_trailing_dot_host_is_detected() -> None:
    # A DNS-valid FQDN form ("linkedin.com.") must not bypass the policy.
    assert is_linkedin_url("https://linkedin.com./jobs/view/123")
    assert is_linkedin_url("https://www.linkedin.com./jobs/view/456")


def test_trailing_dot_submit_raises() -> None:
    with pytest.raises(LinkedInAutomationBlocked):
        assert_not_linkedin_automation("https://www.linkedin.com./jobs/view/123", "submit")


def test_scheme_relative_url_detected() -> None:
    # "//host/..." is scheme-relative (means "use the current scheme") — it
    # must resolve to the https form, not be mangled by prepending another
    # scheme ("https:////host/...") into a hostless parse.
    assert is_linkedin_url("//linkedin.com/jobs/view/123")
    assert is_linkedin_url("//www.linkedin.com/jobs/view/456")
    assert is_linkedin_url("//jobs.linkedin.com/456")
    assert not is_linkedin_url("//evil.com/jobs/view/123")


def test_scheme_relative_submit_raises() -> None:
    with pytest.raises(LinkedInAutomationBlocked):
        assert_not_linkedin_automation("//linkedin.com/jobs/view/123", "submit")


def test_scheme_relative_trailing_dot_host_detected() -> None:
    assert is_linkedin_url("//linkedin.com./jobs/view/123")


def test_empty_url_is_safe() -> None:
    assert not is_linkedin_url("")
    assert not is_linkedin_url(None)  # type: ignore[arg-type]


def test_blocked_action_message_cites_ua() -> None:
    try:
        assert_not_linkedin_automation("https://linkedin.com/jobs/1", "connect")
    except LinkedInAutomationBlocked as exc:
        assert "UA §8.2" in str(exc)
        assert exc.action == "connect"


@pytest.mark.asyncio
async def test_automation_engine_skips_linkedin_job() -> None:
    """Integration: a LinkedIn job in the selected set is marked
    skipped_linkedin_policy and Browser.apply_job_with_evidence is
    never called for it.
    """
    from app.services import automation_engine as ae

    # Clear the module-level run store so prior tests' applications don't
    # dedupe our jobs out (the store persists across tests in the same session).
    ae._autopilot_store.clear()

    linkedin_job = {
        "title": "Senior Engineer",
        "company": "Acme",
        "url": "https://www.linkedin.com/jobs/view/999",
        "description": "Job description text",
        "is_dream_company": False,
        "match_score": 80,
    }
    greenhouse_job = {
        "title": "Backend Engineer",
        "company": "Beta",
        "url": "https://boards.greenhouse.io/beta/101",
        "description": "Job description text",
        "is_dream_company": False,
        "match_score": 75,
    }

    # Force approve both jobs so the apply branch is reached.
    async def _approved(*_a: Any, **_k: Any) -> bool:
        return True

    async def _queue(*_a: Any, **_k: Any) -> str:
        return "sha-fixed"

    # Intercept the optimize step so we don't need an LLM.
    async def _optimize(*_a: Any, **_k: Any) -> dict:
        return {
            "optimized_text": "tailored resume",
            "new_heuristic_score": 90,
            "estimated_score": 90,
            "refinement_passes": 1,
            "changes": [],
            "keywords_added": [],
        }

    async def _cover(*_a: Any, **_k: Any) -> str:
        return "cover letter"

    # Spy on the browser so we can assert it was NOT called for LinkedIn.
    browser_spy = mock.Mock()
    browser_spy.apply_job_with_evidence = mock.Mock(
        return_value={"success": True, "summary": "ok", "actions": []}
    )

    # Bypass the search/select stages by monkeypatching the engine to
    # treat our two jobs as the selected set.
    config = {
        "user_id": "u1",
        "job_titles": ["Engineer"],
        "dream_companies": [],
        "location": "Remote",
        "max_applications": 5,
        "auto_apply": True,
    }

    # Patch run_autopilot internals by injecting a fake selected set:
    # patch smart_search + search_jobs to return our jobs, and the posting
    # screen to always clear. Use patch.object context managers so the
    # attribute reassignments revert at exit — raw `ae.X = ...` leaks across
    # tests and silently breaks test_ats_tiers.py's smart_search patch.
    async def _smart_search(*_a: Any, **_k: Any) -> dict:
        return {"results": [linkedin_job, greenhouse_job]}

    async def _search_jobs(*_a: Any, **_k: Any) -> list:
        return []

    def _screen_posting(*_a: Any, **_k: Any) -> dict:
        return {"status": ae._SCREEN_CLEARED, "reason": ""}

    # Silence the quality gate (passes).
    gate_mock = mock.Mock()
    gate_mock.check.return_value = {"all_passed": True, "results": {}}

    # Avoid real DB persistence.
    async def _noop_persist(*_a: Any, **_k: Any) -> None:
        return None

    async def _noop_db_append(*_a: Any, **_k: Any) -> None:
        return None

    async def _noop_save_receipt(*_a: Any, **_k: Any) -> None:
        return None

    with patch.object(ae, "_approval_granted", _approved), \
         patch.object(ae, "_queue_approval", _queue), \
         patch.object(ae, "optimize_with_reflection", _optimize), \
         patch.object(ae, "_cover_letter", _cover), \
         patch.object(ae, "Browser", browser_spy), \
         patch.object(ae, "smart_search", _smart_search), \
         patch.object(ae, "search_jobs", _search_jobs), \
         patch.object(ae, "_screen_posting", _screen_posting), \
         patch.object(ae, "_QUALITY_GATE", gate_mock), \
         patch.object(ae, "_persist_run", _noop_persist), \
         patch.object(ae, "_db_append_log", _noop_db_append), \
         patch.object(ae, "save_receipt", _noop_save_receipt), \
         patch.object(ae, "build_receipt", mock.Mock(return_value={
             "verified": True,
             "confirmation_number": "X",
             "confirmation_text": "ok",
             "ats_vendor": "greenhouse",
         })):
        resume_text = "base resume text"
        await ae.run_autopilot("run-test-1", config, profile=None, resume_text=resume_text)

        apps = ae.get_applications("run-test-1")
        by_url = {a["job"].get("url"): a for a in apps}

        linkedin_app = by_url[linkedin_job["url"]]
        # LinkedIn is skipped — either by the ATS-tier do_not_submit list or
        # by the explicit UA §8.2 policy guard. Either way it must NOT be submitted.
        assert linkedin_app["status"] in ("skipped_linkedin_policy", "skipped_ats_tier"), (
            f"LinkedIn job should be skipped, got {linkedin_app['status']!r}"
        )

        # The greenhouse job was actually submitted.
        greenhouse_app = by_url[greenhouse_job["url"]]
        assert greenhouse_app["status"] == "applied"

    # Browser was called exactly once (for the non-LinkedIn job only) —
    # the LinkedIn URL never reached the browser.
    assert browser_spy.apply_job_with_evidence.call_count == 1
    called_job = browser_spy.apply_job_with_evidence.call_args[0][0]
    assert called_job["url"] == greenhouse_job["url"]