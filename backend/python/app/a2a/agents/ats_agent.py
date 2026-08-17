"""
ATS Agent — A2A agent wrapper for ATS analysis and scoring.
"""
from typing import Dict, Any
from app.a2a.models import AgentCard, AgentCapability, A2AMessage
from app.a2a.registry import AgentRegistry
from app.a2a.dispatcher import A2ADispatcher
from app.services.ats_engine import heuristic_ats_score


ATS_AGENT_CARD = AgentCard(
    name="AtsScorerAgent",
    description="Analyzes resumes against job descriptions for ATS keyword matching and formatting risks.",
    version="1.0.0",
    url="http://localhost:8000/a2a/agents/ats-scorer",
    required_capability="workspace.ats_assistance",
    capabilities=[
        AgentCapability(
            name="analyze_ats",
            description="Score resume against job description and surface missing keywords.",
            input_schema={"resume_text": "str", "job_description": "str"},
            output_schema={"score": "int", "matched_keywords": "list", "missing_keywords": "list"},
        )
    ],
)


async def handle_ats_message(message: A2AMessage) -> Dict[str, Any]:
    params = message.params
    resume_text = params.get("resume_text", "")
    job_description = params.get("job_description", "")
    score_result = heuristic_ats_score(resume_text, job_description)
    return {
        "agent": "AtsScorerAgent",
        "action": message.method,
        "score_data": score_result,
    }


def register_ats_agent() -> None:
    registry = AgentRegistry.get_instance()
    dispatcher = A2ADispatcher.get_instance()
    registry.register(ATS_AGENT_CARD)
    dispatcher.register_handler("AtsScorerAgent", handle_ats_message)
