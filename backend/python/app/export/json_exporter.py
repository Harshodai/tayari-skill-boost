"""JSON export — pass-through."""
import json
from typing import Dict, Any


class JSONExporter:
    """Export as clean JSON."""

    @staticmethod
    def export(resume_json: Dict[str, Any]) -> bytes:
        return json.dumps(resume_json, indent=2, ensure_ascii=False).encode("utf-8")
