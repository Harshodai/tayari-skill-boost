"""CodeGraph Symbol Containment Indexing & Impact Analysis Service.

Inspired by TencentDB Agent Memory CodeGraph architecture:
Indexes candidate portfolio codebases using Python's native AST parser.
Maps function and class declarations and computes change impact radii over the
symbol containment graph (file -> class -> function). This service does NOT
build function call graphs; impact analysis operates on containment edges only.
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
        """Parse source code AST and index function/class symbols into the containment graph."""
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
                # ponytail: class stack tracks the owning class so methods get
                # class-qualified IDs and attach to the class node, not the file node
                self.class_stack: List[str] = []

            def _visit_function(self, node):
                func_name = node.name
                if self.class_stack:
                    # ponytail: same-named methods in different classes must map
                    # to distinct node IDs, hence the class qualification
                    qualified_name = f"{self.class_stack[-1]}.{func_name}"
                    func_id = f"func:{filename}:{qualified_name}"
                    container_id = f"class:{filename}:{self.class_stack[-1]}"
                else:
                    func_id = f"func:{filename}:{func_name}"
                    container_id = file_node
                self.outer.graph.add_node(func_id, type="function", name=func_name, line=node.lineno)
                self.outer.graph.add_edge(container_id, func_id, relationship="CONTAINS_FUNC")
                functions_found.append(func_name)
                # ponytail: keep descending so nested defs inside the function body are indexed too
                self.generic_visit(node)

            def visit_FunctionDef(self, node):
                self._visit_function(node)

            def visit_AsyncFunctionDef(self, node):
                self._visit_function(node)

            def visit_ClassDef(self, node):
                class_name = node.name
                class_id = f"class:{filename}:{class_name}"
                self.outer.graph.add_node(class_id, type="class", name=class_name, line=node.lineno)
                self.outer.graph.add_edge(file_node, class_id, relationship="CONTAINS_CLASS")
                classes_found.append(class_name)
                self.class_stack.append(class_name)
                self.generic_visit(node)
                self.class_stack.pop()

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
        """Compute impact radius for a target symbol over its containment-graph neighbors.

        Neighbors are the containing node (file/class) and contained functions —
        the "callers/callees" keys keep their historic names, but no call edges exist.
        """
        # ponytail: guard the unavailable-graph case before touching self.graph
        if self.graph is None:
            return {"symbol": symbol_name, "impact_radius_count": 0, "affected_nodes": []}

        # ponytail: exact match on the stored `name` attribute, not substring —
        # substring matching would drag in unrelated nodes (e.g. "greeter" for "greet")
        matches = sorted(
            n for n in self.graph.nodes
            if self.graph.nodes[n].get("name") == symbol_name
        )
        if not matches:
            return {"symbol": symbol_name, "impact_radius_count": 0, "affected_nodes": []}

        if len(matches) == 1:
            target = matches[0]
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

        # ponytail: several exact matches (e.g. a module-level function and a
        # same-named method) are all reported deterministically: each sorted
        # match carries its own per-match entry, while the top-level keys
        # aggregate the union across all exact matches
        affected: Set[str] = set()
        per_match: List[Dict[str, Any]] = []
        for target in matches:
            callers = list(self.graph.predecessors(target))
            callees = list(self.graph.successors(target))
            per_match.append({
                "target_node": target,
                "callers": callers,
                "callees": callees,
                "affected_nodes": list(set(callers + callees)),
            })
            affected.update(callers)
            affected.update(callees)

        all_affected = sorted(affected)
        return {
            "symbol": symbol_name,
            "impact_radius_count": len(all_affected),
            "affected_nodes": all_affected,
            "matches": per_match
        }
