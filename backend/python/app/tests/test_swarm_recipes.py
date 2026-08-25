import pytest

from app.services.swarm_recipes import RECIPES, build_swarm_steps


def test_all_review_first_lanes_have_bounded_specialists():
    assert set(RECIPES) == {"application_packet", "opportunity_sweep", "interview_sprint", "follow_up_radar"}
    for recipe in RECIPES.values():
        assert 1 <= len(recipe.specialists) <= 12
        assert 1 <= recipe.max_parallel <= len(recipe.specialists)


def test_recipe_steps_are_explicit_and_deny_sensitive_capabilities():
    steps = build_swarm_steps("opportunity_sweep", {"job_id": "opaque-job-id", "resume_version": 3})
    assert [step.role for step in steps] == ["opportunity_discoverer", "freshness_deduper", "fit_explainer"]
    for step in steps:
        assert step.input["external_write_allowed"] is False
        assert step.input["credential_access_allowed"] is False
        assert step.input["context_keys"] == ["job_id", "resume_version"]


def test_unknown_recipe_fails_closed():
    with pytest.raises(ValueError, match="unknown swarm recipe"):
        build_swarm_steps("unrestricted_apply", {})
