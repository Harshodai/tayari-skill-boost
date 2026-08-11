"""Tests for the ghost-job legitimacy checker (2026-08-11 urgency/salary rework).

Covers the paired-range salary detection, the removal of generic
calls-to-action from the urgency signal, and the deadline-aware urgency
factor.
"""

from __future__ import annotations

from app.guardrails.legitimacy_checker import LegitimacyChecker


def test_wide_paired_salary_range_is_detected():
    assert LegitimacyChecker._detect_wide_salary_range("Salary $40k to $140k DOE.") is True


def test_normal_paired_salary_range_not_flagged():
    assert LegitimacyChecker._detect_wide_salary_range("Salary $160k-$180k base.") is False


def test_salary_plus_bonus_is_not_a_range():
    assert LegitimacyChecker._detect_wide_salary_range("$120k salary plus $20k signing bonus") is False


def test_unpaired_amounts_not_a_range():
    assert LegitimacyChecker._detect_wide_salary_range("We pay $80k and also $200k total comp") is False


def _long(desc: str) -> str:
    """Pad a description past the 200-char vague-description threshold so
    only the signal under test moves the score, and include a requirements
    hint so the missing-requirements factor does not fire either."""
    return desc.ljust(200, ".") + " Requirements section follows."


def test_apply_now_alone_adds_no_urgency():
    result = LegitimacyChecker.evaluate_posting_legitimacy(
        "Dev", _long("We are hiring for a well-defined role. Apply now.")
    )
    assert result["ghost_job_risk_score"] == 0.0
    assert not any("urgency" in f.lower() for f in result["risk_factors"])


def test_urgent_hire_adds_urgency_factor():
    result = LegitimacyChecker.evaluate_posting_legitimacy(
        "Dev", _long("We are hiring for a well-defined role. Urgent hire.")
    )
    assert result["ghost_job_risk_score"] == 15.0
    assert any(f == "Urgency cue with no deadline" for f in result["risk_factors"])


def test_urgent_hire_with_explicit_deadline_keeps_urgency_factor():
    result = LegitimacyChecker.evaluate_posting_legitimacy(
        "Dev", _long("Urgent hire. Applications close by Dec 15.")
    )
    assert result["ghost_job_risk_score"] == 15.0
    assert any(f == "Urgent hire with explicit deadline" for f in result["risk_factors"])


def test_explicit_deadline_alone_adds_no_urgency():
    result = LegitimacyChecker.evaluate_posting_legitimacy(
        "Dev", _long("We are hiring for a well-defined role. Applications close by Dec 15.")
    )
    assert result["ghost_job_risk_score"] == 0.0
    assert not any("urgency" in f.lower() for f in result["risk_factors"])


def test_deadline_detection_matches_explicit_mentions():
    assert LegitimacyChecker._extract_application_deadline("applications close by Dec 15") is True
    assert LegitimacyChecker._extract_application_deadline("apply by 12/31/2026") is True
    assert LegitimacyChecker._extract_application_deadline("deadline is January 30") is True
    assert LegitimacyChecker._extract_application_deadline("we hire year-round") is False


def test_deadline_detection_rejects_unrelated_dates_without_context():
    # A standalone calendar date with no application/deadline cue nearby
    # must NOT fire the deadline factor — "Founded Jan 15" is company history.
    # (The helper expects already-lowered input, matching its caller.)
    assert LegitimacyChecker._extract_application_deadline("founded jan 15") is False
    assert LegitimacyChecker._extract_application_deadline("est. 2010, profitable since") is False
    # The same date WITH a deadline cue nearby must count.
    assert LegitimacyChecker._extract_application_deadline("apply before jan 15") is True
    assert LegitimacyChecker._extract_application_deadline("submit by 12/31/2026") is True
