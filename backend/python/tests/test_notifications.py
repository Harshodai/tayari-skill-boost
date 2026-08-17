"""Tests for Mission M16: Notifications & Re-engagement System."""
import pytest
from app.services.notifications import (
    NotificationEvent,
    process_notification_event,
    build_digest_email,
    is_quiet_hours,
    DEFAULT_NOTIFICATION_PREFERENCES,
)


def test_notification_deduplication():
    """Verify duplicate event IDs are processed only once."""
    evt = NotificationEvent(
        event_id="evt_dedupe_123",
        user_id="u1",
        event_type="job_match.found",
        title="New Match: Stripe",
        message="Staff Engineer matched 92%"
    )
    res1 = process_notification_event(evt, user_hour=14)
    assert res1["status"] == "processed"

    res2 = process_notification_event(evt, user_hour=14)
    assert res2["status"] == "skipped"
    assert res2["reason"] == "duplicate_event"


def test_quiet_hours_enforcement():
    """Verify quiet hours queue notifications instead of disturbing user late at night."""
    prefs = {"quiet_hours_start": 22, "quiet_hours_end": 7}
    assert is_quiet_hours(23, prefs) is True   # 11 PM -> Quiet
    assert is_quiet_hours(2, prefs) is True    # 2 AM -> Quiet
    assert is_quiet_hours(14, prefs) is False  # 2 PM -> Active

    evt = NotificationEvent(
        event_id="evt_night_999",
        user_id="u1",
        event_type="job_match.found",
        title="Late Match",
        message="Match found at midnight"
    )
    res = process_notification_event(evt, user_preferences=prefs, user_hour=23)
    assert res["status"] == "queued_for_quiet_hours"


def test_digest_assembly_and_no_empty_send():
    """Verify digest email builds correctly from events and never empty-sends."""
    # 1. Empty events -> returns None
    assert build_digest_email([]) is None

    # 2. Fixture events -> produces structured digest
    events = [
        NotificationEvent(
            event_id="e1", user_id="u1", event_type="job_match.found",
            title="Senior Go Dev", message="Stripe - 94% fit"
        ),
        NotificationEvent(
            event_id="e2", user_id="u1", event_type="chain.prepared",
            title="Draft Prepared", message="Application queued for review"
        )
    ]
    digest = build_digest_email(events)
    assert digest is not None
    assert digest["event_count"] == 2
    assert "Tayari Digest" in digest["subject"]
    assert "Senior Go Dev" in digest["body"]


def test_production_email_delivery_fails_closed_without_real_smtp(monkeypatch):
    from app.services.notifications import send_email_notification

    monkeypatch.setenv("ENV", "production")
    monkeypatch.delenv("SMTP_HOST", raising=False)
    assert send_email_notification("test@example.com", "Subject", "Body") is False


def test_development_email_uses_explicit_smtp_host(monkeypatch):
    from unittest.mock import patch
    from app.services.notifications import send_email_notification

    monkeypatch.setenv("ENV", "development")
    with patch("app.services.notifications.smtplib.SMTP") as smtp:
        assert send_email_notification("test@example.com", "Subject", "Body", smtp_host="mailpit", smtp_port=1025) is True
        smtp.assert_called_once_with("mailpit", 1025, timeout=5)
