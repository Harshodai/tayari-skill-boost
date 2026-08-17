"""Server-owned launch capability registry.

Unknown capabilities are disabled. Candidate-controlled workspace capabilities
are enabled only outside staging/production by default; high-risk capabilities
require their own explicit environment flag in every environment.
"""
from __future__ import annotations

import os
from enum import StrEnum


class Capability(StrEnum):
    WORKSPACE_AUTH = "workspace.auth"
    WORKSPACE_RESUME = "workspace.resume"
    WORKSPACE_PUBLIC_IMPORT = "workspace.public_import"
    WORKSPACE_ATS_ASSISTANCE = "workspace.ats_assistance"
    WORKSPACE_KNOWLEDGE_HUB = "workspace.knowledge_hub"
    WORKSPACE_INTERVIEW_PREP = "workspace.interview_prep"
    WORKSPACE_APPLICATION_TRACK = "workspace.application_tracker"
    WORKSPACE_EXTERNAL_RESEARCH = "workspace.external_research"
    WORKSPACE_EXTERNAL_RESEARCH_FIRECRAWL = "workspace.external_research.firecrawl"
    WORKSPACE_EXTERNAL_RESEARCH_APIFY = "workspace.external_research.apify"
    INTEGRATION_A2A_FEDERATION = "integration.a2a_federation"
    AUTONOMOUS_BROWSER = "autonomous.browser"
    WORKSPACE_ISOLATED_COMPUTER = "workspace.isolated_computer"
    WORKSPACE_LOCAL_BROWSER_BRIDGE = "workspace.local_browser_bridge"
    WORKSPACE_LOCAL_BROWSER_SENSITIVE_ACTIONS = "workspace.local_browser_sensitive_actions"
    WORKSPACE_COMPUTER_SUBMISSION = "workspace.computer_submission"
    AUTONOMOUS_ATS_SUBMIT = "autonomous.ats_submit"
    AUTONOMOUS_GMAIL = "autonomous.gmail"
    AUTONOMOUS_MESSAGING = "autonomous.messaging"
    AUTONOMOUS_BILLING = "autonomous.billing"
    AUTONOMOUS_IRREVERSIBLE = "autonomous.irreversible_jobs"


def _enabled(name: Capability) -> bool:
    environment = os.getenv("APP_ENV", "development").strip().lower()
    workspace_default = environment not in {"production", "prod", "staging"}
    default = workspace_default and name.value.startswith("workspace.")
    key = "CAPABILITY_" + name.value.upper().replace(".", "_").replace("-", "_")
    raw = os.getenv(key)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def capability_enabled(name: Capability | str) -> bool:
    try:
        capability = name if isinstance(name, Capability) else Capability(name)
    except ValueError:
        return False
    return _enabled(capability)


def require_capability(name: Capability | str) -> None:
    """Raise a stable machine-readable error for a disabled capability."""
    from fastapi import HTTPException

    if not capability_enabled(name):
        raise HTTPException(
            status_code=423,
            detail={
                "code": "disabled_by_launch_scope",
                "capability": str(name),
                "message": "This capability is not enabled for the current deployment scope.",
            },
        )
