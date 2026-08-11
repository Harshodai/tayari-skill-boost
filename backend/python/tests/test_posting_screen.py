"""Tests for the merged WS-08 posting screen (ex end_to_end_pipeline guardrails)."""

import pytest

from app.services import posting_screen
from app.services.posting_screen import screen_posting

JD = "Hiring a Data Engineer to build ETL pipelines with PySpark, Airflow, and Snowflake in Python and SQL."


def test_clears_a_legitimate_matching_posting():
    res = screen_posting("Data Engineer", "Data Engineer", JD)
    assert res["status"] == "CLEARED"
    assert res["ghost_job_risk"]["status"] == "ok"


def test_blocks_ghost_job(monkeypatch):
    monkeypatch.setattr(
        posting_screen.LegitimacyChecker,
        "evaluate_posting_legitimacy",
        lambda title, description: {"is_ghost_job_risk": True, "ghost_job_risk_score": 80.0},
    )
    assert screen_posting("Data Engineer", "Data Engineer", JD)["status"] == "BLOCKED_HIGH_GHOST_JOB_RISK"


def test_blocks_role_mismatch(monkeypatch):
    monkeypatch.setattr(
        posting_screen.SemanticRoleMatcher,
        "classify_posting",
        lambda target_role, job_title, job_description: {"is_semantically_matched": False},
    )
    assert screen_posting("Data Engineer", "Chef de Partie", JD)["status"] == "BLOCKED_ROLE_MISMATCH"


def test_ghost_stage_crash_fails_closed(monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("checker exploded")

    monkeypatch.setattr(posting_screen.LegitimacyChecker, "evaluate_posting_legitimacy", boom)
    res = screen_posting("Data Engineer", "Data Engineer", JD)
    assert res["ghost_job_risk"]["status"] == "failed"
    assert res["status"] == "BLOCKED_HIGH_GHOST_JOB_RISK"


def test_no_target_role_skips_role_gate():
    res = screen_posting("", "Data Engineer", JD)
    assert res["semantic_role_match"].get("skipped") is True
    assert res["status"] == "CLEARED"
