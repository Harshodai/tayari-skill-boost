"""
Milestone 1: Sandboxed REPL Gate with sys.stdout/sys.stderr interception.

Implements the REPL & Environment Layer from RLM (arXiv:2512.24601 §3):
- The LLM generates Python code that operates on variable HANDLES (keys),
  not raw text. The sandbox resolves handles to actual text slices internally.
- sys.stdout is intercepted via io.StringIO — no subprocess needed for
  simple in-process logic, preserving the execution trace for Meta-Harness logging.
- The existing CodeActREPL subprocess boundary (codeact_repl.py) is used as
  the Level-2 sandbox for untrusted/complex code.

Security contract (inherited from codeact_repl.py + extended here):
- AST pre-check rejects dangerous imports and private attribute access.
- VirtualizedREPL exposes only safe utility functions: get_variable(), 
  slice_variable(), search_variable(), token_count(), list_variables().
- No production secrets leak into the sandbox environment.
"""
from __future__ import annotations

import ast
import ctypes
import hashlib
import io
import threading
import time
from contextlib import redirect_stderr, redirect_stdout
from typing import Any, Dict, List, Optional

from app.unhobbling.state import ExecutionResultDict, JobTayariHarnessState

# Modules allowed in sandbox code (mirrors codeact_repl.py VETTED_MODULES)
_SAFE_IMPORTS = frozenset({
    "math", "json", "re", "datetime", "collections", "itertools",
    "functools", "string", "decimal", "fractions", "statistics",
    "textwrap", "unicodedata", "enum", "dataclasses", "typing",
    "abc", "copy",
})

_DISALLOWED_IMPORTS = frozenset({
    "os", "sys", "subprocess", "socket", "importlib", "ctypes",
    "builtins", "__builtin__", "_thread", "threading", "multiprocessing",
    "urllib", "http", "requests", "pickle", "marshal", "shlex", "pty",
})

_DISALLOWED_BUILTINS = frozenset({
    "eval", "exec", "compile", "open", "input", "__import__",
    "exit", "quit", "getattr", "setattr", "delattr",
})

_BLOCKED_ATTRIBUTES = frozenset({
    "sys", "modules", "system", "popen", "subprocess",
    "__class__", "__subclasses__", "__bases__", "__mro__",
    "__globals__", "__builtins__", "__code__", "__func__",
    "gi_frame", "gi_code", "co_consts", "f_locals", "f_globals",
})

_SAFE_AST_NODES = frozenset({
    ast.Expression, ast.BinOp, ast.UnaryOp, ast.BoolOp, ast.Compare,
    ast.IfExp, ast.Constant, ast.Name, ast.Load, ast.Store, ast.Del,
    ast.List, ast.Tuple, ast.Set, ast.Dict, ast.Subscript,
    ast.Slice, ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp,
    ast.comprehension, ast.Call, ast.Attribute, ast.keyword,
    ast.Assign, ast.AnnAssign, ast.AugAssign, ast.Expr, ast.Pass,
    ast.If, ast.For, ast.While, ast.Break, ast.Continue,
    ast.Try, ast.ExceptHandler, ast.Raise, ast.Assert,
    ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda, ast.Return,
    ast.arguments, ast.arg, ast.Module, ast.JoinedStr, ast.FormattedValue,
    ast.Add, ast.Sub, ast.Mult, ast.Div, ast.FloorDiv, ast.Mod, ast.Pow,
    ast.LShift, ast.RShift, ast.BitOr, ast.BitXor, ast.BitAnd,
    ast.MatMult, ast.USub, ast.UAdd, ast.Not, ast.Invert,
    ast.Eq, ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE,
    ast.Is, ast.IsNot, ast.In, ast.NotIn, ast.And, ast.Or,
    ast.NamedExpr, ast.Import, ast.ImportFrom, ast.alias,
})


class SecurityError(Exception):
    """Raised when code fails the AST security pre-check."""


def _ast_security_check(code: str) -> None:
    """
    Static AST guard — reject dangerous imports and disallowed builtins.
    Raises SecurityError with a descriptive message if the check fails.
    """
    try:
        tree = ast.parse(code, mode="exec")
    except SyntaxError as exc:
        raise SecurityError(f"SyntaxError in submitted code: {exc}") from exc

    for node in ast.walk(tree):
        if type(node) not in _SAFE_AST_NODES:
            raise SecurityError(
                f"Disallowed AST node type: {type(node).__name__}. "
                "Only safe Python constructs are permitted."
            )
        if isinstance(node, ast.Import):
            for alias in node.names:
                root = alias.name.split(".")[0]
                if root not in _SAFE_IMPORTS:
                    raise SecurityError(
                        f"Disallowed import: '{alias.name}'. "
                        f"Only {sorted(_SAFE_IMPORTS)} are permitted."
                    )
        elif isinstance(node, ast.ImportFrom):
            root = (node.module or "").split(".")[0]
            if root not in _SAFE_IMPORTS:
                raise SecurityError(
                    f"Disallowed import from: '{node.module}'. "
                    f"Only {sorted(_SAFE_IMPORTS)} are permitted."
                )
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            if node.func.id in _DISALLOWED_BUILTINS:
                raise SecurityError(f"Disallowed builtin call: '{node.func.id}'")
        if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
            if node.id in _DISALLOWED_IMPORTS | _DISALLOWED_BUILTINS:
                raise SecurityError(f"Disallowed name reference: '{node.id}'")
        if isinstance(node, ast.Attribute) and node.attr.startswith("_"):
            raise SecurityError(
                f"Disallowed private attribute access: '.{node.attr}'. "
                "Private attributes are blocked to prevent sandbox escape."
            )
        if isinstance(node, ast.Attribute) and node.attr in _BLOCKED_ATTRIBUTES:
            raise SecurityError(
                f"Disallowed attribute access: '.{node.attr}'. "
                "This attribute can be used for sandbox escape."
            )


class VirtualizedREPL:
    """
    RLM-compliant REPL environment (arXiv:2512.24601 §3).

    Exposes virtualized helper functions to sandbox code so the LLM can
    operate on variable HANDLES (dict keys) rather than raw text bodies.
    The actual text is resolved inside this class, never passed to the LLM.
    """

    def __init__(self, context_variables: Dict[str, str]) -> None:
        self._vars = context_variables

    def get_variable(self, key: str) -> str:
        """Return full text of a stored context variable by key."""
        if key not in self._vars:
            raise KeyError(f"Variable '{key}' not found. Available: {list(self._vars)}")
        return self._vars[key]

    def slice_variable(self, key: str, start: int = 0, end: Optional[int] = None) -> str:
        """Return a line-indexed slice of a stored variable."""
        text = self.get_variable(key)
        lines = text.splitlines()
        return "\n".join(lines[start:end])

    def search_variable(self, key: str, pattern: str, max_results: int = 20) -> List[str]:
        """Return lines from a variable matching a regex/substring pattern (case-insensitive)."""
        import re  # safe inside the method (not in sandbox code)
        text = self.get_variable(key)
        results = []
        for line in text.splitlines():
            if re.search(pattern, line, re.IGNORECASE):
                results.append(line)
                if len(results) >= max_results:
                    break
        return results

    def token_count(self, key: str) -> int:
        """Estimate token count of a stored variable (chars / 4)."""
        return max(1, len(self.get_variable(key)) // 4)

    def list_variables(self) -> List[str]:
        """List all available variable keys."""
        return list(self._vars.keys())

    def build_sandbox_globals(self) -> Dict[str, Any]:
        """
        Build the globals dict injected into the sandbox execution context.
        Only exposes bound VirtualizedREPL methods — no raw text, no builtins.
        """
        return {
            "get_variable": self.get_variable,
            "slice_variable": self.slice_variable,
            "search_variable": self.search_variable,
            "token_count": self.token_count,
            "list_variables": self.list_variables,
            # Safe standard library (pre-imported for convenience)
            "__builtins__": {
                "print": print,
                "len": len,
                "range": range,
                "enumerate": enumerate,
                "zip": zip,
                "map": map,
                "filter": filter,
                "sorted": sorted,
                "reversed": reversed,
                "list": list,
                "dict": dict,
                "set": set,
                "tuple": tuple,
                "str": str,
                "int": int,
                "float": float,
                "bool": bool,
                "isinstance": isinstance,
                "hasattr": hasattr,
                "max": max,
                "min": min,
                "sum": sum,
                "abs": abs,
                "round": round,
                "repr": repr,
                "type": type,
                "any": any,
                "all": all,
                "None": None,
                "True": True,
                "False": False,
            },
        }


def _interrupt_thread(thread_id: int) -> None:
    ctypes.pythonapi.PyThreadState_SetAsyncExc(
        ctypes.c_ulong(thread_id),
        ctypes.py_object(TimeoutError),
    )


def execute_sandbox_code(
    code: str,
    state: JobTayariHarnessState,
    timeout_hint_ms: float = 5000.0,
) -> ExecutionResultDict:
    """
    Execute LLM-generated Python code in the sandboxed VirtualizedREPL.

    Implementation (RLM arXiv:2512.24601 §3 REPL interface):
    1. AST security pre-check — rejects dangerous constructs.
    2. sys.stdout/sys.stderr are intercepted via io.StringIO redirect.
    3. Code runs against a VirtualizedREPL globals dict — only variable
       handle functions are exposed, never raw text or secrets.
    4. Returns an ExecutionResultDict with full stdout/stderr for
       Meta-Harness logging (arXiv:2603.28052).

    For complex/untrusted code beyond this in-process sandbox, the caller
    should invoke CodeActREPL.execute() (subprocess-level isolation) instead.
    """
    code_hash = hashlib.sha256(code.encode("utf-8")).hexdigest()
    t_start = time.monotonic()

    # Level 1: AST security pre-check
    try:
        _ast_security_check(code)
    except SecurityError as exc:
        elapsed = (time.monotonic() - t_start) * 1000
        return ExecutionResultDict(
            success=False,
            stdout="",
            stderr=str(exc),
            return_value=None,
            error=str(exc),
            duration_ms=elapsed,
            code_hash=code_hash,
        )

    # Level 2: In-process execution with stdout/stderr capture
    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()
    repl = VirtualizedREPL(state["context_variables"])
    sandbox_globals = repl.build_sandbox_globals()
    sandbox_locals: Dict[str, Any] = {}
    return_value: Optional[str] = None

    timeout_seconds = timeout_hint_ms / 1000.0
    current_thread = threading.current_thread()
    timer = threading.Timer(timeout_seconds, _interrupt_thread, args=[current_thread.ident])
    timer.start()

    try:
        with redirect_stdout(stdout_buf), redirect_stderr(stderr_buf):
            # Try eval first (for single-expression code — returns a value)
            try:
                compiled_eval = compile(code, "<harness_repl>", "eval")
                raw_result = eval(compiled_eval, sandbox_globals, sandbox_locals)  # noqa: S307
                if raw_result is not None:
                    return_value = repr(raw_result)
            except SyntaxError:
                # Not an expression — exec as statement block
                compiled_exec = compile(code, "<harness_repl>", "exec")
                exec(compiled_exec, sandbox_globals, sandbox_locals)  # noqa: S102
                # Capture last assigned variable named 'result' if present
                if "result" in sandbox_locals:
                    return_value = repr(sandbox_locals["result"])

        elapsed = (time.monotonic() - t_start) * 1000
        return ExecutionResultDict(
            success=True,
            stdout=stdout_buf.getvalue(),
            stderr=stderr_buf.getvalue(),
            return_value=return_value,
            error=None,
            duration_ms=elapsed,
            code_hash=code_hash,
        )

    except Exception as exc:  # noqa: BLE001
        elapsed = (time.monotonic() - t_start) * 1000
        stderr_content = stderr_buf.getvalue()
        error_msg = f"{type(exc).__name__}: {exc}"
        if stderr_content:
            error_msg = f"{error_msg}\n{stderr_content}"
        return ExecutionResultDict(
            success=False,
            stdout=stdout_buf.getvalue(),
            stderr=error_msg,
            return_value=None,
            error=error_msg,
            duration_ms=elapsed,
            code_hash=code_hash,
        )
    finally:
        timer.cancel()
