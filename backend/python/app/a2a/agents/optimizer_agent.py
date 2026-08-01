"""
Optimizer Agent — A2A agent wrapper for reflective resume tailoring.
"""
from typing import Dict, Any
from app.a2a.models import AgentCard, AgentCapability, A2AMessage
from app.a2a.registry import AgentRegistry
from app.a2a.dispatcher import A2ADispatcher
from app.services.optimizer import optimize_with_reflection


OPTIMIZER_AGENT_CARD = AgentCard(
    name="OptimizerAgent",
    description="Reflectively tailors resumes to job descriptions using Pydantic structured schemas.",
    version="1.0.0",
    url="http://localhost:8000/a2a/agents/optimizer",
    capabilities=[
        AgentCapability(
            name="optimize_resume",
            description="Tailors resume text against target job description.",
            input_schema={"resume_text": "str", "job_description": "str"},
            output_schema={"optimized_text": "str", "changes": "list", "estimated_score": "int"},
        )
    ],
)


async def handle_optimizer_message(message: A2AMessage) -> Dict[str, Any]:
    params = message.params
    resume_text = params.get("resume_text", "")
    job_description = params.get("job_description", "")
    res = await optimize_with_reflection(resume_text, job_description)
    return {
        "agent": "OptimizerAgent",
        "action": message.method,
        "payload": res,
    }


def register_optimizer_agent() -> None:
    registry = AgentRegistry.get_instance()
    dispatcher = A2ADispatcher.get_instance()
    registry.register(OPTIMIZER_AGENT_CARD)
    dispatcher.register_handler("OptimizerAgent", handle_optimizer_message)
