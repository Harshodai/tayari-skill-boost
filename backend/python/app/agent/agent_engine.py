import os
import ast
import urllib.parse
import socket
import ipaddress
from typing import Dict, Any, List, Optional

from app.agent.codeact_repl import CodeActREPL
from app.agent.mcp_manager import MCPManager
from app.agent.browser_operator import BrowserOperator
from app.agent.agent_memory import AgentMemory
from app.agent.reflection_engine import ReflectionEngine
from app.agent.subagent_orchestrator import SubagentOrchestrator

def _resolve_and_validate_url(url: str) -> Optional[Dict[str, Any]]:
    """
    Resolve hostname once, validate that every resolved IP address is globally routable
    (ip_obj.is_global is True), and return URL metadata preserving the original hostname.
    """
    try:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return None
        hostname = parsed.hostname
        if not hostname:
            return None

        # Reject direct non-global hostnames
        if hostname.lower() in ("localhost", "0.0.0.0", "broadcasthost"):  # nosec B104 - outbound SSRF denylist, not a bind
            return None

        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        ip_list = socket.getaddrinfo(hostname, port)
        if not ip_list:
            return None

        for item in ip_list:
            ip_str = item[4][0]
            ip_obj = ipaddress.ip_address(ip_str)
            if not ip_obj.is_global:
                return None

        pinned_ip = ip_list[0][4][0]
        parsed = urllib.parse.urlparse(url)
        pinned_netloc = f"[{pinned_ip}]:{port}" if ":" in pinned_ip else f"{pinned_ip}:{port}"
        target_url = parsed._replace(netloc=pinned_netloc).geturl()
        return {
            "original_url": url,
            "original_hostname": hostname,
            "pinned_ip": pinned_ip,
            "target_url": target_url,
            "headers": {"Host": hostname}
        }
    except Exception:
        return None

def _is_safe_url(url: str) -> bool:
    """Validate that target URL uses HTTP(S) and resolves to a globally routable public IP address."""
    return _resolve_and_validate_url(url) is not None

class GeneralistAgentEngine:
    """
    Enterprise-Grade Generalist Agent Engine.
    Unifies:
    1. Claude Cowork: MCP Host Manager, Computer Use Vision Driver, Session Logs, HITL.
    2. Manus AI: CodeAct Python REPL, Cloud Browser Operator, Perceive-Plan-Perform Loop.
    3. Advanced AI Swarm: Subagent Delegation, Reflection Engine, Episodic/Semantic Memory.
    """

    def __init__(self, workspace_path: str = "./", user_id: Optional[str] = None):
        self.workspace_path = os.path.abspath(workspace_path)
        self.user_id = user_id
        self.repl = CodeActREPL()
        self.mcp = MCPManager()
        self.browser = BrowserOperator()
        self.memory = AgentMemory(user_id=user_id)
        self.reflection = ReflectionEngine()
        self.orchestrator = SubagentOrchestrator()

        self.session_history: List[Dict[str, Any]] = []
        self._register_default_mcp_tools()

    async def close(self):
        """Release browser operator and engine resources."""
        if hasattr(self, "browser") and self.browser:
            await self.browser.close()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    def _is_within_workspace(self, target_path: str) -> bool:
        root = os.path.realpath(self.workspace_path)
        resolved = os.path.realpath(target_path)
        return resolved == root or resolved.startswith(root + os.sep)

    @staticmethod
    def _is_safe_code(code: str) -> bool:
        """Allow-list static guard for code passed to the CodeAct REPL.

        Enforces the CodeActREPL trust contract: only a conservative subset of
        Python is permitted. Obvious escapes (imports of os/sys/subprocess,
        calls to eval/exec/open/__import__, network access) are rejected.
        This is a coarse static guard that complements the subprocess sandbox; it
        is intentionally conservative and may reject benign advanced constructs.
        """
        if not isinstance(code, str) or not code.strip():
            return False

        disallowed_imports = frozenset({
            "os", "sys", "subprocess", "socket", "importlib", "ctypes",
            "builtins", "__builtin__", "_thread", "threading", "multiprocessing",
            "urllib", "http", "requests", "pickle", "marshal", "compileall",
            "code", "codeop", "shlex", "pty", "platform", "site", "pkgutil",
        })
        disallowed_builtins = frozenset({
            "eval", "exec", "compile", "open", "input", "__import__",
            "exit", "quit", "getattr", "setattr", "delattr",
        })
        disallowed_names = disallowed_imports | disallowed_builtins

        # AST check: reject any node type that is not obviously safe.
        # ponytail: ast.Index is a deprecated compatibility alias that only
        # existed to wrap subscript slices before Python 3.9 flattened them into
        # ast.Slice/ast.Tuple directly; on Python 3.11+ (the supported runtime)
        # it never appears in a parsed tree, so it is excluded from safe_nodes.
        safe_nodes = frozenset({
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
            ast.Eq, ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE, ast.Is, ast.IsNot,
            ast.In, ast.NotIn, ast.And, ast.Or, ast.NamedExpr,
        })
        try:
            tree = ast.parse(code, mode="exec")
        except SyntaxError:
            return False

        for node in ast.walk(tree):
            if type(node) not in safe_nodes:
                return False
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                if node.func.id in disallowed_builtins:
                    return False
            # Reject any load of a disallowed NAME. String literals are
            # ast.Constant nodes, so a filename like 'open.py' or 'os' embedded
            # in a code snippet is never matched here — only genuine name
            # references are. This replaces the old raw code.split() token scan,
            # which false-rejected string contents.
            if isinstance(node, ast.Name) and node.id in disallowed_names:
                if isinstance(node.ctx, ast.Load):
                    return False
            # ponytail: private/dunder attribute access is the classic way to
            # reach internal machinery (e.g. os._wrap_close, func.__globals__,
            # object.__class__.__subclasses__). Reject any attribute whose name
            # begins with an underscore so a guard bypass can never hide there.
            if isinstance(node, ast.Attribute) and node.attr.startswith("_"):
                return False
        return True

    def _register_default_mcp_tools(self):
        """Register core system tools via MCP standards."""
        def read_file_tool(file_path: str) -> str:
            full_path = os.path.abspath(os.path.join(self.workspace_path, file_path))
            if not self._is_within_workspace(full_path):
                return f"Error: Path '{file_path}' resolves outside workspace boundary."
            if not os.path.exists(full_path):
                return f"Error: File '{file_path}' does not exist."
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()

        def write_file_tool(file_path: str, content: str) -> str:
            # Descriptor-based traversal: open the trusted workspace directory,
            # then walk each path component with dir_fd + O_NOFOLLOW so a symlink
            # planted anywhere in the chain (or swapped in concurrently) cannot
            # redirect the write outside the workspace. No realpath/makedirs.
            try:
                full_path = os.path.abspath(os.path.join(self.workspace_path, file_path))
                rel = os.path.relpath(full_path, self.workspace_path)
                if rel.startswith("..") or os.path.isabs(rel):
                    return f"Error: Path '{file_path}' resolves outside workspace boundary."
                parts = [p for p in rel.split(os.sep) if p not in ("", ".")]
                if not parts:
                    return f"Error: Path '{file_path}' is not a file."

                dir_fd = os.open(self.workspace_path, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
                opened = [dir_fd]
                try:
                    for part in parts[:-1]:
                        try:
                            dir_fd = os.open(part, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | os.O_NOFOLLOW, dir_fd=dir_fd)
                        except FileNotFoundError:
                            # create the missing intermediate directory relative to
                            # the verified parent descriptor, then descend into it
                            os.mkdir(part, 0o755, dir_fd=dir_fd)
                            dir_fd = os.open(part, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | os.O_NOFOLLOW, dir_fd=dir_fd)
                        opened.append(dir_fd)
                    fd = os.open(parts[-1], os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o644, dir_fd=dir_fd)
                    opened.append(fd)
                    try:
                        f = os.fdopen(fd, "w", encoding="utf-8")
                    except Exception:
                        # ponytail: ownership never transferred — close fd here so
                        # the finally cleanup does not double-close a reused fd.
                        os.close(fd)
                        opened.remove(fd)
                        raise
                    # ponytail: fdopen now owns the descriptor; drop it from opened
                    # so the finally cleanup does not close it a second time.
                    opened.remove(fd)
                    with f:
                        f.write(content)
                finally:
                    for fdx in opened:
                        try:
                            os.close(fdx)
                        except OSError:
                            pass
            except Exception as exc:
                return f"Error: Failed to write file '{file_path}': {exc}"
            return f"Successfully written {len(content)} characters to '{file_path}'."

        def list_dir_tool(dir_path: str = ".") -> List[str]:
            full_path = os.path.abspath(os.path.join(self.workspace_path, dir_path))
            if not self._is_within_workspace(full_path):
                return [f"Error: Path '{dir_path}' resolves outside workspace boundary."]
            if not os.path.exists(full_path):
                return [f"Error: Directory '{dir_path}' not found."]
            return os.listdir(full_path)

        self.mcp.register_tool(
            name="read_file",
            description="Read text contents of a file in workspace",
            input_schema={"type": "object", "properties": {"file_path": {"type": "string"}}, "required": ["file_path"]},
            handler=read_file_tool
        )
        self.mcp.register_tool(
            name="write_file",
            description="Write text contents to a file in workspace",
            input_schema={"type": "object", "properties": {"file_path": {"type": "string"}, "content": {"type": "string"}}, "required": ["file_path", "content"]},
            handler=write_file_tool
        )
        self.mcp.register_tool(
            name="list_dir",
            description="List files in a directory",
            input_schema={"type": "object", "properties": {"dir_path": {"type": "string"}}, "required": []},
            handler=list_dir_tool
        )

        async def navigate_web(url: str):
            info = _resolve_and_validate_url(url)
            if not info:
                return {"success": False, "error": f"Rejected URL '{url}': unsafe scheme or non-public address."}
            # Navigate to the pinned-IP target URL (never the original hostname,
            # which a DNS-rebinding attacker could re-point at a private address)
            # while carrying the original hostname in the Host header so SNI and
            # virtual-host routing still work over TLS.
            return await self.browser.navigate(info["target_url"], headers=info["headers"], validate_redirects=True)

        self.mcp.register_tool(
            name="navigate_web",
            description="Browse a web URL using Playwright browser operator",
            input_schema={"type": "object", "properties": {"url": {"type": "string"}}, "required": ["url"]},
            handler=navigate_web
        )

    async def execute_task(self, goal: str, max_steps: int = 10, browser_urls: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Execute high-level goal using Subagent Swarm, CodeAct REPL, Self-Reflection Engine, and Memory.

        # ponytail: add safe-execution boundary and error handling so a single
        # bad step or reflection failure cannot crash the whole task.
        """
        if not isinstance(max_steps, int) or max_steps < 1:
            raise ValueError("max_steps must be a positive integer")
        memory_load = await self.memory.load()
        self.session_history.append({"role": "user", "content": goal})
        self.memory.store_knowledge("current_goal", goal)

        steps_log = []
        browser_results: List[Dict[str, Any]] = []
        requested_browser_urls = [str(url).strip() for url in (browser_urls or []) if str(url).strip()][:3]
        if requested_browser_urls:
            for url in requested_browser_urls:
                info = _resolve_and_validate_url(url)
                if not info:
                    browser_results.append({"success": False, "url": url, "error": "Rejected URL: unsafe scheme or non-public address."})
                    continue
                try:
                    result = await self.browser.navigate(info["target_url"], headers=info["headers"], validate_redirects=True)
                    result["requested_url"] = url
                    browser_results.append(result)
                except Exception as exc:  # noqa: BLE001 - preserve per-URL failure
                    browser_results.append({"success": False, "url": url, "error": f"Browser execution failed: {type(exc).__name__}"})
            browser_step = {
                "step": 0,
                "action": "Live Browser Research",
                "thought": "Browsing only the user-supplied HTTPS URLs; page content remains untrusted evidence.",
                "browser_output": browser_results,
            }
            steps_log.append(browser_step)
            self.memory.record_episode(0, "Live Browser Research", None, browser_results, all(item.get("success") is True for item in browser_results))
        plan = [
            f"Phase 1: Goal Analysis & Environment Inspection ({goal})",
            "Phase 2: Subagent Swarm Delegation (Research + Coder Agents)",
            "Phase 3: CodeAct Python REPL Execution & Self-Reflection Debugging",
            "Phase 4: Output Synthesis & Verification"
        ]

        # Step 1: Subagent Swarm Delegation
        try:
            subagent_tasks = [
                {"agent_type": "researcher", "task": f"Analyze workspace requirements for '{goal}'"},
                {"agent_type": "coder", "task": f"Prepare CodeAct execution script for '{goal}'"},
                {"agent_type": "verifier", "task": "Establish validation criteria"}
            ]
            swarm_results = await self.orchestrator.delegate_parallel(subagent_tasks)
        except Exception as exc:
            # ponytail: catch delegation failure so the engine returns a structured
            # result instead of bubbling an unhandled exception to callers.
            return {
                "status": "failed",
                "goal": goal,
                "total_steps": len(steps_log),
                "plan": plan,
                "steps": steps_log,
                "error": f"Subagent delegation failed: {exc}",
                "memory_summary": self.memory.get_summary(),
                "memory_persistence": await self.memory.flush(),
            }

        step_1 = {
            "step": 1,
            "action": "Subagent Swarm Delegation",
            "thought": "Delegating sub-tasks across specialized child agents in parallel.",
            "swarm_output": swarm_results,
            "plan": plan
        }
        steps_log.append(step_1)
        self.memory.record_episode(1, "Subagent Swarm Delegation", None, swarm_results, True)

        # Step 2: CodeAct REPL Execution with Reflection Fallback
        try:
            files_list = os.listdir(self.workspace_path)[:5]
        except OSError as exc:
            repl_result = {
                "success": False,
                "error": f"Workspace inspection failed: {exc}",
            }
            code_to_run = ""
        else:
            code_to_run = f"files = {files_list!r}\nprint('Workspace files:', files)"

        # ponytail: enforce the CodeActREPL trust contract. The hard-coded
        # introspection code above is known-safe; any future dynamic code path
        # must pass _is_safe_code before self.repl.execute.
        if not code_to_run:
            repl_result = {
                "success": False,
                "error": "Workspace inspection failed; CodeAct execution skipped.",
            }
        elif not self._is_safe_code(code_to_run):
            repl_result = {"success": False, "error": "Execution rejected: initial code violates the safe-execution policy."}
        else:
            try:
                repl_result = await self.repl.execute(code_to_run)

                # Apply Reflection Engine if failure occurs
                if not repl_result["success"]:
                    reflection_res = self.reflection.analyze_failure(code_to_run, repl_result["error"])
                    self.memory.record_reflection(2, repl_result["error"], reflection_res["hypothesis"], reflection_res["patched_code"])
                    patched_code = reflection_res["patched_code"]
                    # ponytail: reflected code must also pass the safe-code
                    # boundary before the retry reaches the REPL.
                    if not self._is_safe_code(patched_code):
                        repl_result = {
                            "success": False,
                            "error": "Execution rejected: reflected code violates the safe-execution policy.",
                            "reflected": True,
                            "diagnosis": "Reflected patch failed the safe-execution policy.",
                        }
                    else:
                        # Retry with patched code
                        repl_result = await self.repl.execute(patched_code)
                        repl_result["reflected"] = True
                        repl_result["diagnosis"] = reflection_res["diagnosis"]
            except Exception as exc:
                # ponytail: record the REPL/reflection failure and continue with a
                # well-formed result so callers always receive a predictable shape.
                repl_result = {
                    "success": False,
                    "error": f"CodeAct execution failed: {exc}",
                }

        step_2 = {
            "step": 2,
            "action": "CodeAct Python REPL Execution",
            "thought": "Executing primary code action in Python REPL with reflection handling.",
            "code": code_to_run,
            "result": repl_result,
            "plan": plan
        }
        steps_log.append(step_2)
        self.memory.record_episode(2, "CodeAct REPL Execution", code_to_run, repl_result, repl_result.get("success", False))

        # Step 3: MCP Tool Call
        step_3_succeeded = True
        try:
            mcp_res = await self.mcp.call_tool("list_dir", {"dir_path": "."})
        except Exception as exc:
            # ponytail: tolerate failures from optional MCP tooling so a
            # sandbox-restricted environment does not abort the whole task.
            mcp_res = {"error": f"MCP step failed: {exc}"}
            step_3_succeeded = False

        step_3 = {
            "step": 3,
            "action": "MCP Tool Inspection",
            "thought": "Querying Model Context Protocol tools.",
            "mcp_output": mcp_res,
            "plan": plan
        }
        steps_log.append(step_3)
        self.memory.record_episode(3, "MCP & Computer Use", None, mcp_res, step_3_succeeded)

        # Final Summary. Never claim complete when a required browser, REPL, MCP, or memory step failed.
        memory_flush = await self.memory.flush()
        steps_log = steps_log[:max_steps]
        browser_ok = all(item.get("success") is True for item in browser_results)
        swarm_ok = all(item.get("status") == "completed" for item in swarm_results)
        memory_ok = not self.user_id or memory_flush.get("status") == "persisted"
        execution_status = "completed" if swarm_ok and repl_result.get("success") is True and step_3_succeeded and browser_ok and memory_ok else "partial"
        return {
            "status": execution_status,
            "goal": goal,
            "total_steps": len(steps_log),
            "plan": plan,
            "steps": steps_log,
            "memory_summary": self.memory.get_summary(),
            "swarm_execution": swarm_results,
            "browser_results": browser_results,
            "memory_persistence": {"load": memory_load, "flush": memory_flush},
            "verification": {
                "swarm_success": swarm_ok,
                "repl_success": repl_result.get("success") is True,
                "mcp_success": step_3_succeeded,
                "browser_success": browser_ok,
                "memory_success": memory_ok,
                "complete": execution_status == "completed",
            },
        }
