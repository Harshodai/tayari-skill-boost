"""Unit tests for KeywordDensityOptimizer (audit: lookaround boundaries + aggregate density)."""

from app.scoring.keyword_density_optimizer import KeywordDensityOptimizer


def test_lookaround_boundaries_match_symbol_keywords():
    resume = "C++ developer, .NET engineer, C# specialist."
    res = KeywordDensityOptimizer.analyze_keyword_density(resume, ["C++", ".NET", "C#"])

    assert res["keyword_counts"]["C++"] == 1
    assert res["keyword_counts"][".NET"] == 1
    assert res["keyword_counts"]["C#"] == 1


def test_lookaround_boundaries_match_adjacent_symbol_keywords():
    resume = "Fluent in C#.NET and C++."
    res = KeywordDensityOptimizer.analyze_keyword_density(resume, ["C++", ".NET", "C#"])

    assert res["keyword_counts"]["C#"] == 1
    assert res["keyword_counts"][".NET"] == 1
    assert res["keyword_counts"]["C++"] == 1


def test_aggregate_density_within_range_despite_low_per_keyword():
    keywords = ["python", "go", "java", "swift", "rust"]
    filler = " ".join(f"word{i}" for i in range(125))
    resume = " ".join(keywords + [filler])
    res = KeywordDensityOptimizer.analyze_keyword_density(resume, keywords)

    assert res["total_resume_words"] == 130
    for kw in keywords:
        assert res["keyword_counts"][kw] == 1
    assert res["keyword_densities"]["python"] < 2.0

    assert len(res["recommendations"]) == 5
    assert all("Increase usage of" in rec for rec in res["recommendations"])
    assert all("overall keyword usage" not in rec for rec in res["recommendations"])


def test_aggregate_density_above_max_triggers_overall_recommendation():
    resume = "python python python python python go"
    res = KeywordDensityOptimizer.analyze_keyword_density(resume, ["python", "go"])

    assert any("Reduce over-stuffed keywords overall" in rec for rec in res["recommendations"])


def test_per_keyword_over_stuffing_uses_occurrence_count():
    resume = " ".join(["go"] * 11)
    res = KeywordDensityOptimizer.analyze_keyword_density(resume, ["go"])

    assert res["keyword_counts"]["go"] == 11
    assert any("Reduce over-stuffed keyword 'go'" in rec for rec in res["recommendations"])


def test_empty_target_keywords_is_non_optimal():
    res = KeywordDensityOptimizer.analyze_keyword_density("Some resume text here.", [])

    assert res["keyword_counts"] == {}
    assert res["is_optimal"] is False
    assert any("No target keywords provided" in rec for rec in res["recommendations"])


def test_keyword_densities_remain_per_keyword_percentages():
    res = KeywordDensityOptimizer.analyze_keyword_density("Python Python Python", ["Python", "Go"])

    assert res["keyword_counts"]["Python"] == 3
    assert res["keyword_densities"]["Python"] == 100.0
    assert res["keyword_densities"]["Go"] == 0.0
