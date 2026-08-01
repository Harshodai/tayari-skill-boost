"""Unit tests for Phase 9 advanced adaptations."""

import pytest
from app.services.style_delta_logger import StyleDeltaLogger
from app.services.response_sentiment_analyzer import ResponseSentimentAnalyzer
from app.guardrails.entity_disambiguator import EntityDisambiguator
from app.a2a.session_snapshotter import SessionSnapshotter


def test_style_delta_logger():
    metrics1 = StyleDeltaLogger.compute_style_metrics("I developed and built python apps.")
    metrics2 = StyleDeltaLogger.compute_style_metrics("I architected, engineered, scaled, led, and optimized backend apps.")
    delta = StyleDeltaLogger.compute_delta(metrics1, metrics2)

    assert metrics2["action_verb_count"] == 5
    assert delta["improved_action_density"] is True


def test_response_sentiment_analyzer():
    res1 = ResponseSentimentAnalyzer.classify_response("We are pleased to offer you the position!")
    assert res1["category"] == "OFFER"

    res2 = ResponseSentimentAnalyzer.classify_response("We regret to inform you that we decided to pursue other candidates.")
    assert res2["category"] == "REJECTION"


def test_entity_disambiguator():
    res = EntityDisambiguator.disambiguate_term("Go", "Backend Golang concurrency programming")
    assert res["canonical_entity"] == "Go (Programming Language)"
    assert res["confidence"] == 0.95


def test_session_snapshotter():
    snapshotter = SessionSnapshotter()
    snapshotter.create_snapshot("s1", {"builder": "ready"}, ["step 1"])
    restored = snapshotter.restore_snapshot("s1")

    assert restored is not None
    assert restored["session_id"] == "s1"
    assert restored["agent_states"]["builder"] == "ready"
