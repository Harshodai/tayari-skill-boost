"""Tests for WP-08 (Factorized Fit Matrix) and WP-10 (Skill-to-Action Career Graph)."""
import pytest
from app.services.fit_matrix_analyzer import analyze_fit_matrix
from app.services.scenario_planner import plan_scenario


def test_fit_matrix_analyzer_pass():
    resume_text = "Experienced Senior Python engineer with 6 years experience in AWS, Docker, Kubernetes, and PostgreSQL."
    job = {
        "title": "Senior Backend Engineer",
        "description": "Seeking a Senior Python Engineer skilled in Docker and PostgreSQL.",
        "location": "Remote",
        "salary": "$150,000 - $180,000",
        "url": "https://boards.greenhouse.io/acme/jobs/1",
    }
    fit = analyze_fit_matrix(resume_text, job)
    assert fit["hard_constraints"]["pass"] is True
    assert fit["seniority_alignment"]["result"] == "aligned"
    assert fit["skill_alignment"]["score"] >= 50
    assert len(fit["risk_flags"]) == 0
    assert fit["recommendation"]["action"] == "strong_match"
    assert "why" in fit["recommendation"]
    assert "what_would_change" in fit["recommendation"]


def test_fit_matrix_analyzer_hard_constraint_failure():
    resume_text = "Junior Python dev"
    job = {
        "title": "Software Engineer",
        "description": "Python role",
        "location": "New York, NY",
        "url": "https://example.com/job/2",
    }
    preferences = {
        "locations": ["San Francisco, CA"],
        "open_to_remote": False,
    }
    fit = analyze_fit_matrix(resume_text, job, profile_preferences=preferences)
    assert fit["hard_constraints"]["pass"] is False
    assert fit["recommendation"]["action"] == "do_not_apply"
    assert len(fit["risk_flags"]) > 0  # Missing salary flag


def test_scenario_planner():
    skills = ["Python", "FastAPI", "Docker", "PostgreSQL", "React"]
    plan = plan_scenario("seniority_increase", skills, current_title="Senior Developer", target_role="Staff Engineer")
    assert plan["scenario"] == "seniority_increase"
    assert plan["confidence"] == "high"
    assert len(plan["transferable_skills"]) == 5
    assert len(plan["missing_skills"]) > 0
    assert "next_action" in plan
    assert plan["plan_version"].startswith("sp-")


def test_scenario_planner_none_skills_does_not_crash():
    plan = plan_scenario("role_change", None, target_role="ML Engineer")
    assert plan["transferable_skills"] == []
    assert plan["scenario"] == "role_change"


def test_scenario_planner_unknown_type_raises():
    with pytest.raises(ValueError):
        plan_scenario("bogus_type", ["Python"])


def test_scenario_planner_transferable_is_illustrative_without_numeric_confidence():
    plan = plan_scenario("role_change", ["Python"], current_title="Backend Engineer", target_role="ML Engineer")
    assert plan["transferable_skills"]
    for item in plan["transferable_skills"]:
        assert "illustrative" in item["evidence"].lower()
        assert item["confidence"] is None


def test_apply_market_counts_copies_entries():
    from app.services.scenario_planner import _apply_market_counts, _apply_salary_band
    roles = [{"title": "ML Engineer", "count": 1}]
    out = _apply_market_counts(roles, {"ML Engineer": {"provenance": "verified", "count": 42, "source": "remotive", "fetched_at": "t"}})
    assert out[0]["count"] == 42
    assert roles[0]["count"] == 1
    roles2 = [{"title": "Staff Engineer"}]
    band = {"role": "Staff Engineer", "median": 150000, "p25": 1, "p75": 2, "provenance": "verified", "scale": "wage"}
    out2 = _apply_salary_band(roles2, band)
    assert out2[0]["salary_band"]["median"] == 150000
    assert "salary_band" not in roles2[0]
