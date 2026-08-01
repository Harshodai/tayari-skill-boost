"""Unit tests for Phase 12 advanced AI adaptations."""

import pytest
from app.ai_proofing.advanced_ai_refiner import AdvancedAIRefiner
from app.scoring.vector_embedding_reranker import VectorEmbeddingReranker


def test_advanced_ai_refiner():
    facts = ["python", "kubernetes", "aws"]
    res = AdvancedAIRefiner.run_reasoning_chain(
        raw_bullet="Wrote python code",
        job_requirement="kubernetes",
        verified_candidate_facts=facts
    )
    assert res["is_verified"] is True
    assert "thinking_trace" in res
    assert res["final_confidence_score"] >= 80.0


def test_refiner_proposal_incorporates_raw_bullet():
    facts = ["python", "kubernetes"]
    res = AdvancedAIRefiner.run_reasoning_chain(
        raw_bullet="Optimized container startup",
        job_requirement="kubernetes",
        verified_candidate_facts=facts,
    )
    assert "optimized container startup" in res["proposal"].lower()
    assert "kubernetes" in res["proposal"]


def test_refiner_identical_requirement_tailors_per_bullet():
    facts = ["python", "kubernetes"]
    res_a = AdvancedAIRefiner.run_reasoning_chain("Wrote python code", "kubernetes", facts)
    res_b = AdvancedAIRefiner.run_reasoning_chain("Hardened docker images", "kubernetes", facts)
    assert res_a["proposal"] != res_b["proposal"]
    assert "wrote python code" in res_a["proposal"].lower()
    assert "hardened docker images" in res_b["proposal"].lower()


def test_refiner_empty_facts_yield_no_empty_verified_claim():
    res = AdvancedAIRefiner.run_reasoning_chain(
        raw_bullet="Optimized container startup",
        job_requirement="kubernetes",
        verified_candidate_facts=[],
    )
    refined = res["refined_bullet"]
    assert refined.strip()
    assert "verified experience" not in refined.lower()
    assert "to address kubernetes" in refined


def test_refiner_invalid_branch_keeps_fact_wording_when_facts_exist():
    res = AdvancedAIRefiner.run_reasoning_chain(
        raw_bullet="Wrote python code",
        job_requirement="kubernetes",
        verified_candidate_facts=["python"],
    )
    assert "verified experience" in res["refined_bullet"].lower()
    assert "python" in res["refined_bullet"].lower()


def test_vector_embedding_reranker():
    bullets = [
        "Built frontend components in React",
        "Architected Python microservices with Kubernetes on AWS",
        "Managed SQL database backups"
    ]
    query = "Python Kubernetes microservices"
    ranked = VectorEmbeddingReranker.rank_bullets_by_relevance(bullets, query)

    assert len(ranked) == 3
    assert ranked[0]["bullet"] == "Architected Python microservices with Kubernetes on AWS"
    assert ranked[0]["rank"] == 1
    assert ranked[0]["similarity_score"] > 0.5
