"""Tests for Mission M8 Outcome Bandit Loop."""
import pytest
from app.services.bandit_service import (
    record_outcome,
    select_strategy,
    simulate_outcome_loop,
)


def test_cold_start_honesty():
    """Verify that below n=20 samples, UI shows 'learning' and never deceptive claims."""
    role = "backend_engineer"
    strategies = ["keyword_heavy", "bullet_concise", "summary_action"]

    # Initial selection with 0 samples
    res = select_strategy(role, strategies, min_samples_threshold=20)
    assert res["status"] == "learning"
    assert res["display_claim"] == "learning"

    # Record 10 outcomes
    for i in range(10):
        record_outcome(role, "keyword_heavy", "interview" if i % 2 == 0 else "rejection")

    res_after_10 = select_strategy(role, strategies, min_samples_threshold=20)
    assert res_after_10["status"] == "learning"


def test_bandit_simulation_convergence():
    """Verify that a 200-outcome simulation converges to the highest converting strategy arm without mutating global state."""
    role = "frontend_engineer_sim"
    true_rates = {
        "weak_strategy": 0.05,
        "winning_strategy": 0.40,  # Clear winner
        "medium_strategy": 0.15,
    }

    winner = simulate_outcome_loop(role, true_rates, total_trials=200)
    assert winner == "winning_strategy"

    # Verify global arm stats remain unmutated by local simulation
    status_check = select_strategy(role, list(true_rates.keys()), epsilon=0.0, min_samples_threshold=20)
    assert status_check["status"] == "learning"

    # When 20 real outcomes are recorded for winning strategy, global status becomes optimized
    for _ in range(20):
        record_outcome(role, "winning_strategy", "interview")

    status_check_after = select_strategy(role, list(true_rates.keys()), epsilon=0.0, min_samples_threshold=20)
    assert status_check_after["status"] == "optimized"
    assert "Optimized" in status_check_after["display_claim"]
