"""
JobTayari Unhobbling Stack — Public Interface.

Four-layer harness grounded in:
  Layer 2 (REPL/Environment): RLM arXiv:2512.24601 — recursive variable virtualization
  Layer 3 (Pipeline): DSPy arXiv:2310.03714 — typed Pydantic signatures
  Layer 4 (Harness): Meta-Harness arXiv:2603.28052 + DGM arXiv:2505.22954
  Multi-tenant: qm architecture (yc-software/qm) — per-user workspace isolation
"""
from app.unhobbling.state import (
    JobTayariHarnessState,
    VariableHandleMeta,
    ExecutionResultDict,
    LineageEntry,
    new_state,
)
from app.unhobbling.repl_gate import execute_sandbox_code, VirtualizedREPL
from app.unhobbling.signatures import (
    SkillExtractionOutput,
    AssessmentGenOutput,
    CodeActionOutput,
    CodeRepairOutput,
    HarnessSignatureRegistry,
)
from app.unhobbling.router import hard_validation_gate, deterministic_conditional_edge
from app.unhobbling.logging_middleware import HierarchicalLoggingMiddleware
from app.unhobbling.orchestrator import JobTayariOrchestrator
from app.unhobbling.multi_tenant import TenantWorkspace

__all__ = [
    "JobTayariHarnessState", "VariableHandleMeta", "ExecutionResultDict",
    "LineageEntry", "new_state",
    "execute_sandbox_code", "VirtualizedREPL",
    "SkillExtractionOutput", "AssessmentGenOutput", "CodeActionOutput",
    "CodeRepairOutput", "HarnessSignatureRegistry",
    "hard_validation_gate", "deterministic_conditional_edge",
    "HierarchicalLoggingMiddleware",
    "JobTayariOrchestrator",
    "TenantWorkspace",
]
