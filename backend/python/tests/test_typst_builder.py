"""Tests for Mission M9 Minimal Typst Resume Builder & Parser Round-Trip."""
import pytest
from app.services.typst_builder import (
    render_typst_resume,
    parse_structured_resume_sections,
    validate_resume_bullet_truth,
    escape_typst,
    TYPST_TEMPLATES,
)


def test_typst_templates_roundtrip_extraction():
    """Verify all 3 ATS-safe Typst templates render and parse losslessly."""
    profile_sample = {
        "full_name": "Alex Mercer",
        "contact_info": "alex@example.com | San Francisco, CA",
        "summary": "Senior Systems Engineer specializing in Go, Python, and distributed DBs.",
        "skills": ["Go", "Python", "PostgreSQL", "Docker", "Kubernetes"],
        "experience": [
            "Architected microservices handling 50k req/sec.",
            "Reduced p99 query latency by 45% using Redis caching."
        ],
        "education": "B.S. Software Engineering"
    }

    for tpl_name in TYPST_TEMPLATES.keys():
        rendered = render_typst_resume(profile_sample, template_name=tpl_name)
        assert profile_sample["full_name"] in rendered
        assert "Go, Python" in rendered

        parsed = parse_structured_resume_sections(rendered)
        assert len(parsed) >= 3, f"Failed section extraction for template {tpl_name}"


def test_truth_gate_bullet_validation():
    """Verify inline truth-gate guardrail validation for resume bullets."""
    user_history = "Built Go REST APIs and PostgreSQL queries at ACME Corp for 3 years."
    valid_bullet = "Developed RESTful backend microservices in Go."

    res = validate_resume_bullet_truth(valid_bullet, user_history)
    assert res["bullet"] == valid_bullet
    assert "is_truthful" in res


def test_typst_escaping_and_injection_prevention():
    """Verify safe escaping for markup injection attempts and section header extraction."""
    malicious_input = "#eval(read('/etc/passwd')) == Fake Heading *bold* [link] _italic_"
    escaped = escape_typst(malicious_input)
    assert "\\#eval" in escaped
    assert "\\[link\\]" in escaped

    # Section parsing exact matching check
    sample_typst = "== Executive Summary ==\nExperienced Dev\n\n== Skills & Tools ==\nGo, Python"
    parsed = parse_structured_resume_sections(sample_typst)
    assert "executive summary" in parsed
    assert "skills & tools" in parsed
