"""Explicit specialist contracts for review-first career workflows.

Recipes are intentionally declarative: they describe bounded read/draft/verify
specialists and never grant credentials, external writes, submission, or hidden
browser control. Execution remains owned by AgentRouter and its approval gates.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.services.ai_orchestration import SwarmStep


@dataclass(frozen=True)
class SpecialistRecipe:
    recipe_id: str
    title: str
    specialists: tuple[tuple[str, str, bool], ...]
    max_parallel: int = 3


RECIPES: dict[str, SpecialistRecipe] = {
    "application_packet": SpecialistRecipe(
        "application_packet",
        "Application packet",
        (
            ("fit_auditor", "Separate hard constraints, transferable evidence, and gaps.", False),
            ("material_drafter", "Draft truthful role-specific materials for review.", True),
            ("review_binder", "Bind versions, provenance, unresolved questions, and approvals.", True),
        ),
    ),
    "opportunity_sweep": SpecialistRecipe(
        "opportunity_sweep",
        "Opportunity sweep",
        (
            ("opportunity_discoverer", "Discover bounded candidates from configured sources.", False),
            ("freshness_deduper", "Canonicalize, deduplicate, and flag stale postings.", False),
            ("fit_explainer", "Explain constraints, evidence, gaps, and confidence.", True),
        ),
    ),
    "interview_sprint": SpecialistRecipe(
        "interview_sprint",
        "Interview sprint",
        (
            ("requirement_mapper", "Map role requirements to drills and evidence.", False),
            ("practice_designer", "Create adaptive questions and story drills.", True),
            ("progress_baseliner", "Record transparent practice dimensions, never hiring probability.", True),
        ),
    ),
    "follow_up_radar": SpecialistRecipe(
        "follow_up_radar",
        "Follow-up radar",
        (
            ("pipeline_triager", "Detect stale, waiting, and time-sensitive pipeline items.", False),
            ("draft_preparer", "Prepare concise follow-up drafts from verified context.", True),
            ("handoff_guardian", "Check recipient, timing, intent, and manual-send boundary.", True),
        ),
    ),
}


def build_swarm_steps(recipe_id: str, context: dict[str, Any] | None = None) -> tuple[SwarmStep, ...]:
    """Build bounded, provenance-friendly steps for one known recipe."""
    recipe = RECIPES.get(recipe_id)
    if recipe is None:
        raise ValueError(f"unknown swarm recipe: {recipe_id}")
    safe_context = {
        "recipe_id": recipe.recipe_id,
        "context_keys": sorted(str(key) for key in (context or {}).keys())[:20],
        "external_write_allowed": False,
        "credential_access_allowed": False,
    }
    return tuple(
        SwarmStep(
            step_id=f"{recipe.recipe_id}:{specialist_id}",
            role=specialist_id,
            input={**safe_context, "objective": objective, "requires_review": requires_review},
        )
        for specialist_id, objective, requires_review in recipe.specialists
    )


__all__ = ["RECIPES", "SpecialistRecipe", "build_swarm_steps"]
