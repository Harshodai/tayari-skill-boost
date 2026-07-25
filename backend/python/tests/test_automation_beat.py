"""Tests for Mission M15: Celery Beat, Standing Watches, and Status State Machine."""
import pytest
from app.services.automation_engine import (
    StandingWatch,
    validate_status_transition,
    check_daily_llm_budget,
)


def test_status_state_machine_honesty():
    """Verify state machine rejects illegal status transitions (e.g. queued -> applied)."""
    # Legal transition: queued -> prepared
    assert validate_status_transition("queued", "prepared") is True

    # Legal transition: prepared -> applied (by user action)
    assert validate_status_transition("prepared", "applied") is True

    # Illegal transition: queued -> applied (violates honesty rule)
    assert validate_status_transition("queued", "applied") is False

    # Legal transition: applied -> interview
    assert validate_status_transition("applied", "interview") is True


def test_standing_watch_instantiation():
    """Verify StandingWatch schema and default values."""
    watch = StandingWatch(
        watch_id="w_1",
        user_id="u_1",
        target_role="Senior Go Engineer",
        company="Stripe"
    )
    assert watch.target_role == "Senior Go Engineer"
    assert watch.enabled is True
    assert watch.schedule_tier == "30min"


def test_llm_daily_budget_enforcement():
    """Verify daily LLM token budget enforcement per user."""
    user_id = "user_budget_test"

    # Under budget
    assert check_daily_llm_budget(user_id, estimated_tokens=10000) is True
    assert check_daily_llm_budget(user_id, estimated_tokens=35000) is True

    # Exceeding budget (50,000 token ceiling)
    assert check_daily_llm_budget(user_id, estimated_tokens=10000) is False
