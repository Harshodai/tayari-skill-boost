"""Tests for knowledge-graph technology nodes and visualizer colors (audit finding)."""

from __future__ import annotations

from app.export.graph_visualizer import GraphVisualizer
from app.services.knowledge_graph import KnowledgeGraphExtractor


def test_build_networkx_graph_dict_includes_technology_nodes():
    graph = KnowledgeGraphExtractor.build_networkx_graph_dict(
        skills=["python"], companies=["Acme"], titles=["Engineer"], technologies=["Docker"]
    )
    node_ids = {n["id"] for n in graph["nodes"]}
    assert "technology:Docker" in node_ids
    tech_node = next(n for n in graph["nodes"] if n["id"] == "technology:Docker")
    assert tech_node["type"] == "technology"
    assert tech_node["name"] == "Docker"


def test_build_networkx_graph_dict_technology_edge_from_candidate():
    graph = KnowledgeGraphExtractor.build_networkx_graph_dict(
        skills=[], companies=[], titles=[], technologies=["Kubernetes"]
    )
    edges = [e for e in graph["links"] if e["target"] == "technology:Kubernetes"]
    assert len(edges) == 1
    assert edges[0]["source"] == "Candidate"
    assert edges[0]["relationship"] == "KNOWS_TECHNOLOGY"


def test_node_colors_has_technology_entry():
    assert "technology" in GraphVisualizer.NODE_COLORS
