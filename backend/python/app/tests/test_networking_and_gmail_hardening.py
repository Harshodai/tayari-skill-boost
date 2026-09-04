"""Tests for WP-13 (Gmail Hardening) and WP-16 (Networking Intelligence)."""
import pytest
from app.services.outreach_copilot import (
    generate_company_brief,
    generate_contact_hypotheses,
    check_recent_outreach_duplicate,
    _predicted_emails,
)


def test_company_brief_has_provenance():
    brief = generate_company_brief("Acme Tech", "acme.io")
    assert brief["company_name"] == "Acme Tech"
    assert brief["domain"] == "acme.io"
    # recent_news must be a list — fabricated entries were removed per fix #5
    assert isinstance(brief["recent_news"], list)
    # All entries (if any) must have a url key
    assert all("url" in n for n in brief["recent_news"])
    # provenance must be present and mark data as hypothetical
    assert brief.get("provenance") == "hypothetical"
    assert brief.get("verified") is False


def test_contact_hypotheses_labeled_with_confidence_and_verify_url():
    hypotheses = generate_contact_hypotheses("Stripe", "Backend Engineer")
    assert len(hypotheses) >= 2
    for h in hypotheses:
        assert h["confidence"] in ("low", "medium", "high")
        assert "verify_url" in h
        assert "basis" in h


def test_duplicate_outreach_detection():
    past = [
        {"company": "Google", "recipient": "john@google.com", "days_ago": 12},
        {"company": "Meta", "recipient": "jane@meta.com", "days_ago": 45},
    ]
    # Google was reached 12 days ago -> duplicate
    assert check_recent_outreach_duplicate(past, "Google", "other@google.com") is True
    # Meta was reached 45 days ago (> 30) -> allowed
    assert check_recent_outreach_duplicate(past, "Meta", "jane@meta.com") is False
    # Apple was never reached -> allowed
    assert check_recent_outreach_duplicate(past, "Apple", "recruiter@apple.com") is False


def test_predicted_emails_labeled_as_predictions():
    emails = _predicted_emails("Alex Turner", "Vercel")
    assert len(emails) >= 3
    assert any("alex" in e for e in emails)
    assert any("vercel.com" in e for e in emails)
