"""Agent Action Audit Trail & Tracing Engine.

Inspired by TencentDB Agent Memory Audit Trail:
Records cryptographic timestamps, inputs, outputs, and confidence scores for every
AI agent decision, producing a clear audit log for debugging and verification.
"""

from __future__ import annotations

import copy
import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ponytail: dev default only; production callers should pass their own key to __init__.
DEFAULT_HMAC_KEY = "tayari-audit-trail-default-key"
INTEGRITY_FIELD = "hmac_hex"


class AgentAuditTrail:
    """Stores structured execution logs and decisions for autonomous AI agents."""

    def __init__(self, hmac_key: str = DEFAULT_HMAC_KEY):
        self._audit_logs: List[Dict[str, Any]] = []
        self._hmac_key = hmac_key.encode("utf-8") if isinstance(hmac_key, str) else hmac_key

    # ponytail: canonical JSON (sorted keys, compact separators) over the payload
    # minus the integrity field, so the digest is deterministic and not self-referential.
    def _canonical_json(self, entry: Dict[str, Any]) -> str:
        payload = {key: value for key, value in entry.items() if key != INTEGRITY_FIELD}
        return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)

    def _sign(self, entry: Dict[str, Any]) -> str:
        return hmac.new(self._hmac_key, self._canonical_json(entry).encode("utf-8"), hashlib.sha256).hexdigest()

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
            # ponytail: deep copies so later caller mutation of inputs/outputs
            # (or of the returned entry) cannot alter the stored record.
            "inputs": copy.deepcopy(inputs),
            "outputs": copy.deepcopy(outputs),
            "confidence": confidence
        }
        entry[INTEGRITY_FIELD] = self._sign(entry)
        self._audit_logs.append(entry)
        logger.debug("Recorded audit entry for %s: %s", agent_name, action)
        return copy.deepcopy(entry)

    def get_logs(self, agent_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieve audit logs, optionally filtered by agent name."""
        if agent_name:
            entries = [log for log in self._audit_logs if log["agent_name"] == agent_name]
        else:
            entries = list(self._audit_logs)
        # ponytail: deep copies so mutating a returned entry cannot touch stored records.
        return [copy.deepcopy(entry) for entry in entries]

    def verify_integrity(self, entry: Dict[str, Any]) -> bool:
        """Return True if entry's HMAC matches its payload (i.e. not tampered)."""
        try:
            stored = entry.get(INTEGRITY_FIELD)
            if not isinstance(stored, str):
                return False
            return hmac.compare_digest(stored, self._sign(entry))
        except (AttributeError, TypeError, ValueError):
            return False
