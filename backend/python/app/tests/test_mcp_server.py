"""
Unit tests for Native FastMCP Server tools and input validation.
"""
import pytest
from pydantic import ValidationError

from app.mcp.server import InterviewPrepInput, SearchJobsInput


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
