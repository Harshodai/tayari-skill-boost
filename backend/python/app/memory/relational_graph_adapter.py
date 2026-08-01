"""Relational Graph Storage Adapter.

Inspired by cognee relational graph storage modules:
Maps NetworkX candidate knowledge graph nodes and edges to relational database schemas
(nodes and edges table rows) for PostgreSQL / Supabase persistence.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List
try:
    import networkx as nx
except ImportError:
    nx = None

logger = logging.getLogger(__name__)


class RelationalGraphAdapter:
    """Serializes NetworkX DiGraph nodes and edges for relational database persistence."""

    @staticmethod
    def to_relational_tables(G: Any, user_id: str) -> Dict[str, Any]:
        """Convert NetworkX graph into relational nodes and edges list for SQL insertion."""
        node_rows: List[Dict[str, Any]] = []
        edge_rows: List[Dict[str, Any]] = []

        if G is None or nx is None:
            return {"user_id": user_id, "nodes_table": node_rows, "edges_table": edge_rows}

        for node_id, data in G.nodes(data=True):
            node_rows.append({
                "user_id": user_id,
                "node_id": str(node_id),
                "node_type": data.get("type", "entity"),
                "node_name": data.get("name") or str(node_id),
                "attributes_json": data
            })

        for u, v, data in G.edges(data=True):
            edge_rows.append({
                "user_id": user_id,
                "source_node_id": str(u),
                "target_node_id": str(v),
                "relationship_type": data.get("relationship", "CONNECTED"),
                "attributes_json": data
            })

        return {
            "user_id": user_id,
            "nodes_count": len(node_rows),
            "edges_count": len(edge_rows),
            "nodes_table": node_rows,
            "edges_table": edge_rows
        }
