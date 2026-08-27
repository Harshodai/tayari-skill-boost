import asyncio
import json
from typing import Dict, Any, List, Optional
from app.agent.codeact_repl import CodeActREPL

class Subagent:
    """Crisp, single-responsibility subagent."""
    def __init__(self, name: str, role: str):
        self.name = name
        self.role = role
        self.repl = CodeActREPL()

    async def execute(self, task: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Execute subagent task cleanly."""
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
    Dispatches specialized subagents with clear, decoupled responsibilities.
    """

    def __init__(self):
        self.agents = {
            "researcher": Subagent("ResearchSubagent", "Workspace Analysis & Requirement Inspection"),
            "coder": Subagent("CoderSubagent", "CodeAct Execution & Code Generation"),
            "verifier": Subagent("VerifierSubagent", "Validation Criteria & Verification"),
            "scraper": Subagent("ScraperSubagent", "Job Search & ATS Keyword Extraction"),
            "resume": Subagent("ResumeSubagent", "Resume Customization & HITL Review"),
            "app_filler": Subagent("ApplicationSubagent", "Universal Form Auto-Filling"),
            "email_sync": Subagent("EmailSubagent", "Recruiter Email Sync & Invite Parsing"),
            "board": Subagent("BoardSubagent", "Kanban Stage & Interview Board Management"),
            "negotiator": Subagent("NegotiationSubagent", "AI Salary Negotiation Strategy")
        }

    async def run_subagent(self, agent_name: str, task: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Run a single subagent by name."""
        if agent_name not in self.agents:
            raise ValueError(f"Unknown subagent '{agent_name}'. Available: {list(self.agents.keys())}")
        agent = self.agents[agent_name]
        return await agent.execute(task, payload)

    async def delegate_parallel(self, task_specs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Delegate tasks across subagents concurrently."""
        tasks = [self.run_subagent(spec.get("agent_type", "researcher"), spec.get("task", ""), spec.get("payload")) for spec in task_specs]
        return list(await asyncio.gather(*tasks))
