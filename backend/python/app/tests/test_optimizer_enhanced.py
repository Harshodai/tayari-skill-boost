import pytest
from unittest import mock
from fastapi import HTTPException
from pydantic import ValidationError

from app.api import ai_routes
from app.api.ai_routes import OptimizerRequest, _transition_payload, _validate_public_url
from app.services.optimizer import (
    analyze_keyword_gaps,
    remove_ai_buzzwords,
    validate_master_alignment,
    generate_metric_suggestions,
)


def test_optimizer_request_accepts_all_inputs():
    req = OptimizerRequest(
        resume_text="resume",
        job_description="jd",
        custom_instructions="emphasize leadership",
        target_role="Senior Engineer",
        jd_url="https://boards.greenhouse.io/example",
    )
    assert req.custom_instructions == "emphasize leadership"
    assert req.target_role == "Senior Engineer"
    assert req.jd_url == "https://boards.greenhouse.io/example"


def test_optimizer_request_valid_transition():
    req = OptimizerRequest(
        resume_text="resume",
        transition_type="same_domain",
        current_industry="Software Development",
        target_industry="Fintech",
        transferable_skills=["Python", "System Design"],
    )
    assert req.transition_type == "same_domain"
    assert req.current_industry == "Software Development"
    assert req.target_industry == "Fintech"
    assert req.transferable_skills == ["Python", "System Design"]


def test_optimizer_request_invalid_transition_type():
    with pytest.raises(ValidationError):
        OptimizerRequest(
            resume_text="resume",
            transition_type="invalid_domain",
            current_industry="Tech",
            target_industry="Finance",
            transferable_skills=["Python"],
        )


def test_optimizer_request_missing_transition_fields():
    # Missing current_industry
    with pytest.raises(ValidationError) as exc_info1:
        OptimizerRequest(
            resume_text="resume",
            transition_type="cross_domain",
            target_industry="Healthcare",
            transferable_skills=["Data Analysis"],
        )
    assert "current_industry is required" in str(exc_info1.value)

    # Empty target_industry
    with pytest.raises(ValidationError) as exc_info2:
        OptimizerRequest(
            resume_text="resume",
            transition_type="cross_domain",
            current_industry="Tech",
            target_industry="   ",
            transferable_skills=["Data Analysis"],
        )
    assert "target_industry is required" in str(exc_info2.value)

    # Empty transferable_skills
    with pytest.raises(ValidationError) as exc_info3:
        OptimizerRequest(
            resume_text="resume",
            transition_type="same_domain",
            current_industry="Tech",
            target_industry="Finance",
            transferable_skills=[],
        )
    assert "transferable_skills must be a non-empty list" in str(exc_info3.value)


def test_optimizer_request_rejects_whitespace_skills():
    with pytest.raises(ValidationError) as exc_info:
        OptimizerRequest(
            resume_text="resume",
            transition_type="same_domain",
            current_industry="Tech",
            target_industry="Finance",
            transferable_skills=["Python", "   "],
        )
    assert "transferable_skills entries must be non-empty" in str(exc_info.value)


def test_transition_payload_helper():
    # Non-transition mode returns None
    req_no_trans = OptimizerRequest(resume_text="resume", transition_type="")
    assert _transition_payload(req_no_trans) is None

    req_none = OptimizerRequest(resume_text="resume")
    assert _transition_payload(req_none) is None

    # Valid transition mode returns expected dict
    req_trans = OptimizerRequest(
        resume_text="resume",
        transition_type="same_domain",
        current_industry="  Gaming  ",
        target_industry="  EdTech  ",
        transferable_skills=["Game Dev", "C++"],
    )
    payload = _transition_payload(req_trans)
    assert payload == {
        "transition_type": "same_domain",
        "current_industry": "Gaming",
        "target_industry": "EdTech",
        "transferable_skills": ["Game Dev", "C++"],
    }

    # Padded skill entries are trimmed in the payload built for the optimizer
    req_padded = OptimizerRequest(
        resume_text="resume",
        transition_type="same_domain",
        current_industry="Tech",
        target_industry="Finance",
        transferable_skills=["  Game Dev ", "C++"],
    )
    payload_padded = _transition_payload(req_padded)
    assert payload_padded["transferable_skills"] == ["Game Dev", "C++"]


def test_validate_public_url_rejects_loopback():
    with pytest.raises(HTTPException) as excinfo:
        _validate_public_url("http://127.0.0.1:8080/job")
    assert excinfo.value.status_code == 400


def test_validate_public_url_accepts_public_host():
    safe = _validate_public_url("https://boards.greenhouse.io/jobs/123")
    assert safe == "https://boards.greenhouse.io/jobs/123"


@pytest.mark.asyncio
async def test_optimize_with_jd_url_propagates_target_role_and_validates_url():
    options_mock = mock.AsyncMock(return_value={"optimized_text": "x"})
    with (
        mock.patch.object(ai_routes.optimizer, "optimize_resume_with_options", options_mock),
        mock.patch.object(ai_routes, "_validate_public_url", return_value="https://example.com/job"),
    ):
        result = await ai_routes.optimize_resume(
            OptimizerRequest(
                resume_text="resume",
                target_role="Staff Engineer",
                jd_url="https://example.com/job",
            )
        )
        assert result is not None
        assert isinstance(result, dict)
        options_mock.assert_awaited_once()
        kwargs = options_mock.await_args.kwargs
        assert kwargs["jd_url"] == "https://example.com/job"
        assert kwargs["target_role"] == "Staff Engineer"


@pytest.mark.asyncio
async def test_optimize_with_invalid_jd_url_rejected_before_scraper():
    options_mock = mock.AsyncMock()
    with mock.patch.object(ai_routes.optimizer, "optimize_resume_with_options", options_mock):
        with pytest.raises(HTTPException) as excinfo:
            await ai_routes.optimize_resume(
                OptimizerRequest(
                    resume_text="resume",
                    target_role="Staff Engineer",
                    jd_url="http://127.0.0.1:8080/job",
                )
            )
    assert excinfo.value.status_code == 400
    options_mock.assert_not_awaited()


def test_analyze_keyword_gaps():
    master_text = "Experienced in Python development, Docker, and SQL."
    tailored_text = "Experienced in Docker and SQL."
    jd_text = "Required skills: Python, Docker, SQL, Kubernetes"
    
    injectable, non_injectable = analyze_keyword_gaps(tailored_text, master_text, jd_text)
    
    # Python is in master and missing from tailored -> injectable
    assert "python" in injectable
    # Kubernetes is not in master and missing from tailored -> non_injectable
    assert "kubernetes" in non_injectable


def test_remove_ai_buzzwords():
    text = "We leveraged our world-class synergies in order to achieve results."
    # If "synergies" is present in JD, it should be protected from removal
    jd_text = "Looking for candidate with strong synergies."
    
    cleaned, removed = remove_ai_buzzwords(text, jd_text)
    
    # "leveraged" should be replaced with "used"
    assert "used" in cleaned
    # "world-class" should be replaced with "high-quality"
    assert "high-quality" in cleaned
    # "synergies" should remain because it's in the JD
    assert "synergies" in cleaned
    # "in order to" should be replaced with "to"
    assert "to" in cleaned


def test_validate_master_alignment():
    # Setup master resume text with standard sections
    master_text = "SUMMARY:\nDeveloper\nSKILLS:\nPython, SQL\nCERTIFICATIONS:\nAWS Certified Developer"
    # Setup tailored resume text with fabricated details
    tailored_text = "SUMMARY:\nDeveloper\nSKILLS:\nPython, SQL, Rust\nCERTIFICATIONS:\nAWS Certified Developer\nCertified Kubernetes Administrator"
    
    report = validate_master_alignment(tailored_text, master_text)
    
    assert not report["is_aligned"]
    violations = report["violations"]
    violation_values = [v["value"] for v in violations]
    
    # Rust was fabricated
    assert "rust" in violation_values
    # CKA was fabricated
    assert "certified kubernetes administrator" in violation_values


def test_generate_metric_suggestions():
    text = "- Led a team to build the backend service.\n- Decreased latency for the API endpoints."
    suggestions = generate_metric_suggestions(text)

    assert len(suggestions) > 0
    # The first bullet should have a quantification suggestion (generic or specific)
    first = suggestions[0].lower()
    assert any(kw in first for kw in [
        "quantif", "metric", "result", "estimate", "improve", "impact", "scale"
    ]), f"Expected a quantification suggestion, got: {suggestions[0]}"
    # The second bullet mentions latency — should get a performance-specific suggestion
    assert len(suggestions) > 1
    second = suggestions[1].lower()
    assert any(kw in second for kw in [
        "latency", "performance", "speed", "estimate"
    ]), f"Expected a latency suggestion, got: {suggestions[1]}"
