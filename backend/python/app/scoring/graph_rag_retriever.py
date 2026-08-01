"""Graph RAG Hybrid Context Retrieval Engine.

Inspired by cognee Graph RAG retrieval:
Combines vector similarity search with 2-hop NetworkX sub-graph context expansion
to retrieve candidate facts grounded in relational graph topology.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List
try:
    import networkx as nx
except ImportError:
    nx = None

from app.scoring.vector_embedding_reranker import VectorEmbeddingReranker

logger = logging.getLogger(__name__)


class GraphRAGRetriever:
    """Hybrid Graph RAG retrieval engine."""

    @staticmethod
    def retrieve_context(
        G: Any,
        query: str,
        max_facts: int = 5
    ) -> Dict[str, Any]:
        """Perform Graph RAG hybrid retrieval (vector similarity + 2-hop sub-graph context)."""
        if G is None or nx is None:
            return {"query": query, "ranked_facts": [], "subgraph_nodes_count": 0}

        # 1. Extract all node labels and facts
        node_facts = []
        for n, data in G.nodes(data=True):
            fact_str = f"{data.get('type', 'entity')}: {data.get('name', str(n))}"
            node_facts.append((n, fact_str))

        if not node_facts:
            return {"query": query, "ranked_facts": [], "subgraph_nodes_count": 0}

        fact_texts = [f[1] for f in node_facts]

        # 2. Vector re-ranking
        ranked = VectorEmbeddingReranker.rank_bullets_by_relevance(fact_texts, query)

        # 3. 2-hop sub-graph expansion for top nodes
        top_facts = ranked[:max_facts]
        expanded_nodes = set()

        for item in top_facts:
            # find original node
            for n, f_str in node_facts:
                if f_str == item["bullet"]:
                    expanded_nodes.add(n)
                    # Add 2-hop neighbors
                    for neighbor in G.neighbors(n):
                        expanded_nodes.add(neighbor)
                        for neighbor_2hop in G.neighbors(neighbor):
                            expanded_nodes.add(neighbor_2hop)

        return {
            "query": query,
            "top_facts": [item["bullet"] for item in top_facts],
            "subgraph_nodes_count": len(expanded_nodes),
            "expanded_node_ids": list(expanded_nodes)
        }
