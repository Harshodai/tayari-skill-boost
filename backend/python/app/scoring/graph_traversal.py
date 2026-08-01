"""Multi-Hop Graph Traversal Engine.

Inspired by cognee multi-hop graph traversal architecture:
Traces multi-hop paths and shortest topological distances between a candidate's existing
skills and target role requirements in NetworkX candidate knowledge graphs.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
try:
    import networkx as nx
except ImportError:
    nx = None

logger = logging.getLogger(__name__)


class GraphTraversalEngine:
    """Computes multi-hop paths and topological distances in candidate skill graphs."""

    @staticmethod
    def find_skill_pathways(G: Any, start_node: str, target_node: str) -> Dict[str, Any]:
        """Find shortest paths and intermediate connecting nodes between two graph nodes."""
        if G is None or nx is None or not G.has_node(start_node) or not G.has_node(target_node):
            return {"has_path": False, "path_length": -1, "path": []}

        try:
            path = nx.shortest_path(G, source=start_node, target=target_node)
            length = len(path) - 1
            return {
                "has_path": True,
                "path_length": length,
                "path": path,
                "intermediate_nodes": path[1:-1]
            }
        except Exception:
            return {"has_path": False, "path_length": -1, "path": []}
