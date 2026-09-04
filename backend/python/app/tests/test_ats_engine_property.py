from __future__ import annotations

import pytest

from app.services.ats_engine import heuristic_ats_score


def _assert_score_invariants(result: dict) -> None:
    assert 0 <= result["score"] <= 100
    assert 0 <= result["ats_score"] <= 100
    assert result["ats_score"] == result["score"]
    assert 0 <= result["score_before_penalties"] <= 100
    assert result["checks"], "checks list must be non-empty"
    penalty = result["evidence"]["stuffing"]["stuffing_penalty"]
    assert penalty >= 0
    assert result["score"] == max(0, result["score_before_penalties"] - penalty)
    assert result["score"] <= result["score_before_penalties"]


def test_empty_resume_in_bounds():
    _assert_score_invariants(heuristic_ats_score("", "python engineer"))


def test_empty_resume_no_jd_in_bounds():
    _assert_score_invariants(heuristic_ats_score("", None))


def test_50k_char_resume_in_bounds():
    _assert_score_invariants(heuristic_ats_score("x" * 50000, "python engineer"))


def test_unicode_only_resume_in_bounds():
    _assert_score_invariants(heuristic_ats_score("日本語テスト🎉résumé naïve façade", "python engineer"))


def test_rtl_resume_in_bounds():
    _assert_score_invariants(heuristic_ats_score("مرحبا بالعالم עברית שלום", "python engineer"))


def test_homoglyph_adversarial_in_bounds():
    _assert_score_invariants(heuristic_ats_score("pуthon jаva (cyrillic lookalikes)", "python java engineer"))


def test_score_bounds_property():
    pytest.importorskip("hypothesis", reason="pip install hypothesis for property tests")
    from hypothesis import given, settings, strategies as st

    @given(st.text(max_size=300), st.one_of(st.none(), st.text(max_size=300)))
    @settings(max_examples=25, deadline=None)
    def inner(resume_text, jd_text):
        result = heuristic_ats_score(resume_text, jd_text)
        assert 0 <= result["score"] <= 100
        assert 0 <= result["score_before_penalties"] <= 100

    inner()


def test_penalty_never_exceeds_total_property():
    pytest.importorskip("hypothesis", reason="pip install hypothesis for property tests")
    from hypothesis import given, settings, strategies as st

    @given(st.text(max_size=300), st.one_of(st.none(), st.text(max_size=300)))
    @settings(max_examples=25, deadline=None)
    def inner(resume_text, jd_text):
        result = heuristic_ats_score(resume_text, jd_text)
        penalty = result["evidence"]["stuffing"]["stuffing_penalty"]
        assert penalty >= 0
        assert result["score"] == max(0, result["score_before_penalties"] - penalty)

    inner()


def test_checks_nonempty_property():
    pytest.importorskip("hypothesis", reason="pip install hypothesis for property tests")
    from hypothesis import given, settings, strategies as st

    @given(st.text(max_size=300), st.one_of(st.none(), st.text(max_size=300)))
    @settings(max_examples=25, deadline=None)
    def inner(resume_text, jd_text):
        assert heuristic_ats_score(resume_text, jd_text)["checks"]

    inner()


def test_determinism_property():
    pytest.importorskip("hypothesis", reason="pip install hypothesis for property tests")
    from hypothesis import given, settings, strategies as st

    @given(st.text(max_size=300), st.one_of(st.none(), st.text(max_size=300)))
    @settings(max_examples=25, deadline=None)
    def inner(resume_text, jd_text):
        first = heuristic_ats_score(resume_text, jd_text)
        second = heuristic_ats_score(resume_text, jd_text)
        assert first["score"] == second["score"]
        assert first["score_before_penalties"] == second["score_before_penalties"]

    inner()
