"""Team Memory Save-File Exporter & Importer (.tayarisave).

Inspired by TencentDB Agent Memory Save-File Import/Export:
Exports and restores candidate Knowledge Graphs, L0-L3 memory frames, and versioned skills
into portable JSON save-files (.tayarisave) for instant cold-starts across agent sessions.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class MemorySaveEngine:
    """Handles export and import of candidate memory save files."""

    @staticmethod
    def export_save_file(
        user_id: str,
        graph_dict: Dict[str, Any],
        l3_persona: Dict[str, Any],
        skills: List[Dict[str, Any]]
    ) -> str:
        """Export candidate memory assets to a JSON save-file string."""
        payload = {
            "format_version": "1.0",
            "system": "TayariSkillBoost",
            "user_id": user_id,
            "knowledge_graph": graph_dict,
            "persona": l3_persona,
            "skills": skills
        }
        return json.dumps(payload, indent=2)

    @staticmethod
    def import_save_file(save_json: str) -> Dict[str, Any]:
        """Import and validate a candidate memory save-file string."""
        try:
            data = json.loads(save_json)
        except Exception as exc:
            logger.error("Invalid save file JSON: %s", exc)
            return {"status": "error", "message": f"Invalid JSON: {exc}"}

        if data.get("system") != "TayariSkillBoost":
            return {"status": "error", "message": "Incompatible save file format"}

        return {
            "status": "success",
            "user_id": data.get("user_id", "unknown"),
            "knowledge_graph": data.get("knowledge_graph", {}),
            "persona": data.get("persona", {}),
            "skills": data.get("skills", []),
            "format_version": data.get("format_version", "1.0")
        }
