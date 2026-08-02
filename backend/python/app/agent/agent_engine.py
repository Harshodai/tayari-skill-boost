import os
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
from app.agent.computer_use import ComputerUseDriver

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
        if hostname.lower() in ("localhost", "0.0.0.0", "broadcasthost"):
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
        target_url = parsed._replace(netloc=f"{pinned_ip}:{port}").geturl()
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

    def __init__(self, workspace_path: str = "./"):
        self.workspace_path = os.path.abspath(workspace_path)
        self.repl = CodeActREPL()
        self.mcp = MCPManager()
        self.browser = BrowserOperator()
        self.memory = AgentMemory()
        self.reflection = ReflectionEngine()
        self.orchestrator = SubagentOrchestrator()
        self.computer_use = ComputerUseDriver()

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
        resolved = os.path.abspath(target_path)
        return resolved == self.workspace_path or resolved.startswith(self.workspace_path + os.sep)

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
            full_path = os.path.abspath(os.path.join(self.workspace_path, file_path))
            if not self._is_within_workspace(full_path):
                return f"Error: Path '{file_path}' resolves outside workspace boundary."
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(content)
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
            return await self.browser.navigate(info["target_url"], headers=info["headers"])

        self.mcp.register_tool(
            name="navigate_web",
            description="Browse a web URL using Playwright browser operator",
            input_schema={"type": "object", "properties": {"url": {"type": "string"}}, "required": ["url"]},
            handler=navigate_web
        )

    async def execute_task(self, goal: str, max_steps: int = 10) -> Dict[str, Any]:
        """
        Execute high-level goal using Subagent Swarm, CodeAct REPL, Self-Reflection Engine, and Memory.
        """
        self.session_history.append({"role": "user", "content": goal})
        self.memory.store_knowledge("current_goal", goal)

        steps_log = []
        plan = [
            f"Phase 1: Goal Analysis & Environment Inspection ({goal})",
            "Phase 2: Subagent Swarm Delegation (Research + Coder Agents)",
            "Phase 3: CodeAct Python REPL Execution & Self-Reflection Debugging",
            "Phase 4: Output Synthesis & Verification"
        ]

        # Step 1: Subagent Swarm Delegation
        subagent_tasks = [
            {"agent_type": "researcher", "task": f"Analyze workspace requirements for '{goal}'"},
            {"agent_type": "coder", "task": f"Prepare CodeAct execution script for '{goal}'"},
            {"agent_type": "verifier", "task": "Establish validation criteria"}
        ]
        swarm_results = await self.orchestrator.delegate_parallel(subagent_tasks)
        
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
        code_to_run = f"# Generalist Agent CodeAct Action\nimport os\nfiles = os.listdir({repr(self.workspace_path)})[:5]\nprint('Workspace files:', files)"
        repl_result = await self.repl.execute(code_to_run)

        # Apply Reflection Engine if failure occurs
        if not repl_result["success"]:
            reflection_res = self.reflection.analyze_failure(code_to_run, repl_result["error"])
            self.memory.record_reflection(2, repl_result["error"], reflection_res["hypothesis"], reflection_res["patched_code"])
            # Retry with patched code
            repl_result = await self.repl.execute(reflection_res["patched_code"])
            repl_result["reflected"] = True
            repl_result["diagnosis"] = reflection_res["diagnosis"]

        step_2 = {
            "step": 2,
            "action": "CodeAct Python REPL Execution",
            "thought": "Executing primary code action in Python REPL with reflection handling.",
            "code": code_to_run,
            "result": repl_result,
            "plan": plan
        }
        steps_log.append(step_2)
        self.memory.record_episode(2, "CodeAct REPL Execution", code_to_run, repl_result, repl_result["success"])

        # Step 3: MCP Tool Call & Spatial Vision Check
        mcp_res = await self.mcp.call_tool("list_dir", {"dir_path": "."})
        coord_sample = self.computer_use.calculate_center_coordinates((100, 100, 500, 400))
        
        step_3 = {
            "step": 3,
            "action": "MCP Tool & Spatial Vision Inspection",
            "thought": "Querying Model Context Protocol tools and calculating spatial vision coordinates.",
            "mcp_output": mcp_res,
            "spatial_click_coord": coord_sample,
            "plan": plan
        }
        steps_log.append(step_3)
        self.memory.record_episode(3, "MCP & Computer Use", None, mcp_res, True)

        # Final Summary
        return {
            "status": "completed",
            "goal": goal,
            "total_steps": len(steps_log),
            "plan": plan,
            "steps": steps_log,
            "memory_summary": self.memory.get_summary(),
            "swarm_execution": swarm_results
        }
