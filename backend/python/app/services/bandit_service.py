"""Outcome Bandit Loop for Resume Strategy Optimization (Mission M8).

SECURITY NOTE: _ARM_STATS is keyed by (user_id, role_family, strategy) to enforce
strict per-user isolation. Never use role_family/strategy alone as the key — that
would allow cross-user contamination of optimization signals.
"""
import random
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# Strategy performance memory: user_id -> role_family -> strategy -> {pulls, conversions}
# NOTE: This is in-memory only. On process restart, stats are lost and cold-start
# learning kicks in again. This is intentional — persistent stats live in
# application_outcomes (DB) and are re-hydrated on startup in a future M8 iteration.
_ARM_STATS: Dict[str, Dict[str, Dict[str, Dict[str, int]]]] = {}


class BanditService:
    @staticmethod
    def select_variant(variants: List[Dict[str, Any]]) -> int:
        if not variants:
            return 0
        best_variant = variants[0]
        best_score = -1.0
        for v in variants:
            score = v.get("conversion_rate", v.get("score", 0.0))
            if score > best_score:
                best_score = score
                best_variant = v
        return best_variant.get("variant_id", 0)


def _get_arm_stats(role_family: str, strategy: str, user_id: str) -> Dict[str, int]:
    """Retrieve or initialize arm stats, scoped by user_id."""
    if user_id not in _ARM_STATS:
        _ARM_STATS[user_id] = {}
    if role_family not in _ARM_STATS[user_id]:
        _ARM_STATS[user_id][role_family] = {}
    if strategy not in _ARM_STATS[user_id][role_family]:
        _ARM_STATS[user_id][role_family][strategy] = {"pulls": 0, "conversions": 0}
    return _ARM_STATS[user_id][role_family][strategy]


def record_outcome(
    role_family: str,
    strategy: str,
    outcome: str,
    variant_id: Optional[str] = None,
    *,
    user_id: str,
) -> Dict[str, Any]:
    """Record application outcome for a resume strategy arm.

    Outcomes: 'interview' (conversion +1), 'rejection' (0), 'no_reply' (0).
    user_id MUST be the authenticated user's ID (keyword-only, no default) so
    stats are never mixed across users — the SECURITY NOTE at the top of this
    module is load-bearing, not advisory.
    """
    stats = _get_arm_stats(role_family, strategy, user_id)
    stats["pulls"] += 1
    if outcome == "interview":
        stats["conversions"] += 1

    return {
        "role_family": role_family,
        "strategy": strategy,
        "variant_id": variant_id,
        "pulls": stats["pulls"],
        "conversions": stats["conversions"],
        "conversion_rate": round(stats["conversions"] / max(1, stats["pulls"]), 3)
    }


def select_strategy(
    role_family: str,
    available_strategies: List[str],
    epsilon: float = 0.15,
    min_samples_threshold: int = 20,
    rng: Optional[random.Random] = None,
    *,
    user_id: str,
) -> Dict[str, Any]:
    """Select best optimizer strategy arm using Epsilon-Greedy selection with cold-start honesty.

    Below min_samples_threshold (n=20), status is strictly 'learning' (no deceptive claims).
    user_id MUST be the authenticated user's ID (keyword-only, no default) — see SECURITY NOTE.
    """
    r = rng if rng is not None else random
    if not available_strategies:
        raise ValueError("No strategies provided to select_strategy")

    # Epsilon exploration
    if r.random() < epsilon:
        selected = r.choice(available_strategies)
    else:
        # Greedy exploitation based on estimated conversion rate
        best_rate = -1.0
        selected = available_strategies[0]
        for strat in available_strategies:
            stats = _get_arm_stats(role_family, strat, user_id)
            rate = stats["conversions"] / max(1, stats["pulls"])
            if rate > best_rate:
                best_rate = rate
                selected = strat

    selected_stats = _get_arm_stats(role_family, selected, user_id)
    total_pulls = selected_stats["pulls"]

    # Cold-start honesty gate per brief §M8
    is_learning = total_pulls < min_samples_threshold
    status = "learning" if is_learning else "optimized"

    return {
        "strategy": selected,
        "status": status,
        "sample_count": total_pulls,
        "conversions": selected_stats["conversions"],
        "display_claim": "learning" if is_learning else f"Optimized default ({round(selected_stats['conversions']/max(1, total_pulls)*100, 1)}% interview rate)",
        "is_honest": True
    }


def simulate_outcome_loop(
    role_family: str,
    strategies_with_true_rates: Dict[str, float],
    total_trials: int = 200,
    rng: Optional[random.Random] = None
) -> str:
    """Simulate N trial outcomes to probabilistically identify the highest-conversion strategy arm.

    Uses an isolated local stats store so simulated pulls do not mutate global production _ARM_STATS.
    Accepts an optional seeded RNG instance for reproducible test execution.
    """
    r = rng if rng is not None else random.Random(42)
    strategies = list(strategies_with_true_rates.keys())
    if not strategies:
        return "balanced_confidence"

    # Local stats store isolated from global _ARM_STATS
    local_stats: Dict[str, Dict[str, int]] = {s: {"pulls": 0, "conversions": 0} for s in strategies}

    for _ in range(total_trials):
        if r.random() < 0.1:
            strat = r.choice(strategies)
        else:
            best_rate = -1.0
            strat = strategies[0]
            for s in strategies:
                st = local_stats[s]
                rate = st["conversions"] / max(1, st["pulls"])
                if rate > best_rate:
                    best_rate = rate
                    strat = s

        true_rate = strategies_with_true_rates[strat]
        outcome = "interview" if r.random() < true_rate else "rejection"

        local_stats[strat]["pulls"] += 1
        if outcome == "interview":
            local_stats[strat]["conversions"] += 1

    # Select winning strategy deterministically from local_stats
    best_rate = -1.0
    winning = strategies[0]
    for s in strategies:
        st = local_stats[s]
        rate = st["conversions"] / max(1, st["pulls"])
        if rate > best_rate:
            best_rate = rate
            winning = s

    return winning
