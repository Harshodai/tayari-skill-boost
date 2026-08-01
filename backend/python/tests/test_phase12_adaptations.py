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
