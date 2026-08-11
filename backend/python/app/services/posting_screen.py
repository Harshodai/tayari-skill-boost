"""Pre-application posting screen (WS-08).

The ghost-job and role-intent guardrails used to live in the orphaned
``end_to_end_pipeline`` engine, which nothing in production called. They are
merged here so the live autopilot (``automation_engine``) runs them before it
spends an LLM budget tailoring a resume for a fake or mismatched posting.

Both stages fail closed: a crashed guardrail blocks the posting rather than
silently clearing it.
"""

from __future__ import annotations

import logging
from typing import Any, Dict

from app.guardrails.legitimacy_checker import LegitimacyChecker
from app.scoring.semantic_role_matcher import SemanticRoleMatcher

logger = logging.getLogger(__name__)

STAGE_OK = "ok"
STAGE_FAILED = "failed"

BLOCKED_GHOST = "BLOCKED_HIGH_GHOST_JOB_RISK"
BLOCKED_ROLE = "BLOCKED_ROLE_MISMATCH"
CLEARED = "CLEARED"


def screen_posting(
    target_role: str,
    job_title: str,
    job_description: str,
) -> Dict[str, Any]:
    """Return ``{status, ghost_job_risk, semantic_role_match, reason}``.

    ``status`` is ``CLEARED`` only when both guardrails ran and passed.
    """
    ghost: Dict[str, Any] = {"status": STAGE_FAILED}
    try:
        ghost = {
            "status": STAGE_OK,
            **LegitimacyChecker.evaluate_posting_legitimacy(job_title, job_description),
        }
    except Exception as exc:  # noqa: BLE001 - guardrail must fail closed
        logger.warning("Ghost job risk assessment failed for %r: %s", job_title, exc)

    role: Dict[str, Any] = {"status": STAGE_FAILED, "is_semantically_matched": False}
    if target_role:
        try:
            role = {
                "status": STAGE_OK,
                **SemanticRoleMatcher.classify_posting(target_role, job_title, job_description),
            }
        except Exception as exc:  # noqa: BLE001 - guardrail must fail closed
            logger.warning("Semantic role matching failed for %r: %s", job_title, exc)
    else:
        # No target role to compare against: role intent is not a gate here.
        role = {"status": STAGE_OK, "is_semantically_matched": True, "skipped": True}

    if ghost.get("status") != STAGE_OK or ghost.get("is_ghost_job_risk") is True:
        status, reason = BLOCKED_GHOST, "high ghost-job risk"
    elif role.get("is_semantically_matched") is not True:
        status, reason = BLOCKED_ROLE, "posting does not match the target role"
    else:
        status, reason = CLEARED, ""

    return {
        "status": status,
        "reason": reason,
        "ghost_job_risk": ghost,
        "semantic_role_match": role,
    }
