"""Server-owned registry for named automation actions.

Database definitions may select only these identifiers. They cannot name an
arbitrary Python function or provider operation. The registry is deliberately
small until each action has its own owner-scoped executor and evidence bundle.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class AutomationActionRejected(ValueError):
    """Raised when a database definition names an unknown or unsafe action."""


class RiskTier(StrEnum):
    READ = "read"
    NAVIGATION = "navigation"
    DRAFT = "draft"
    SENSITIVE = "sensitive"
    EXTERNAL_WRITE = "external_write"
    SUBMISSION = "submission"


@dataclass(frozen=True)
class AutomationAction:
    action_id: str
    handler: str
    risk_tier: RiskTier
    capabilities: frozenset[str]
    enabled: bool = True


_ACTIONS: dict[str, AutomationAction] = {
    "jobs.refresh_watch": AutomationAction(
        "jobs.refresh_watch", "autopilot.refresh_job_watch", RiskTier.READ,
        frozenset({"workspace.automations", "workspace.external_research"}),
    ),
    "jobs.enrich_match": AutomationAction(
        "jobs.enrich_match", "automation.enrich_job_match", RiskTier.READ,
        frozenset({"workspace.automations", "workspace.ats_assistance"}),
    ),
    "jobs.prepare_candidate_bundle": AutomationAction(
        "jobs.prepare_candidate_bundle", "automation.prepare_candidate_bundle", RiskTier.DRAFT,
        frozenset({"workspace.automations", "workspace.resume", "workspace.ats_assistance"}),
    ),
    "pipeline.reconcile_stale_stage": AutomationAction(
        "pipeline.reconcile_stale_stage", "automation.reconcile_pipeline_stage", RiskTier.READ,
        frozenset({"workspace.automations", "workspace.application_tracker"}),
    ),
    "pipeline.followup_draft": AutomationAction(
        "pipeline.followup_draft", "automation.draft_followup", RiskTier.DRAFT,
        frozenset({"workspace.automations", "workspace.application_tracker"}),
    ),
    "approvals.dispatch": AutomationAction(
        "approvals.dispatch", "delivery.dispatch_pending_messages", RiskTier.EXTERNAL_WRITE,
        frozenset({"workspace.approvals"}),
    ),
    "calendar.prepare_interview_event": AutomationAction(
        "calendar.prepare_interview_event", "automation.prepare_calendar_event", RiskTier.SENSITIVE,
        frozenset({"workspace.automations", "workspace.google.calendar"}),
    ),
    "drive.archive_artifact": AutomationAction(
        "drive.archive_artifact", "automation.prepare_drive_archive", RiskTier.SENSITIVE,
        frozenset({"workspace.automations", "workspace.google.drive"}),
    ),
    "gmail.prepare_followup_draft": AutomationAction(
        "gmail.prepare_followup_draft", "automation.prepare_gmail_draft", RiskTier.SENSITIVE,
        frozenset({"workspace.automations", "workspace.google.gmail"}),
    ),
    "outcomes.attribute": AutomationAction(
        "outcomes.attribute", "learning.attribute_application_outcome", RiskTier.READ,
        frozenset({"workspace.automations"}),
    ),
    "reliability.reclaim": AutomationAction(
        "reliability.reclaim", "automation.dispatch_checkpoints", RiskTier.READ,
        frozenset({"workspace.automations"}),
    ),
}


def action_for(action_id: str | None) -> AutomationAction | None:
    normalized = str(action_id or "").strip()
    return _ACTIONS.get(normalized) if normalized else None


def require_known_action(action_id: str | None) -> AutomationAction:
    action = action_for(action_id)
    if action is None:
        raise AutomationActionRejected("automation action is not registered")
    if not action.enabled:
        raise AutomationActionRejected("automation action is disabled by launch scope")
    if action.risk_tier is RiskTier.SUBMISSION:
        raise AutomationActionRejected("submission actions are disabled in the first release")
    return action


def action_capabilities_enabled(action: AutomationAction) -> bool:
    from app.services.capabilities import capability_enabled

    return all(capability_enabled(capability) for capability in action.capabilities)


def registered_action_ids() -> frozenset[str]:
    return frozenset(_ACTIONS)
