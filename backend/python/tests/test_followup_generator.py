"""Unit tests for followup generator audit findings (task 30)."""

from datetime import datetime, timedelta, timezone

import pytest

from app.services.followup_generator import FollowupGenerator


def _stale_app(timestamp, status="submitted"):
    return {
        "id": "1",
        "company": "Acme Inc",
        "role": "Senior Engineer",
        "status": status,
        "last_updated_at": timestamp,
        "followup_count": 0,
    }


def test_draft_followup_message_requires_candidate_name():
    with pytest.raises(TypeError):
        FollowupGenerator.draft_followup_message("Acme Inc", "Senior Engineer")


def test_draft_followup_message_interpolates_candidate_name():
    draft = FollowupGenerator.draft_followup_message("Acme Inc", "Senior Engineer", "Harshodai")
    assert "Harshodai" in draft["subject"]
    assert "Harshodai" in draft["body"]


def test_aware_datetime_timestamp_preserved():
    ts = datetime.now(timezone.utc) - timedelta(days=30)
    quiet = FollowupGenerator.inspect_applications([_stale_app(ts)])
    assert len(quiet) == 1
    assert quiet[0]["days_quiet"] == 30


def test_naive_datetime_timestamp_assumed_utc():
    naive = (datetime.now(timezone.utc) - timedelta(days=30)).replace(tzinfo=None)
    quiet = FollowupGenerator.inspect_applications([_stale_app(naive)])
    assert len(quiet) == 1
    assert quiet[0]["days_quiet"] == 30


def test_unparseable_string_timestamp_skips_application():
    # 11-day fallback would have flagged this; empty result proves the skip
    assert FollowupGenerator.inspect_applications([_stale_app("not-a-date")]) == []


def test_non_datetime_non_string_timestamp_skips_application():
    assert FollowupGenerator.inspect_applications([_stale_app(12345)]) == []


def test_none_status_treated_as_submitted():
    ts = datetime.now(timezone.utc) - timedelta(days=30)
    quiet = FollowupGenerator.inspect_applications([_stale_app(ts, status=None)])
    assert len(quiet) == 1


def test_terminal_status_excluded():
    ts = datetime.now(timezone.utc) - timedelta(days=30)
    assert FollowupGenerator.inspect_applications([_stale_app(ts, status="rejected")]) == []


def test_terminal_statuses_constant_used():
    assert "rejected" in FollowupGenerator.TERMINAL_STATUSES
    assert "offer_accepted" in FollowupGenerator.TERMINAL_STATUSES
    assert "offer_declined" in FollowupGenerator.TERMINAL_STATUSES
    assert "withdrawn" in FollowupGenerator.TERMINAL_STATUSES
