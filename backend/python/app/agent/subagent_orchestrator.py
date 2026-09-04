import asyncio
import json
from typing import Dict, Any, List, Optional
from app.agent.codeact_repl import CodeActREPL
from app.agent.skill_router import get_skill_router, SkillRouter, SkillTaskType


class Subagent:
    """Crisp, single-responsibility subagent with skill router integration."""
    def __init__(self, name: str, role: str):
        self.name = name
        self.role = role
        self.repl = CodeActREPL()
        self.skill_router = get_skill_router()

    async def execute(
        self,
        task: str,
        payload: Optional[Dict[str, Any]] = None,
        latency_target: str = "balanced",
    ) -> Dict[str, Any]:
        """Execute subagent task cleanly.

        If payload contains 'task_type' or task matches SkillTaskType, routes via SkillRouter.
        Otherwise executes in CodeActREPL.
        """
        payload = payload or {}
        task_type = payload.get("task_type")
        if not task_type:
            clean_task = task.strip().lower().replace("-", "_")
            if clean_task in [t.value for t in SkillTaskType]:
                task_type = clean_task

        if task_type:
            try:
                routed_res = await self.skill_router.route_and_execute(
                    task_type=task_type,
                    payload=payload,
                    latency_target=payload.get("latency_target", latency_target),
                    headers=payload.get("headers"),
                )
                return {
                    "subagent": self.name,
                    "role": self.role,
                    "task": task,
                    "task_type": task_type,
                    "status": "completed",
                    "output": json.dumps(routed_res) if not isinstance(routed_res, str) else routed_res,
                    "routed_result": routed_res,
                    "error": None,
                }
            except Exception as exc:
                return {
                    "subagent": self.name,
                    "role": self.role,
                    "task": task,
                    "task_type": task_type,
                    "status": "failed",
                    "output": "",
                    "error": str(exc),
                }

        safe_task = json.dumps(task)
        res = await self.repl.execute(f"# Subagent execution\ntask_desc = {safe_task}\nprint('Task completed successfully for:', task_desc)")
        succeeded = res.get("success") is True
        return {
            "subagent": self.name,
            "role": self.role,
            "task": task,
            "status": "completed" if succeeded else "failed",
            "output": res.get("stdout", "").strip(),
            "error": res.get("error") if not succeeded else None,
        }


class SubagentOrchestrator:
    """
    Subagent-Driven Development Orchestrator.
    Dispatches specialized subagents with clear, decoupled responsibilities,
    integrated with Multi-Agent Skill Router.
    """

    def __init__(self, skill_router: Optional[SkillRouter] = None):
        self.skill_router = skill_router or get_skill_router()
        self.agents = {
            "researcher": Subagent("ResearchSubagent", "Workspace Analysis & Requirement Inspection"),
            "coder": Subagent("CoderSubagent", "CodeAct Execution & Code Generation"),
            "verifier": Subagent("VerifierSubagent", "Validation Criteria & Verification"),
            "scraper": Subagent("ScraperSubagent", "Job Search & ATS Keyword Extraction"),
            "resume": Subagent("ResumeSubagent", "Resume Customization & HITL Review"),
            "app_filler": Subagent("ApplicationSubagent", "Universal Form Auto-Filling"),
            "email_sync": Subagent("EmailSubagent", "Recruiter Email Sync & Invite Parsing"),
            "board": Subagent("BoardSubagent", "Kanban Stage & Interview Board Management"),
            "negotiator": Subagent("NegotiationSubagent", "AI Salary Negotiation Strategy"),
        }

    async def route_task(
        self,
        task_type: str,
        payload: Optional[Dict[str, Any]] = None,
        latency_target: str = "balanced",
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Directly route a task through the Multi-Agent Skill Router."""
        return await self.skill_router.route_and_execute(
            task_type=task_type,
            payload=payload or {},
            latency_target=latency_target,
            headers=headers,
        )

    async def run_subagent(
        self,
        agent_name: str,
        task: str,
        payload: Optional[Dict[str, Any]] = None,
        latency_target: str = "balanced",
    ) -> Dict[str, Any]:
        """Run a single subagent by name."""
        if agent_name not in self.agents:
            raise ValueError(f"Unknown subagent '{agent_name}'. Available: {list(self.agents.keys())}")
        agent = self.agents[agent_name]
        return await agent.execute(task, payload, latency_target=latency_target)

    async def delegate_parallel(self, task_specs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Delegate tasks across subagents concurrently."""
        tasks = [
            self.run_subagent(
                spec.get("agent_type", "researcher"),
                spec.get("task", ""),
                spec.get("payload"),
                latency_target=spec.get("latency_target", "balanced"),
            )
            for spec in task_specs
        ]
        return list(await asyncio.gather(*tasks))

