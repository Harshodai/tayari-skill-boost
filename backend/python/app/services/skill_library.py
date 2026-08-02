"""Version-Controlled Agent Skill Library Service.

Inspired by TencentDB Agent Memory Skill Hub:
Stores, versions, and manages reusable agent execution skills with trigger conditions,
version numbers, required parameters, and validation rules.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class SkillLibrary:
    """Manages version-controlled agent skill specifications."""

    def __init__(self):
        self._skills: Dict[str, Dict[str, Any]] = {}

    def register_skill(
        self,
        name: str,
        description: str,
        trigger_conditions: List[str],
        execution_steps: List[str],
        version: str = "1.0.0",
        author: str = "system"
    ) -> Dict[str, Any]:
        """Register or update a skill version in the library."""
        skill_entry = {
            "name": name,
            "description": description,
            "trigger_conditions": trigger_conditions,
            "execution_steps": execution_steps,
            "version": version,
            "author": author,
            "is_active": True
        }
        self._skills[name] = skill_entry
        logger.info("Registered skill '%s' (v%s)", name, version)
        return skill_entry

    def get_skill(self, name: str) -> Optional[Dict[str, Any]]:
        """Retrieve a registered skill by name."""
        return self._skills.get(name)

    def list_skills(self) -> List[Dict[str, Any]]:
        """List all active skills in the library."""
        return list(self._skills.values())

    def match_skill(self, query: str) -> Optional[Dict[str, Any]]:
        """Match query string against trigger conditions of registered skills."""
        query_lower = query.lower()
        for skill in self._skills.values():
            for condition in skill.get("trigger_conditions", []):
                if condition.lower() in query_lower:
                    return skill
        return None
