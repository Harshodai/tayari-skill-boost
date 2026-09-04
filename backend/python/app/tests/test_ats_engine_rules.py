from __future__ import annotations

from app.services.ats_engine_rules import SUPPORTED_ENGINES, diagnose_formatting

CLEAN = """John Doe
john.doe@example.com
+1 555-123-4567

SUMMARY
Data engineer with 5 years of experience.

EXPERIENCE
- Built ETL pipelines with Python and SQL from Jan 2021 to Present
- Led team of 4 engineers, cut costs 20% in 2023
- Improved data quality monitoring and documentation across multiple pipelines
- Collaborated with analytics and product teams to deliver reliable datasets

EDUCATION
BS Computer Science 2019

SKILLS
Python, SQL, Airflow, Spark
"""


def test_supported_engines():
    assert set(SUPPORTED_ENGINES) == {"greenhouse", "workday", "taleo", "lever"}


def _by_rule(results):
    return {r["rule"]: r for r in results}


def test_clean_passes_all_engines():
    for engine in SUPPORTED_ENGINES:
        results = diagnose_formatting(CLEAN, engine)
        assert results, engine
        for r in results:
            assert set(r) == {"rule", "passed", "detail"}, r
            assert r["passed"] is True, (engine, r)


def test_greenhouse_flags_fancy_bullets():
    bad = CLEAN + "\n➢ Fancy bullet line\n"
    results = _by_rule(diagnose_formatting(bad, "greenhouse"))
    assert any(not v["passed"] for v in results.values())


def test_workday_flags_tables_and_header_footer():
    bad = CLEAN + "\n| col1 | col2 |\nPage 1 of 3\n"
    results = _by_rule(diagnose_formatting(bad, "workday"))
    assert any(not v["passed"] for v in results.values())


def test_taleo_flags_graphics():
    bad = CLEAN + "\n[image: company logo]\n"
    results = _by_rule(diagnose_formatting(bad, "taleo"))
    assert any(not v["passed"] for v in results.values())


def test_lever_flags_tables():
    bad = CLEAN + "\n| a | b |\n"
    results = _by_rule(diagnose_formatting(bad, "lever"))
    assert any(not v["passed"] for v in results.values())


def test_unknown_engine_raises():
    try:
        diagnose_formatting(CLEAN, "nope")
    except ValueError:
        pass
    else:
        raise AssertionError("expected ValueError")


def test_table_markers_include_tab():
    bad = CLEAN + "\ncol1\tcol2\n"
    results = _by_rule(diagnose_formatting(bad, "greenhouse"))
    assert results["gh_no_tables"]["passed"] is False


def test_graphic_markers_have_no_duplicates():
    from app.services.ats_engine_rules import _GRAPHIC_MARKERS
    assert len(_GRAPHIC_MARKERS) == len(set(m.lower() for m in _GRAPHIC_MARKERS))


def test_semantic_adjacency_zero_means_unavailable():
    from app.services.ats_engine import heuristic_ats_score
    out = heuristic_ats_score("Python engineer with experience.", None)
    assert out["semantic_adjacency"] == 0
