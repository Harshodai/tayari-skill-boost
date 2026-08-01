"""Sub-Graph Frontend Visualizer Data Generator.

Inspired by cognee visualization modules:
Converts NetworkX candidate knowledge graphs into React Flow / D3.js compatible
node-edge JSON data structures with custom styling and node categories.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List
try:
    import networkx as nx
except ImportError:
    nx = None

logger = logging.getLogger(__name__)


class GraphVisualizer:
    """Converts NetworkX graphs into React Flow / D3 visualization payloads."""

    NODE_COLORS = {
        "person": "#38bdf8",
        "skill": "#4ade80",
        "company": "#f43f5e",
        "role": "#a855f7",
        "file": "#f59e0b",
        "function": "#06b6d4"
    }

    @staticmethod
    def to_react_flow_json(G: Any) -> Dict[str, Any]:
        """Convert NetworkX DiGraph to React Flow nodes and edges array."""
        nodes: List[Dict[str, Any]] = []
        edges: List[Dict[str, Any]] = []

        if G is None or nx is None:
            return {"nodes": [], "edges": [], "total_nodes": 0, "total_edges": 0}

        pos = nx.spring_layout(G) if len(G.nodes) > 0 else {}


        for i, (node_id, data) in enumerate(G.nodes(data=True)):
            n_type = data.get("type", "default")
            color = GraphVisualizer.NODE_COLORS.get(n_type, "#94a3b8")
            label = data.get("name") or data.get("label") or str(node_id)
            coords = pos.get(node_id, (i * 50, i * 50))

            nodes.append({
                "id": str(node_id),
                "data": {"label": label, "type": n_type},
                "position": {"x": float(coords[0] * 300), "y": float(coords[1] * 300)},
                "style": {"background": color, "color": "#0f172a", "borderRadius": "8px", "padding": "10px"}
            })

        for u, v, data in G.edges(data=True):
            rel = data.get("relationship", "CONNECTED")
            edges.append({
                "id": f"e-{u}-{v}",
                "source": str(u),
                "target": str(v),
                "label": rel,
                "animated": True
            })

        return {
            "nodes": nodes,
            "edges": edges,
            "total_nodes": len(nodes),
            "total_edges": len(edges)
        }
