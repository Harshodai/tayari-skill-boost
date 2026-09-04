"""
Generalist Agent Package (Claude Cowork + Manus AI Paradigm)
"""
from app.agent.subagent_orchestrator import Subagent, SubagentOrchestrator
from app.agent.skill_router import (
    SkillRouter,
    SkillTaskType,
    LatencyTarget,
    get_skill_router,
    route_skill,
)

__all__ = [
    "Subagent",
    "SubagentOrchestrator",
    "SkillRouter",
    "SkillTaskType",
    "LatencyTarget",
    "get_skill_router",
    "route_skill",
]

