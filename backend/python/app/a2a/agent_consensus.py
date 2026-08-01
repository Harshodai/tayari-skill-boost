"""Hierarchical Multi-Agent Consensus Protocol.

Inspired by TencentDB Agent Memory consensus protocol:
Implements weighted voting thresholds across Scout, Builder, and Reviewer agents
to approve tailored resume bullets and cover letters before export.
"""

from __future__ import annotations

import logging
import math
from typing import Any, Dict

logger = logging.getLogger(__name__)


class AgentConsensusProtocol:
    """Multi-agent weighted voting consensus engine."""

    AGENT_WEIGHTS = {
        "Scout": 0.25,     # Evaluates ATS keyword alignment
        "Builder": 0.35,   # Evaluates STAR structural impact
        "Reviewer": 0.40   # Evaluates factual accuracy and zero hallucination
    }

    APPROVAL_THRESHOLD = 0.75  # 75% weighted approval required

    @staticmethod
    def evaluate_consensus(
        scout_score: float,
        builder_score: float,
        reviewer_score: float
    ) -> Dict[str, Any]:
        """Compute weighted consensus score across multi-agent squad."""
        w = AgentConsensusProtocol.AGENT_WEIGHTS

        # ponytail: ValueError over error-dict — no a2a error convention exists,
        # and only the squad/tests call this, so fail loud on bad input.
        for label, score in (
            ("scout", scout_score),
            ("builder", builder_score),
            ("reviewer", reviewer_score),
        ):
            if not math.isfinite(score) or not 0.0 <= score <= 1.0:
                raise ValueError(
                    f"{label}_score must be finite and within [0.0, 1.0], got {score}"
                )

        weighted_score = round(
            (scout_score * w["Scout"]) +
            (builder_score * w["Builder"]) +
            (reviewer_score * w["Reviewer"]),
            3
        )

        is_approved = weighted_score >= AgentConsensusProtocol.APPROVAL_THRESHOLD

        return {
            "scout_score": scout_score,
            "builder_score": builder_score,
            "reviewer_score": reviewer_score,
            "weighted_consensus_score": weighted_score,
            "is_approved": is_approved,
            "decision": "APPROVED" if is_approved else "REJECTED_REVISION_REQUIRED"
        }
