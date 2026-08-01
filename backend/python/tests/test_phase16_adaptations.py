"""Unit tests for Phase 16 advanced AI adaptations."""

import pytest
from app.scoring.rrf_hybrid_fusion import RRFHybridFusion


def test_rrf_hybrid_fusion():
    # Dense vector ranking list
    list1 = [
        {"id": "doc1", "title": "Data Engineer Posting"},
        {"id": "doc2", "title": "Backend Posting"}
    ]

    # Keyword ranking list
    list2 = [
        {"id": "doc2", "title": "Backend Posting"},
        {"id": "doc1", "title": "Data Engineer Posting"}
    ]

    # LLM intent ranking list
    list3 = [
        {"id": "doc1", "title": "Data Engineer Posting"}
    ]

    fused = RRFHybridFusion.fuse_rankings([list1, list2, list3], id_key="id")

    assert len(fused) == 2
    assert fused[0]["id"] == "doc1"  # doc1 ranks top due to high consensus across lists
    assert fused[0]["fused_rank"] == 1
    assert fused[0]["rrf_score"] > fused[1]["rrf_score"]
