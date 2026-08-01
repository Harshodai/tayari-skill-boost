"""Persistent Agent Session Snapshotter.

Inspired by TencentDB Agent Memory SessionSnapshotter:
Serializes active agent conversation states, scratchpads, and execution stack trace buffers
into persistent memory snapshots for instant crash recovery after server restarts.
"""

from __future__ import annotations

import copy
import json
import logging
import os
import re
import tempfile
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class SessionSnapshotter:
    """Manages serialization and restoration of agent conversation session snapshots."""

    def __init__(self, storage_dir: Optional[str] = None):
        # ponytail: disk-backed storage is required for crash recovery; default to a
        # per-process temp dir when no dir is provided so the no-arg constructor stays
        # backward compatible. Callers that need true durability pass their own dir.
        if storage_dir is None:
            storage_dir = tempfile.mkdtemp(prefix="a2a-snapshots-")
        self._storage_dir = storage_dir
        os.makedirs(self._storage_dir, exist_ok=True)

    @staticmethod
    def _snapshot_path(storage_dir: str, session_id: str) -> str:
        # ponytail: session_id is caller-supplied; sanitize before it touches the
        # filesystem to prevent path traversal via ".." or "/" in the id.
        safe_name = re.sub(r"[^A-Za-z0-9_.-]", "_", session_id)
        return os.path.join(storage_dir, f"{safe_name}.json")

    def create_snapshot(
        self,
        session_id: str,
        agent_states: Dict[str, Any],
        scratchpad: List[str]
    ) -> Dict[str, Any]:
        """Serialize and persist session state."""
        # ponytail: deep-copy caller-owned containers so later caller mutation of
        # agent_states/scratchpad (or of the returned snapshot) cannot alter stored state.
        snapshot = {
            "session_id": session_id,
            "agent_states": copy.deepcopy(agent_states),
            "scratchpad": copy.deepcopy(scratchpad),
            "is_valid": True
        }
        # ponytail: agent_states must be JSON-serializable to round-trip faithfully.
        # Non-serializable values degrade to their str() form (documented limitation:
        # they are not reconstructable on restore, but create_snapshot never crashes).
        payload = json.dumps(snapshot, default=str)
        path = self._snapshot_path(self._storage_dir, session_id)
        tmp_path = f"{path}.tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            f.write(payload)
        os.replace(tmp_path, path)  # ponytail: atomic write — readers never see partial JSON.
        logger.info("Created session snapshot for: %s", session_id)
        return copy.deepcopy(snapshot)

    def restore_snapshot(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Restore active session state by session_id."""
        path = self._snapshot_path(self._storage_dir, session_id)
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            return None
        except (OSError, json.JSONDecodeError):
            # ponytail: a corrupt or unreadable snapshot must not crash recovery;
            # degrade to "no snapshot" the same way a missing session_id did.
            logger.warning("Failed to restore session snapshot for: %s", session_id, exc_info=True)
            return None
