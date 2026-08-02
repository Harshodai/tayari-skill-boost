"""Unit tests for Phase 7 advanced adaptations."""

import pytest
from app.services.recruiter_outreach import RecruiterOutreach
from app.export.calendar_exporter import CalendarExporter
from app.services.graph_communities import GraphCommunitiesEngine
from app.services.token_compressor import TokenCompressor


def test_recruiter_outreach():
    draft = RecruiterOutreach.draft_outreach("Acme", "Tech Lead", "Alice", "Harshodai", ["Python", "Go"])
    assert "Acme" in draft["inmail_subject"]
    assert "Harshodai" in draft["inmail_body"]


def test_calendar_exporter():
    ics = CalendarExporter.generate_ics_event(
        summary="Interview with Acme",
        description="Technical Screen",
        start_datetime_iso="2026-08-10T14:00:00Z"
    )
    assert "BEGIN:VCALENDAR" in ics
    assert "SUMMARY:Interview with Acme" in ics


def test_graph_communities_engine():
    skills = ["Python", "Go", "Kubernetes", "React", "PyTorch"]
    clusters = GraphCommunitiesEngine.cluster_skills(skills)
    assert "Backend" in clusters
    assert "Cloud & DevOps" in clusters


def test_token_compressor():
    long_text = "A" * 3000
    res = TokenCompressor.compress_text(long_text, max_chars=1000)
    assert res["is_compressed"] is True
    assert "[... Context Compressed ...]" in res["compressed_text"]
    assert res["compressed_length"] <= 1000


def test_token_compressor_preserves_head_and_tail_within_budget():
    long_text = "H" * 1200 + "M" * 600 + "T" * 1200
    res = TokenCompressor.compress_text(long_text, max_chars=2000)
    assert res["compressed_length"] <= 2000
    assert res["compressed_text"].startswith("H")
    assert res["compressed_text"].endswith("T")
    assert "M" not in res["compressed_text"]


def test_token_compressor_budget_guard_small_max_chars():
    long_text = "A" * 3000
    res = TokenCompressor.compress_text(long_text, max_chars=30)
    assert res["compressed_length"] <= 30
    assert res["compressed_text"] == long_text[:30]


def test_token_compressor_short_text_unchanged():
    short_text = "B" * 10
    res = TokenCompressor.compress_text(short_text, max_chars=2000)
    assert res["is_compressed"] is False
    assert res["compressed_text"] == short_text
    assert res["compressed_length"] == 10
