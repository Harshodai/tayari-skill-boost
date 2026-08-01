"""Unit tests for Phase 13 advanced AI adaptations."""

import pytest
try:
    import networkx as nx
except ImportError:
    nx = None

from app.scoring.graph_rag_retriever import GraphRAGRetriever
from app.services.career_trajectory_predictor import CareerTrajectoryPredictor
from app.a2a.agent_consensus import AgentConsensusProtocol


def test_graph_rag_retriever():
    if nx is not None:
        G = nx.DiGraph()
        G.add_node("u1", type="candidate", name="Candidate User")
        G.add_node("s1", type="skill", name="Python Microservices")
        G.add_edge("u1", "s1")

        res = GraphRAGRetriever.retrieve_context(G, "Python Microservices")
        assert res["subgraph_nodes_count"] >= 1
        assert len(res["top_facts"]) > 0


def test_career_trajectory_predictor():
    res = CareerTrajectoryPredictor.predict_next_milestone("Senior Engineer", 6.0)
    assert res["predicted_next_title"] == "Staff Engineer"
    assert res["promotion_readiness_score"] >= 80.0


def test_agent_consensus_protocol():
    res_pass = AgentConsensusProtocol.evaluate_consensus(0.9, 0.85, 0.95)
    assert res_pass["is_approved"] is True
    assert res_pass["decision"] == "APPROVED"

    res_fail = AgentConsensusProtocol.evaluate_consensus(0.5, 0.4, 0.3)
    assert res_fail["is_approved"] is False
    assert res_fail["decision"] == "REJECTED_REVISION_REQUIRED"
