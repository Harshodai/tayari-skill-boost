"""
Unit tests for Native FastMCP Server tools and input validation.
"""
import pytest
from pydantic import ValidationError

from app.mcp.server import (
    InterviewPrepInput,
    SearchJobsInput,
    SkillGapInput,
    MarketDemandInput,
    analyze_skill_gap,
    get_role_market_demand,
)


def test_interview_prep_input_validation():
    """Verify InterviewPrepInput enforces Literal interview_type values."""
    # Valid values
    valid_behavioral = InterviewPrepInput(
        resume_text="Resume", job_title="Engineer", interview_type="behavioral"
    )
    assert valid_behavioral.interview_type == "behavioral"

    valid_technical = InterviewPrepInput(
        resume_text="Resume", job_title="Engineer", interview_type="technical"
    )
    assert valid_technical.interview_type == "technical"

    valid_sysdesign = InterviewPrepInput(
        resume_text="Resume", job_title="Engineer", interview_type="system-design"
    )
    assert valid_sysdesign.interview_type == "system-design"

    # Default value
    default_prep = InterviewPrepInput(resume_text="Resume", job_title="Engineer")
    assert default_prep.interview_type == "behavioral"

    # Invalid value raises ValidationError
    with pytest.raises(ValidationError):
        InterviewPrepInput(
            resume_text="Resume", job_title="Engineer", interview_type="invalid-type"
        )


def test_skill_gap_input_validation():
    """Verify SkillGapInput accepts valid inputs and sets defaults."""
    inp = SkillGapInput(resume_text="Senior Python and React engineer with Docker skills")
    assert inp.resume_text.startswith("Senior Python")
    assert inp.job_description == ""
    assert inp.target_role == ""

    with pytest.raises(ValidationError):
        SkillGapInput()


def test_market_demand_input_validation():
    """Verify MarketDemandInput requires role and allows optional location."""
    inp = MarketDemandInput(role="Backend Engineer", location="Remote")
    assert inp.role == "Backend Engineer"
    assert inp.location == "Remote"

    inp_no_loc = MarketDemandInput(role="Frontend Engineer")
    assert inp_no_loc.location is None

    with pytest.raises(ValidationError):
        MarketDemandInput()


@pytest.mark.asyncio
async def test_analyze_skill_gap_mcp_tool():
    """Verify analyze_skill_gap returns structured skill matching metrics."""
    res = await analyze_skill_gap(
        SkillGapInput(
            resume_text="Experienced engineer proficient in Python, PostgreSQL, and Docker.",
            job_description="Seeking developer with Python, Go, Kubernetes, and PostgreSQL.",
        )
    )
    assert "match_score" in res
    assert "matched_skills" in res
    assert "missing_skills" in res
    assert isinstance(res["matched_skills"], list)
    assert "python" in [s.lower() for s in res["matched_skills"]]


@pytest.mark.asyncio
async def test_get_role_market_demand_mcp_tool():
    """Verify get_role_market_demand returns market demand signals."""
    res = await get_role_market_demand(
        MarketDemandInput(role="backend engineer", location="Remote")
    )
    assert "role" in res
    assert "provenance" in res
    assert res["role"] == "backend engineer"
