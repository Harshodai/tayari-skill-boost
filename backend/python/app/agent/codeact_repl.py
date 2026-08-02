import io
import sys
import traceback
import asyncio
import contextlib
from typing import Dict, Any, Optional

_repl_locks: Dict[Any, asyncio.Lock] = {}

def _get_repl_lock() -> asyncio.Lock:
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None
    if loop not in _repl_locks:
        _repl_locks[loop] = asyncio.Lock()
    return _repl_locks[loop]

class CodeActREPL:
    """
    Executable Code Actions (CodeAct) Python REPL.
    Implements Manus AI's core code execution paradigm inside a stateful REPL environment.
    """

    def __init__(self, globals_dict: Optional[Dict[str, Any]] = None):
        self.globals: Dict[str, Any] = globals_dict or {}
        # Pre-seed REPL with common useful tools / libraries
        self.globals.update({
            "asyncio": asyncio,
            "json": __import__("json"),
            "os": __import__("os"),
            "sys": __import__("sys"),
            "re": __import__("re"),
            "math": __import__("math"),
            "datetime": __import__("datetime"),
        })
        self.history = []

    async def execute(self, code: str, timeout: float = 30.0) -> Dict[str, Any]:
        """
        Execute arbitrary Python code snippet in the REPL with stdout/stderr capture and timeout.
        """
        async with _get_repl_lock():
            stdout_buf = io.StringIO()
            stderr_buf = io.StringIO()
            loop = asyncio.get_event_loop()

            def _run_code():
                with contextlib.redirect_stdout(stdout_buf), contextlib.redirect_stderr(stderr_buf):
                    try:
                        compiled_expr = compile(code, "<codeact_repl>", "eval")
                        result = eval(compiled_expr, self.globals)
                        if result is not None:
                            print(repr(result))
                        return {"success": True, "error": None}
                    except SyntaxError:
                        try:
                            compiled_stmt = compile(code, "<codeact_repl>", "exec")
                            exec(compiled_stmt, self.globals)
                            return {"success": True, "error": None}
                        except Exception as e:
                            tb = traceback.format_exc()
                            return {"success": False, "error": f"{type(e).__name__}: {str(e)}\n{tb}"}
                    except Exception as e:
                        tb = traceback.format_exc()
                        return {"success": False, "error": f"{type(e).__name__}: {str(e)}\n{tb}"}

            try:
                res = await asyncio.wait_for(loop.run_in_executor(None, _run_code), timeout=timeout)
                out = stdout_buf.getvalue()
                err = stderr_buf.getvalue()
                
                output = {
                    "success": res["success"],
                    "stdout": out,
                    "stderr": err,
                    "error": res["error"],
                    "code": code
                }
                self.history.append(output)
                return output
            except asyncio.TimeoutError:
                err_msg = f"TimeoutError: Code execution exceeded maximum allotted time of {timeout} seconds."
                output = {
                    "success": False,
                    "stdout": stdout_buf.getvalue(),
                    "stderr": err_msg,
                    "error": err_msg,
                    "code": code
                }
                self.history.append(output)
                return output
