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


def test_rrf_hybrid_fusion_first_payload_wins():
    list1 = [{"id": "doc1", "title": "First", "extra": "v1"}]
    list2 = [{"id": "doc1", "title": "Second", "extra": "v2"}]

    fused = RRFHybridFusion.fuse_rankings([list1, list2], id_key="id")

    assert len(fused) == 1
    assert fused[0]["title"] == "First"
    assert fused[0]["extra"] == "v1"


def test_rrf_hybrid_fusion_falsy_ids_usable():
    list1 = [{"id": 0, "title": "Zero"}]
    list2 = [{"id": 0, "title": "Zero again"}, {"id": "", "title": "Empty"}]

    fused = RRFHybridFusion.fuse_rankings([list1, list2], id_key="id")

    assert len(fused) == 2
    zero = next(item for item in fused if item["id"] == 0)
    empty = next(item for item in fused if item["id"] == "")
    assert zero["rrf_score"] == round(2 / 61, 6)
    assert empty["rrf_score"] == round(1 / 62, 6)


def test_rrf_hybrid_fusion_skips_unidentifiable_items():
    list1 = [{"id": "doc1"}, {"body": "no id, no title"}]

    fused = RRFHybridFusion.fuse_rankings([list1], id_key="id")

    assert len(fused) == 1
    assert fused[0]["id"] == "doc1"


def test_rrf_hybrid_fusion_title_fallback():
    list1 = [{"title": "Titled Only", "score": 1}, {"id": "doc1", "title": "Ided"}]

    fused = RRFHybridFusion.fuse_rankings([list1], id_key="id")

    assert len(fused) == 2
    titled = next(item for item in fused if item["title"] == "Titled Only")
    assert titled["score"] == 1
