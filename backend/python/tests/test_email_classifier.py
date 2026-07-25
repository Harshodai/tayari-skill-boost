"""Tests for M5 Email Classifier, Application Matcher, and Follow-up Tracker."""
import pytest
from app.services.email_classifier import (
    classify_email_stage,
    classify_email_with_confidence,
    match_email_to_application,
    redact_pii_content,
)

# 10 Real-ish Email Fixtures across labels
EMAIL_FIXTURES = [
    # Rejection (2)
    {
        "subject": "Update on your application at Stripe",
        "body": "Unfortunately we have decided to move forward with other candidates at this time.",
        "expected_stage": "rejected",
    },
    {
        "subject": "Application Status for Senior Engineer - Google",
        "body": "We regret to inform you that we are not proceeding with your application.",
        "expected_stage": "rejected",
    },
    # Interview Invite (2)
    {
        "subject": "Stripe Virtual Interview Invitation",
        "body": "We would like to invite you for a virtual interview with our engineering team next week.",
        "expected_stage": "interview",
    },
    {
        "subject": "Technical Interview Scheduled - Meta",
        "body": "Your technical interview confirmed for Monday at 2:00 PM.",
        "expected_stage": "interview",
    },
    # Phone Screen (2)
    {
        "subject": "Recruiter Call - Amazon",
        "body": "Let's set up a 15-minute phone screen with our recruiting manager.",
        "expected_stage": "phone_screen",
    },
    {
        "subject": "Initial conversation regarding your application",
        "body": "Would you have time for a recruiter chat tomorrow?",
        "expected_stage": "phone_screen",
    },
    # Offer (2)
    {
        "subject": "Offer Letter - Senior Go Developer at OpenAI",
        "body": "We are thrilled to present this offer letter and compensation package!",
        "expected_stage": "offer",
    },
    {
        "subject": "Congratulations from Anthropic",
        "body": "We are excited to offer you the position of Senior Backend Engineer.",
        "expected_stage": "offer",
    },
    # Applied (2)
    {
        "subject": "Thank you for applying to Apple",
        "body": "Your application received for the iOS Software Engineer role.",
        "expected_stage": "applied",
    },
    {
        "subject": "Application submitted for Netflix",
        "body": "We got your application and will review it shortly.",
        "expected_stage": "applied",
    },
]


def test_classifier_fixtures():
    """Verify that all 10 email fixtures classify to their expected stage."""
    for fixture in EMAIL_FIXTURES:
        stage = classify_email_stage(fixture["subject"], fixture["body"])
        assert stage == fixture["expected_stage"], f"Failed for {fixture['subject']}: got {stage}"


def test_classifier_confidence():
    """Verify confidence scoring logic."""
    stage, conf = classify_email_with_confidence(
        "Offer Letter - OpenAI",
        "We are excited to offer you the compensation package and official offer letter."
    )
    assert stage == "offer"
    assert conf >= 0.70


def test_matcher_precision_and_no_cross_company_mismatch():
    """Verify application fuzzy matching and cross-company mismatch rejection."""
    sample_applications = [
        {"id": "app_1", "company": "Stripe", "title": "Staff Engineer", "stage": "applied"},
        {"id": "app_2", "company": "Google", "title": "Senior Go Developer", "stage": "applied"},
    ]

    # Email for Stripe
    email_stripe = {
        "subject": "Stripe Technical Interview Invitation",
        "body": "Hi, we'd like to schedule your virtual interview for Staff Engineer at Stripe.",
    }
    match = match_email_to_application(email_stripe["subject"], email_stripe["body"], sample_applications, auto_move_consent=True)
    assert match["matched"] is True
    assert match["application_id"] == "app_1"
    assert match["new_stage"] == "interview"
    assert match["confidence"] >= 0.8
    assert match["action"] == "auto_move"

    # Cross-company mismatch email (Apple email should NOT match Stripe or Google with high confidence)
    email_apple = {
        "subject": "Update on your Apple Application",
        "body": "Unfortunately Apple is not moving forward.",
    }
    mismatch = match_email_to_application(email_apple["subject"], email_apple["body"], sample_applications, auto_move_consent=True)
    # Confidence should be low (< 0.8) and action should be needs_review or none
    assert mismatch["action"] != "auto_move"


def test_matcher_confidence_threshold_needs_review():
    """Verify that confidence below 0.8 produces needs_review instead of auto_move."""
    sample_applications = [
        {"id": "app_1", "company": "Datadog", "title": "Backend Engineer", "stage": "applied"}
    ]
    # Ambiguous email with weak match
    ambiguous_email = {
        "subject": "Update regarding engineering role",
        "body": "Thank you for taking time to chat with us.",
    }
    res = match_email_to_application(ambiguous_email["subject"], ambiguous_email["body"], sample_applications, auto_move_consent=True)
    assert res["action"] == "needs_review" or res["action"] == "none"


def test_pii_redaction_before_processing():
    """Verify SSN and sensitive PII are redacted from email body content."""
    raw_email = "My SSN is 123-45-6789 and I am applying for the role."
    redacted = redact_pii_content(raw_email)
    assert "123-45-6789" not in redacted
    assert "REDACTED" in redacted
