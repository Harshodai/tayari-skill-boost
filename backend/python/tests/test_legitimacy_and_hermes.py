"""Tests for Mission M6: Posting Health Badge & Legitimacy Signals."""
import pytest
from datetime import datetime, timedelta, timezone
from app.services.legitimacy_checker import compute_posting_health


def test_posting_health_fresh():
    """Verify Fresh badge for recent, high-trust, non-reposted job."""
    now = datetime.now(timezone.utc)
    fresh_date = (now - timedelta(days=2)).isoformat()
    job = {
        "title": "Senior Go Engineer",
        "company": "Stripe",
        "url": "https://boards.greenhouse.io/stripe/jobs/123",
        "source": "greenhouse",
        "posted_at": fresh_date,
        "salary": "$180,000 - $220,000",
        "repost_count": 0,
        "description": "Building high scale payment infrastructure in Go."
    }
    health = compute_posting_health(job)
    assert health["badge"] == "Fresh"
    assert health["rank_weight"] > 0
    assert len(health["evidence"]) >= 3


def test_posting_health_aging():
    """Verify Aging badge for 35-day-old job."""
    now = datetime.now(timezone.utc)
    aging_date = (now - timedelta(days=35)).isoformat()
    job = {
        "title": "Frontend Developer",
        "company": "Acme Corp",
        "source": "scraped",
        "first_seen": aging_date,
        "posted_at": aging_date,
        "repost_count": 1,
        "description": "React & TypeScript developer."
    }
    health = compute_posting_health(job)
    assert health["badge"] == "Aging"


def test_posting_health_likely_ghost():
    """Verify Likely ghost badge for stale 70-day-old job or high repost count."""
    now = datetime.now(timezone.utc)
    ghost_date = (now - timedelta(days=75)).isoformat()
    job = {
        "title": "Generic Software Engineer",
        "company": "Old Firm",
        "source": "scraped",
        "posted_at": ghost_date,
        "repost_count": 4,
        "description": "Legacy application developer."
    }
    health = compute_posting_health(job)
    assert health["badge"] == "Likely ghost"
    assert health["rank_weight"] < 0
