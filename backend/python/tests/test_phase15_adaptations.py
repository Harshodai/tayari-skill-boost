"""Unit tests for Phase 15 unified hybrid vector + graph RAG + LLM role search engine."""

import pytest
try:
    import networkx as nx
except ImportError:
    nx = None

from app.scoring.hybrid_job_search_engine import HybridJobSearchEngine


def test_hybrid_job_search_engine():
    query_role = "Data Engineer"
    postings = [
        {
            "id": "p1",
            "title": "Analytics Platform Wrangler",
            "description": "We are seeking a specialist to build data engineer pipelines using PySpark and Airflow."
        },
        {
            "id": "p2",
            "title": "Frontend UI Developer",
            "description": "Building React and Tailwind user interfaces."
        }
    ]

    G = None
    if nx is not None:
        G = nx.DiGraph()
        G.add_node("u1", type="candidate", name="Candidate User")
        G.add_node("s1", type="skill", name="Data Engineer")
        G.add_edge("u1", "s1")

    res = HybridJobSearchEngine.search_and_rank_postings(
        query_role=query_role,
        job_postings=postings,
        candidate_skills=["Python", "SQL", "Airflow"],
        candidate_graph=G
    )

    assert res["total_postings_evaluated"] == 2
    assert res["ranked_postings"][0]["posting_id"] == "p1"
    assert res["ranked_postings"][0]["is_semantically_matched"] is True
    assert res["ranked_postings"][0]["combined_hybrid_score"] > 70.0
