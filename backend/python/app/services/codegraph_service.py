"""CodeGraph Symbol Indexing & Impact Analysis Service.

Inspired by TencentDB Agent Memory CodeGraph architecture:
Indexes candidate portfolio codebases using Python's native AST parser.
Maps function and class declarations, function call graphs, and computes change impact radii.
"""

from __future__ import annotations

import ast
import logging
from typing import Any, Dict, List, Set
try:
    import networkx as nx
except ImportError:
    nx = None

logger = logging.getLogger(__name__)


class CodeGraphEngine:
    """AST-based codebase symbol indexer and impact analysis engine."""

    def __init__(self):
        if nx is not None:
            self.graph = nx.DiGraph()
        else:
            self.graph = None


    def index_source_code(self, filename: str, code_content: str) -> Dict[str, Any]:
        """Parse source code AST and add function/class symbols and call relationships."""
        if self.graph is None:
            return {"status": "error", "message": "networkx module not installed"}
        try:
            tree = ast.parse(code_content)
        except SyntaxError as exc:
            logger.warning("AST parse error in %s: %s", filename, exc)
            return {"status": "error", "message": f"Syntax error: {exc}"}

        file_node = f"file:{filename}"
        self.graph.add_node(file_node, type="file", path=filename)


        functions_found: List[str] = []
        classes_found: List[str] = []

        class SymbolVisitor(ast.NodeVisitor):
            def __init__(self, outer):
                self.outer = outer

            def visit_FunctionDef(self, node):
                func_name = node.name
                func_id = f"func:{filename}:{func_name}"
                self.outer.graph.add_node(func_id, type="function", name=func_name, line=node.lineno)
                self.outer.graph.add_edge(file_node, func_id, relationship="CONTAINS_FUNC")
                functions_found.append(func_name)
                self.generic_visit(node)

            def visit_ClassDef(self, node):
                class_name = node.name
                class_id = f"class:{filename}:{class_name}"
                self.outer.graph.add_node(class_id, type="class", name=class_name, line=node.lineno)
                self.outer.graph.add_edge(file_node, class_id, relationship="CONTAINS_CLASS")
                classes_found.append(class_name)
                self.generic_visit(node)

        visitor = SymbolVisitor(self)
        visitor.visit(tree)

        return {
            "status": "success",
            "filename": filename,
            "functions_count": len(functions_found),
            "classes_count": len(classes_found),
            "functions": functions_found,
            "classes": classes_found
        }

    def get_impact_radius(self, symbol_name: str) -> Dict[str, Any]:
        """Compute caller/callee dependencies and impact radius for a target symbol."""
        matching_nodes = [n for n in self.graph.nodes if symbol_name in n]
        if not matching_nodes:
            return {"symbol": symbol_name, "impact_radius_count": 0, "affected_nodes": []}

        target = matching_nodes[0]
        # Inbound and outbound neighbors in DiGraph
        callers = list(self.graph.predecessors(target))
        callees = list(self.graph.successors(target))
        all_affected = list(set(callers + callees))

        return {
            "symbol": symbol_name,
            "target_node": target,
            "callers": callers,
            "callees": callees,
            "impact_radius_count": len(all_affected),
            "affected_nodes": all_affected
        }
