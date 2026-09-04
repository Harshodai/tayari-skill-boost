from __future__ import annotations

from app.services.skill_graph import adjacent_missing, skill_adjacency_score


def test_direct_hit_scores_one():
    assert skill_adjacency_score(["python"], ["python"]) == 1.0


def test_one_hop_neighbor_scores_half():
    assert skill_adjacency_score(["python"], ["pandas"]) == 0.5


def test_unrelated_scores_zero():
    assert skill_adjacency_score(["python"], ["welding"]) == 0.0


def test_mixed_averages_per_jd_skill():
    score = skill_adjacency_score(["python"], ["python", "welding"])
    assert score == 0.5


def test_empty_jd_scores_zero():
    assert skill_adjacency_score(["python"], []) == 0.0


def test_case_insensitive():
    assert skill_adjacency_score(["Python"], ["PYTHON"]) == 1.0


def test_chain_python_pandas_data_engineering():
    assert skill_adjacency_score(["pandas"], ["data engineering"]) == 0.5
    assert skill_adjacency_score(["python"], ["data engineering"]) == 0.0


def test_adjacent_missing_lists_one_hop_gaps():
    missing = adjacent_missing(["python"], ["pandas", "welding", "python"])
    assert "pandas" in missing
    assert "welding" not in missing
    assert "python" not in missing


def test_norm_handles_non_string_inputs():
    from app.services.skill_graph import _norm
    assert _norm(None) == ""
    assert _norm(123) == "123"
    assert skill_adjacency_score([123], ["python"]) == 0.0
