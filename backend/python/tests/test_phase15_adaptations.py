"""Unit tests for Phase 15 unified hybrid vector + graph RAG + LLM role search engine."""

import pytest
from fastapi.testclient import TestClient
try:
    import networkx as nx
except ImportError:
    nx = None

from app.main import app
from app.scoring.hybrid_job_search_engine import HybridJobSearchEngine

client = TestClient(app)


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


@pytest.mark.parametrize("skills", [None, []])
def test_hybrid_job_search_engine_rejects_empty_skills(skills):
    with pytest.raises(ValueError, match="candidate_skills must be a non-empty list"):
        HybridJobSearchEngine.search_and_rank_postings(
            query_role="Data Engineer",
            job_postings=[{"title": "x", "description": "y"}],
            candidate_skills=skills
        )


@pytest.mark.parametrize("skills", [None, []])
def test_hybrid_job_search_endpoint_rejects_empty_skills(skills):
    body = {
        "query_role": "Data Engineer",
        "job_postings": [{"title": "Analytics Platform Wrangler", "description": "ETL pipelines using PySpark and Airflow"}],
        "candidate_skills": skills,
    }
    res = client.post("/api/v1/adaptations/hybrid-job-search", json=body)
    assert res.status_code == 400


def test_hybrid_job_search_missing_fit_score_contributes_zero(monkeypatch):
    def fake_evaluate_5d_fit(*args, **kwargs):
        return {"dimensions": {}}

    monkeypatch.setattr("app.scoring.hybrid_job_search_engine.evaluate_5d_fit", fake_evaluate_5d_fit)
    res = HybridJobSearchEngine.search_and_rank_postings(
        query_role="Data Engineer",
        job_postings=[
            {"id": "p1", "title": "Analytics Platform Wrangler", "description": "data pipelines using PySpark and Airflow"}
        ],
        candidate_skills=["Python", "SQL"]
    )

    assert res["total_postings_evaluated"] == 1
    ranked = res["ranked_postings"]
    assert ranked[0]["ats_5d_fit_score"] == 0.0
    assert all(r["ats_5d_fit_score"] != 80.0 for r in ranked)
    assert abs(
        ranked[0]["combined_hybrid_score"]
        - (ranked[0]["semantic_match_score"] * 0.4 + ranked[0]["vector_similarity_score"] * 0.3)
    ) < 0.02
