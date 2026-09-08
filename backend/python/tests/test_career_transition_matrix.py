from __future__ import annotations

import pytest
from app.services.fit_matrix_analyzer import analyze_fit_matrix


def test_fit_matrix_same_domain_transition():
    resume = "Software Engineer with 4 years experience in Python and PostgreSQL."
    job = {
        "title": "Senior Software Engineer",
        "description": "Requires Python, PostgreSQL, and Kubernetes.",
        "skills": ["python", "postgresql", "kubernetes"],
        "location": "Remote",
    }
    preferences = {
        "transition_type": "same_domain",
        "current_title": "Software Engineer",
        "target_level": "Senior",
        "transferable_skills": ["system design", "code review"],
    }

    result = analyze_fit_matrix(resume, job, preferences)
    assert result["transition_fit"]["transition_type"] == "same_domain"
    assert "Software Engineer" in result["transition_fit"]["explanation"]
    assert "Senior" in result["transition_fit"]["explanation"]


def test_fit_matrix_cross_domain_transition_and_transfer_matrix():
    resume = "Product Analyst in Healthcare analyzing clinical workflows and patient metrics using SQL."
    job = {
        "title": "FinTech Product Manager",
        "description": "Requires product strategy, SQL, and risk analytics.",
        "skills": ["product strategy", "sql", "risk analytics"],
        "location": "Remote",
    }
    preferences = {
        "transition_type": "cross_domain",
        "current_industry": "Healthcare",
        "target_industry": "FinTech",
        "transferable_skills": ["clinical analytics", "stakeholder management"],
    }

    result = analyze_fit_matrix(resume, job, preferences)
    assert result["transition_fit"]["transition_type"] == "cross_domain"
    assert "Healthcare" in result["transition_fit"]["explanation"]
    assert "FinTech" in result["transition_fit"]["explanation"]
    assert len(result["transition_fit"]["transfer_matrix"]) > 0
    first_transfer = result["transition_fit"]["transfer_matrix"][0]
    assert first_transfer["source_skill"] in preferences["transferable_skills"]
    assert "translates" in first_transfer["rationale"]
