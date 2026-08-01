"""Skill Graph Community Detector.

Inspired by cognee graph modularity & community detection:
Clusters candidate NetworkX knowledge graph skills into distinct domain categories
(Backend, Cloud/DevOps, Frontend, Data Science).
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class GraphCommunitiesEngine:
    """Clusters candidate skill graph nodes into domain categories."""

    CATEGORIES = {
        "Backend": ["python", "go", "java", "node", "express", "fastapi", "sql", "postgresql"],
        "Cloud & DevOps": ["kubernetes", "aws", "docker", "terraform", "ci/cd", "gcp", "azure"],
        "Frontend": ["react", "typescript", "javascript", "vue", "next.js", "tailwind", "css"],
        "Data & AI": ["pandas", "numpy", "pytorch", "tensorflow", "scikit-learn", "langchain"]
    }

    @staticmethod
    def cluster_skills(skills: List[str]) -> Dict[str, List[str]]:
        """Group skills into domain community clusters."""
        clusters: Dict[str, List[str]] = {cat: [] for cat in GraphCommunitiesEngine.CATEGORIES}
        clusters["Other Skills"] = []

        for skill in skills:
            s_clean = skill.lower().strip()
            placed = False
            for cat, keywords in GraphCommunitiesEngine.CATEGORIES.items():
                if any(kw in s_clean for kw in keywords):
                    clusters[cat].append(skill)
                    placed = True
                    break
            if not placed:
                clusters["Other Skills"].append(skill)

        # Remove empty clusters
        return {k: v for k, v in clusters.items() if v}
