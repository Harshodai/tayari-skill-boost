"""Memory Consolidation & Node Garbage Collector.

Inspired by TencentDB Agent Memory consolidation engine:
Deduplicates and normalizes candidate knowledge graph nodes (e.g. 'Python3', 'Python 3.x', 'Python' -> 'Python')
and prunes obsolete transient L0 session memory frames.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Set

logger = logging.getLogger(__name__)


class MemoryCleaner:
    """Consolidates duplicate graph nodes and prunes transient memory frames."""

    SYNONYM_MAP = {
        "python3": "python",
        "python 3": "python",
        "python 3.x": "python",
        "golang": "go",
        "js": "javascript",
        "ts": "typescript",
        "k8s": "kubernetes",
        "aws cloud": "aws",
        "react.js": "react",
        "reactjs": "react"
    }

    @staticmethod
    def normalize_skill(skill_name: str) -> str:
        """Normalize a skill string to its canonical canonical form."""
        clean = skill_name.strip().lower()
        return MemoryCleaner.SYNONYM_MAP.get(clean, clean)

    @staticmethod
    def consolidate_graph_nodes(nodes: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Deduplicate candidate graph nodes based on canonical skill synonyms."""
        seen_canonical: Set[str] = set()
        deduped_nodes: List[Dict[str, Any]] = []
        merged_count = 0

        for node in nodes:
            name = node.get("name") or node.get("id") or ""
            canonical = MemoryCleaner.normalize_skill(name)

            if canonical in seen_canonical:
                merged_count += 1
            else:
                seen_canonical.add(canonical)
                node_copy = dict(node)
                node_copy["canonical_name"] = canonical
                deduped_nodes.append(node_copy)

        return {
            "original_count": len(nodes),
            "consolidated_count": len(deduped_nodes),
            "nodes_merged": merged_count,
            "deduped_nodes": deduped_nodes
        }
