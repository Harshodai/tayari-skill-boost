"""Unit tests for MemoryCleaner graph node consolidation."""

from app.memory.memory_cleaner import MemoryCleaner


def test_nameless_nodes_all_retained_none_merged():
    nodes = [{"value": "a"}, {"value": "b"}, {"value": "c"}]
    res = MemoryCleaner.consolidate_graph_nodes(nodes)

    assert res["original_count"] == 3
    assert res["consolidated_count"] == 3
    assert res["nodes_merged"] == 0
    assert [n["value"] for n in res["deduped_nodes"]] == ["a", "b", "c"]


def test_nameless_nodes_with_empty_string_name_and_id():
    nodes = [{"name": "", "id": ""}, {"name": None, "id": None}, {}]
    res = MemoryCleaner.consolidate_graph_nodes(nodes)

    assert res["consolidated_count"] == 3
    assert res["nodes_merged"] == 0


def test_named_synonyms_still_merge():
    nodes = [{"name": "Python3"}, {"name": "Python 3.x"}, {"name": "Go"}]
    res = MemoryCleaner.consolidate_graph_nodes(nodes)

    assert res["consolidated_count"] == 2
    assert res["nodes_merged"] == 1
    canonicals = {n["canonical_name"] for n in res["deduped_nodes"]}
    assert canonicals == {"python", "go"}


def test_mixed_named_and_nameless():
    nodes = [{"name": "Python3"}, {"name": "Python"}, {"value": "x"}, {"value": "y"}]
    res = MemoryCleaner.consolidate_graph_nodes(nodes)

    assert res["consolidated_count"] == 3
    assert res["nodes_merged"] == 1
    assert len(res["deduped_nodes"]) == 3


def test_id_falls_through_when_name_missing():
    nodes = [{"id": "Python3"}, {"name": "Python"}]
    res = MemoryCleaner.consolidate_graph_nodes(nodes)

    assert res["consolidated_count"] == 1
    assert res["nodes_merged"] == 1
