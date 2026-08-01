"""
Interview Coach Agent — A2A agent wrapper for interview prep and STAR coaching.
"""
from typing import Dict, Any
from app.a2a.models import AgentCard, AgentCapability, A2AMessage
from app.a2a.registry import AgentRegistry
from app.a2a.dispatcher import A2ADispatcher
from app.services.interview_ai import InterviewPrepGenerator


INTERVIEW_COACH_AGENT_CARD = AgentCard(
    name="InterviewCoachAgent",
    description="Generates behavioral, technical, and system design interview preparation intel.",
    version="1.0.0",
    url="http://localhost:8000/a2a/agents/interview-coach",
    capabilities=[
        AgentCapability(
            name="generate_prep",
            description="Generate STAR and technical interview questions.",
            input_schema={"resume_text": "str", "job_title": "str", "company_name": "str"},
            output_schema={"questions": "list", "interview_type": "str"},
        )
    ],
)


async def handle_interview_coach_message(message: A2AMessage) -> Dict[str, Any]:
    params = message.params
    resume_text = params.get("resume_text", "")
    job_title = params.get("job_title", "Software Engineer")
    company_name = params.get("company_name", None)
    interview_type = params.get("interview_type", "behavioral")

    res = await InterviewPrepGenerator.generate(
        resume_text=resume_text,
        job_title=job_title,
        company_name=company_name,
        interview_type=interview_type,
    )
    return {
        "agent": "InterviewCoachAgent",
        "action": message.method,
        "payload": res,
    }


def register_interview_coach_agent() -> None:
    registry = AgentRegistry.get_instance()
    dispatcher = A2ADispatcher.get_instance()
    registry.register(INTERVIEW_COACH_AGENT_CARD)
    dispatcher.register_handler("InterviewCoachAgent", handle_interview_coach_message)
