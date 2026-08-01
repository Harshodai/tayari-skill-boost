"""Tests for ats_engine keyword extraction and 5-dimension fit scoring (audit findings A-D)."""

from __future__ import annotations

import pytest

from app.services.ats_engine import evaluate_5d_fit, extract_jd_keywords


# --- Finding D: special-char-aware, order-preserving extraction ---

def test_extract_jd_keywords_preserves_special_char_terms():
    terms = extract_jd_keywords("Need C++ and .NET engineers with C# and node.js experience.")
    assert "C++" in terms
    assert ".NET" in terms
    assert "node.js" in terms
    # C# (2 chars) is below the pre-audit vocabulary floor; only C++/.NET survival was required.


def test_extract_jd_keywords_does_not_swallow_sentence_period():
    terms = extract_jd_keywords("We need Python, SQL and Docker.")
    assert terms == ["need", "Python", "SQL", "and", "Docker"]


def test_extract_jd_keywords_first_seen_order_and_dedup():
    assert extract_jd_keywords("C++ Python C++ SQL .NET Python") == ["C++", "Python", "SQL", ".NET"]
    assert extract_jd_keywords("Python python PYTHON") == ["Python"]


def test_extract_jd_keywords_drops_two_char_terms():
    terms = extract_jd_keywords("Go AI in Python")
    assert "go" not in {t.lower() for t in terms}
    assert "ai" not in {t.lower() for t in terms}


# --- Finding C: explicit skills vocabulary drives technical fit ---

def test_full_score_when_all_required_skills_match():
    res = evaluate_5d_fit(
        resume_text="I know Python SQL and Docker.",
        jd_text="Python SQL Docker",
        candidate_skills=["Python", "SQL", "Docker"],
    )
    assert res["dimensions"]["technical_fit"]["score"] == 100
    assert res["dimensions"]["technical_fit"]["status"] == "evaluated"
    assert res["matched_skills"] == ["Python", "SQL", "Docker"]
    assert res["missing_skills"] == []


def test_technical_fit_matches_against_candidate_skills_not_resume_prose():
    res = evaluate_5d_fit(
        resume_text="I love data engineering and analytics deeply.",
        jd_text="Python SQL Docker",
        candidate_skills=["Python"],
    )
    assert res["dimensions"]["technical_fit"]["score"] == 33
    assert res["matched_skills"] == ["Python"]
    assert res["missing_skills"] == ["SQL", "Docker"]


def test_resume_text_fallback_when_no_candidate_skills():
    res = evaluate_5d_fit(
        resume_text="I know Python and Docker.",
        jd_text="Python SQL Docker",
    )
    assert res["dimensions"]["technical_fit"]["score"] == 66
    assert res["matched_skills"] == ["Python", "Docker"]
    assert res["missing_skills"] == ["SQL"]


# --- Finding B: compensation/logistics only when candidate constraints supplied ---

def test_comp_and_logistics_not_evaluated_by_default():
    res = evaluate_5d_fit(resume_text="Python", jd_text="Python")
    assert res["dimensions"]["compensation_fit"]["status"] == "not_evaluated"
    assert res["dimensions"]["logistics_fit"]["status"] == "not_evaluated"
    assert res["dimensions"]["technical_fit"]["status"] == "evaluated"
    assert res["dimensions"]["experience_fit"]["status"] == "evaluated"
    assert res["dimensions"]["culture_fit"]["status"] == "evaluated"


def test_overall_fit_renormalizes_without_comp_logistics_weights():
    res = evaluate_5d_fit(resume_text="", jd_text="")
    tech, exp, culture = (
        res["dimensions"]["technical_fit"]["score"],
        res["dimensions"]["experience_fit"]["score"],
        res["dimensions"]["culture_fit"]["score"],
    )
    expected = int(round((tech * 0.4 + exp * 0.2 + culture * 0.15) / 0.75))
    assert res["overall_fit_score"] == expected
    assert res["fit_score"] == res["overall_fit_score"]


def test_compensation_scored_against_jd_range():
    res = evaluate_5d_fit(
        resume_text="Python", jd_text="Python salary range $100k-$130k",
        candidate_compensation=120000,
    )
    assert res["dimensions"]["compensation_fit"]["status"] == "evaluated"
    assert res["dimensions"]["compensation_fit"]["score"] == 100


def test_compensation_below_range_scales_down():
    res = evaluate_5d_fit(
        resume_text="Python", jd_text="Python salary range $100k-$130k",
        candidate_compensation=80_000,
    )
    assert res["dimensions"]["compensation_fit"]["score"] == 80


def test_work_mode_scored_against_jd_mention():
    res = evaluate_5d_fit(
        resume_text="Python", jd_text="Python, remote-friendly team",
        candidate_work_mode="remote",
    )
    assert res["dimensions"]["logistics_fit"]["status"] == "evaluated"
    assert res["dimensions"]["logistics_fit"]["score"] == 100


def test_work_mode_mismatch_scores_low():
    res = evaluate_5d_fit(
        resume_text="Python", jd_text="Python, on-site only",
        candidate_work_mode="remote",
    )
    assert res["dimensions"]["logistics_fit"]["score"] == 40


def test_all_five_dimensions_evaluated_uses_full_weights():
    res = evaluate_5d_fit(
        resume_text="Python SQL", jd_text="Python SQL salary $100k hybrid",
        candidate_skills=["Python", "SQL"],
        candidate_compensation=120_000,
        candidate_work_mode="hybrid",
    )
    statuses = [res["dimensions"][name]["status"] for name in ("technical_fit", "experience_fit", "culture_fit", "compensation_fit", "logistics_fit")]
    assert statuses == ["evaluated"] * 5
    # tech 2/5 of {python, sql, salary, 100k, hybrid}; exp 90; culture 50; comp 100; logistics 100
    expected = int(round(40 * 0.4 + 90 * 0.2 + 50 * 0.15 + 100 * 0.15 + 100 * 0.1))
    assert res["overall_fit_score"] == expected
    assert res["dimensions"]["compensation_fit"]["score"] == 100
    assert res["dimensions"]["logistics_fit"]["score"] == 100


# --- Finding A: score invariants ---

@pytest.mark.parametrize("resume,jd,skills", [
    ("", "Python SQL", None),
    ("Python SQL Docker", "Python SQL Docker", ["Python", "SQL", "Docker"]),
    ("a" * 500, "Python SQL Docker", None),
])
def test_score_range_invariants(resume, jd, skills):
    res = evaluate_5d_fit(resume_text=resume, jd_text=jd, candidate_skills=skills)
    assert 0 <= res["overall_fit_score"] <= 100
    assert res["fit_score"] == res["overall_fit_score"]
    assert set(res["dimensions"]) == {"technical_fit", "experience_fit", "culture_fit", "compensation_fit", "logistics_fit"}
    radar_by_dimension = {entry["dimension"]: entry["score"] for entry in res["radar_metrics"]}
    assert radar_by_dimension["Technical Skills"] == res["dimensions"]["technical_fit"]["score"]
    assert radar_by_dimension["Experience Fit"] == res["dimensions"]["experience_fit"]["score"]
    assert radar_by_dimension["Compensation"] == res["dimensions"]["compensation_fit"]["score"]
    assert radar_by_dimension["Logistics"] == res["dimensions"]["logistics_fit"]["score"]


# --- Route boundary: max request-text size ---

def test_evaluate_5d_route_rejects_oversized_payload():
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    res = client.post(
        "/api/v1/ats/evaluate-5d",
        json={"resume_text": "x" * 60_000, "job_description": "y" * 60_000},
    )
    assert res.status_code == 413
