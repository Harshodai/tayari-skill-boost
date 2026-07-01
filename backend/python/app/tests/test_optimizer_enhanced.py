import pytest
from app.services.optimizer import (
    analyze_keyword_gaps,
    remove_ai_buzzwords,
    validate_master_alignment,
    generate_metric_suggestions,
)


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
