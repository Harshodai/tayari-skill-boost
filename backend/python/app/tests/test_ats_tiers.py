"""Tests for ATS vendor tiering — audit Q8.7 / Priority Stack P3."""
from __future__ import annotations

from unittest.mock import patch

import pytest

from app.services.ats_tiers import (
    VENDOR_TIERS,
    can_auto_submit,
    should_prepare_only,
    should_skip,
    tier_for_url,
    tier_for_vendor,
)


GREENHOUSE_URL = "https://boards.greenhouse.io/company/jobs/123"
WORKDAY_URL = "https://myworkdayjobs.com/acme/en-US/job/123"
LINKEDIN_URL = "https://www.linkedin.com/jobs/view/123"
UNKNOWN_URL = "https://example.com/careers/456"


def test_greenhouse_is_friendly():
    assert tier_for_url(GREENHOUSE_URL) == "friendly"


def test_workday_is_difficult():
    assert tier_for_url(WORKDAY_URL) == "difficult"


def test_linkedin_is_do_not_submit():
    assert tier_for_url(LINKEDIN_URL) == "do_not_submit"


def test_unknown_vendor_returns_none():
    assert tier_for_url(UNKNOWN_URL) is None
    assert tier_for_vendor(None) is None
    assert tier_for_vendor("nonsense") is None


def test_can_auto_submit_only_friendly():
    assert can_auto_submit(GREENHOUSE_URL) is True
    assert can_auto_submit(WORKDAY_URL) is False
    assert can_auto_submit(LINKEDIN_URL) is False
    assert can_auto_submit(UNKNOWN_URL) is False


def test_should_prepare_only_difficult():
    assert should_prepare_only(WORKDAY_URL) is True
    assert should_prepare_only(GREENHOUSE_URL) is False
    assert should_prepare_only(LINKEDIN_URL) is False
    assert should_prepare_only(UNKNOWN_URL) is False


def test_should_skip_do_not_submit():
    assert should_skip(LINKEDIN_URL) is True
    assert should_skip(WORKDAY_URL) is False
    assert should_skip(GREENHOUSE_URL) is False
    assert should_skip(UNKNOWN_URL) is False


def test_vendor_tiers_dict_shape():
    assert VENDOR_TIERS["greenhouse"] == "friendly"
    assert VENDOR_TIERS["lever"] == "friendly"
    assert VENDOR_TIERS["ashby"] == "friendly"
    assert VENDOR_TIERS["workday"] == "difficult"
    assert VENDOR_TIERS["smartrecruiters"] == "difficult"
    assert VENDOR_TIERS["icims"] == "difficult"
    assert VENDOR_TIERS["taleo"] == "difficult"
    assert VENDOR_TIERS["successfactors"] == "difficult"
    assert VENDOR_TIERS["linkedin"] == "do_not_submit"


@pytest.mark.asyncio
async def test_automation_engine_workday_sets_prepared_status():
    """A Workday job must be prepped, not submitted, even when approved.

    Mocks Browser.apply_job_with_evidence to assert it is never called; if the
    engine tried to submit, the test fails.
    """
    from app.services import automation_engine as ae

    # Clear the module-level run store so prior tests' applications don't
    # dedupe our workday job out (the store persists across tests in the
    # same session; the LinkedIn test's linkedin_job happens to share the
    # same title+company as our workday_job).
    ae._autopilot_store.clear()

    workday_job = {
        "title": "Senior Engineer",
        "company": "Acme",
        "url": WORKDAY_URL,
        "description": "Does engineering things.",
    }

    captured_calls: list = []

    async def _no_save_receipt(receipt):
        captured_calls.append(("save_receipt", receipt["outcome"]))
        return True

    async def _no_build_prepared(*args, **kwargs):
        from app.services import submission_receipt as sr
        return sr.build_prepared_receipt(**kwargs)

    async def _fake_optimize(*args, **kwargs):
        return {"optimized_text": "tailored", "new_heuristic_score": 80,
                "estimated_score": 80, "refinement_passes": 1,
                "changes": [], "keywords_added": []}

    async def _fake_cover(*args, **kwargs):
        return "cover letter"

    async def _no_op(*args, **kwargs):
        return None

    async def _search_noop(*args, **kwargs):
        return {"results": [workday_job]}

    def _parse_resume_noop(text):
        return None

    with patch.object(ae, "Browser") as MockBrowser, \
         patch.object(ae, "save_receipt", side_effect=_no_save_receipt), \
         patch.object(ae, "_cover_letter", side_effect=_fake_cover), \
         patch.object(ae, "smart_search", side_effect=_search_noop), \
         patch.object(ae, "optimize_with_reflection", side_effect=_fake_optimize), \
         patch.object(ae, "_screen_posting", side_effect=lambda *a, **k: {"status": ae._SCREEN_CLEARED, "reason": ""}), \
         patch.object(ae, "_QUALITY_GATE") as gate, \
         patch.object(ae, "_db_create_agent_run", side_effect=_no_op), \
         patch.object(ae, "_db_update_agent_run", side_effect=_no_op), \
         patch.object(ae, "_db_append_log", side_effect=_no_op), \
         patch.object(ae, "_queue_approval", side_effect=lambda *a, **k: "fp"), \
         patch.object(ae, "_approval_granted", side_effect=lambda *a, **k: True):
        gate.check.return_value = {"all_passed": True,
                                   "results": {"truthfulness": {"passed": True},
                                               "keyword_stuffing": {"passed": True},
                                               "pii": {"passed": True}}}
        MockBrowser.apply_job_with_evidence.assert_not_called  # sentinel

        await ae.run_autopilot(
            run_id="test-tier-run",
            config={"user_id": None, "auto_apply": True, "max_applications": 1,
                    "job_titles": ["Senior Engineer"]},
            profile={},
            resume_text="base resume",
            candidate_name="Tester",
        )

    MockBrowser.apply_job_with_evidence.assert_not_called()
    store = ae._autopilot_store["test-tier-run"]
    apps = store["applications"]
    assert len(apps) == 1
    assert apps[0]["status"] == "prepared_ats_difficult"
    assert apps[0]["receipt"]["prepared"] is True
    assert any(outcome == "prepared" for _, outcome in captured_calls)