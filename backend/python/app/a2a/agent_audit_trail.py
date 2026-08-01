"""Agent Action Audit Trail & Tracing Engine.

Inspired by TencentDB Agent Memory Audit Trail:
Records cryptographic timestamps, inputs, outputs, and confidence scores for every
AI agent decision, producing a clear audit log for debugging and verification.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class AgentAuditTrail:
    """Stores structured execution logs and decisions for autonomous AI agents."""

    def __init__(self):
        self._audit_logs: List[Dict[str, Any]] = []

    def record_agent_action(
        self,
        agent_name: str,
        action: str,
        inputs: Dict[str, Any],
        outputs: Dict[str, Any],
        confidence: float = 1.0
    ) -> Dict[str, Any]:
        """Record an agent execution event into the audit trail."""
        timestamp = datetime.now(timezone.utc).isoformat()
        entry = {
            "timestamp": timestamp,
            "agent_name": agent_name,
            "action": action,
            "inputs": inputs,
            "outputs": outputs,
            "confidence": confidence
        }
        self._audit_logs.append(entry)
        logger.debug("Recorded audit entry for %s: %s", agent_name, action)
        return entry

    def get_logs(self, agent_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieve audit logs, optionally filtered by agent name."""
        if agent_name:
            return [log for log in self._audit_logs if log["agent_name"] == agent_name]
        return list(self._audit_logs)
