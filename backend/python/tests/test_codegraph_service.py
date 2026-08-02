"""Unit tests for the CodeGraph symbol containment indexing service."""

import pytest

from app.services.codegraph_service import CodeGraphEngine


def test_method_gets_class_qualified_id_and_class_edge():
    engine = CodeGraphEngine()
    code = """
class DataProcessor:
    def process(self):
        pass
"""
    engine.index_source_code("sample.py", code)
    file_node = "file:sample.py"
    class_node = "class:sample.py:DataProcessor"
    method_node = "func:sample.py:DataProcessor.process"

    assert engine.graph.has_node(class_node)
    assert engine.graph.has_node(method_node)
    assert engine.graph.nodes[method_node]["name"] == "process"
    # method edge attaches to the class node, not the file node
    assert engine.graph.get_edge_data(class_node, method_node, {}).get("relationship") == "CONTAINS_FUNC"
    assert engine.graph.get_edge_data(file_node, method_node, {}) == {}


def test_same_method_name_in_two_classes_yields_distinct_nodes():
    engine = CodeGraphEngine()
    code = """
class Alpha:
    def render(self):
        pass

class Beta:
    def render(self):
        pass
"""
    engine.index_source_code("sample.py", code)
    assert engine.graph.has_node("func:sample.py:Alpha.render")
    assert engine.graph.has_node("func:sample.py:Beta.render")
    assert engine.graph.nodes["func:sample.py:Alpha.render"]["name"] == "render"
    assert engine.graph.nodes["func:sample.py:Beta.render"]["name"] == "render"


def test_file_level_function_gets_file_edge_and_file_qualified_id():
    engine = CodeGraphEngine()
    engine.index_source_code("sample.py", "def greet(name):\n    return f'Hello {name}'\n")
    file_node = "file:sample.py"
    func_node = "func:sample.py:greet"

    assert engine.graph.has_node(func_node)
    assert engine.graph.nodes[func_node]["name"] == "greet"
    assert engine.graph.get_edge_data(file_node, func_node, {}).get("relationship") == "CONTAINS_FUNC"


def test_async_def_is_indexed_like_regular_function():
    engine = CodeGraphEngine()
    code = """
async def fetch():
    return 1
"""
    result = engine.index_source_code("sample.py", code)
    assert result["status"] == "success"
    assert result["functions_count"] == 1
    assert "fetch" in result["functions"]
    assert engine.graph.has_node("func:sample.py:fetch")
    assert engine.graph.get_edge_data("file:sample.py", "func:sample.py:fetch", {}).get("relationship") == "CONTAINS_FUNC"


def test_async_def_nested_inside_class_is_class_qualified():
    engine = CodeGraphEngine()
    code = """
class Client:
    async def connect(self):
        pass
"""
    engine.index_source_code("sample.py", code)
    assert engine.graph.has_node("func:sample.py:Client.connect")
    assert engine.graph.get_edge_data(
        "class:sample.py:Client", "func:sample.py:Client.connect", {}
    ).get("relationship") == "CONTAINS_FUNC"


def test_impact_radius_returns_zero_impact_when_graph_unavailable():
    engine = CodeGraphEngine()
    engine.graph = None
    impact = engine.get_impact_radius("greet")
    assert impact == {"symbol": "greet", "impact_radius_count": 0, "affected_nodes": []}


def test_impact_radius_unknown_symbol_returns_zero_impact():
    engine = CodeGraphEngine()
    engine.index_source_code("sample.py", "def greet():\n    pass\n")
    impact = engine.get_impact_radius("missing")
    assert impact == {"symbol": "missing", "impact_radius_count": 0, "affected_nodes": []}


def test_impact_radius_single_match_preserves_legacy_keys():
    engine = CodeGraphEngine()
    engine.index_source_code("sample.py", "def greet(name):\n    return name\n")
    impact = engine.get_impact_radius("greet")

    assert impact["symbol"] == "greet"
    assert impact["target_node"] == "func:sample.py:greet"
    assert impact["callers"] == ["file:sample.py"]
    assert impact["callees"] == []
    assert impact["impact_radius_count"] == 1
    assert impact["affected_nodes"] == ["file:sample.py"]


def test_impact_radius_exact_match_only_ignores_substring_likes():
    engine = CodeGraphEngine()
    code = """
def greet(name):
    return name

def greeter():
    return "hi"

class Handler:
    def greet(self):
        pass
"""
    engine.index_source_code("sample.py", code)
    impact = engine.get_impact_radius("greet")

    # exact matches only: module-level greet + Handler.greet, never "greeter"
    matched_nodes = [m["target_node"] for m in impact["matches"]]
    assert matched_nodes == ["func:sample.py:Handler.greet", "func:sample.py:greet"]
    for match in impact["matches"]:
        assert "greeter" not in match["target_node"]

    # top-level keys aggregate the union across all exact matches
    assert impact["symbol"] == "greet"
    assert impact["impact_radius_count"] == 2
    assert impact["affected_nodes"] == ["class:sample.py:Handler", "file:sample.py"]
