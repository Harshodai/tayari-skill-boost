"""BanditService.select_variant must actually implement Thompson Sampling.

Regression cover for the defect where the function read `conversion_rate` /
`score` keys the request schema (`VariantStat`: variant_id/pulls/conversions)
never populates, so every arm scored an identical default and the function
returned `variants[0]` unconditionally — an A/B test that never explored and
never adapted to real performance, dressed up as Thompson Sampling in its own
docstring and the API's error message.
"""
from __future__ import annotations

import random

from app.services.bandit_service import BanditService


def _variant(variant_id: int, pulls: int, conversions: int) -> dict:
    return {"variant_id": variant_id, "pulls": pulls, "conversions": conversions}


class TestSelectVariant:
    def test_empty_variants_returns_zero(self):
        assert BanditService.select_variant([]) == 0

    def test_single_variant_returns_its_id(self):
        assert BanditService.select_variant([_variant(7, 100, 50)]) == 7

    def test_does_not_always_return_the_first_variant(self):
        """The exact bug: identical stats used to make order decide the winner.

        With truly equal arms and no history, a real Thompson Sampling draw
        must be free to prefer either arm depending on the RNG — pinning the
        first variant to always win would mean the old bug (or a
        deterministic tie-break) is still there.
        """
        variants = [_variant(1, 0, 0), _variant(2, 0, 0)]
        seeds_returning_variant_2 = 0
        for seed in range(50):
            result = BanditService.select_variant(variants, rng=random.Random(seed))
            if result == 2:
                seeds_returning_variant_2 += 1
        # Symmetric arms: neither should win (near-)every time.
        assert 5 <= seeds_returning_variant_2 <= 45

    def test_strong_evidence_wins_most_of_the_time(self):
        """A variant with a real track record should dominate a poor one.

        Not "always" — Thompson Sampling keeps exploring — but with this much
        separation (90% vs 10% over 50 pulls each) the strong arm should win
        the clear majority of draws.
        """
        strong = _variant(1, 50, 45)
        weak = _variant(2, 50, 5)
        wins_for_strong = sum(
            1
            for seed in range(200)
            if BanditService.select_variant([strong, weak], rng=random.Random(seed)) == 1
        )
        assert wins_for_strong > 150  # well above the 50% a coin-flip would give

    def test_unpulled_arm_is_not_starved(self):
        """A brand-new arm (0 pulls) must be able to beat an established one.

        Beta(1, 1) is the uniform prior, so a fresh arm draws anywhere on
        [0, 1] — it can and sometimes must outscore even a decent established
        arm. This is what makes it exploration rather than pure exploitation.
        """
        established = _variant(1, 20, 12)  # 60% observed rate
        fresh = _variant(2, 0, 0)
        fresh_wins = sum(
            1
            for seed in range(300)
            if BanditService.select_variant([established, fresh], rng=random.Random(seed)) == 2
        )
        assert fresh_wins > 0

    def test_conversions_exceeding_pulls_is_clamped_not_trusted(self):
        """Malformed input (conversions > pulls) must not produce beta(negative)."""
        # Would raise ValueError from random.betavariate on a negative beta
        # parameter if not clamped; the call succeeding is the assertion.
        result = BanditService.select_variant(
            [_variant(1, 5, 999), _variant(2, 5, 2)], rng=random.Random(0)
        )
        assert result in (1, 2)

    def test_deterministic_with_a_seeded_rng(self):
        """Same seed, same variants, same result — required for reproducible tests."""
        variants = [_variant(1, 10, 3), _variant(2, 10, 7)]
        first = BanditService.select_variant(variants, rng=random.Random(123))
        second = BanditService.select_variant(variants, rng=random.Random(123))
        assert first == second
