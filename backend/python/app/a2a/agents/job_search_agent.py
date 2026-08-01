"""
Job Search Agent — Primary orchestrator agent for multi-agent workflows.
"""
from typing import Dict, Any
from app.a2a.models import AgentCard, AgentCapability, A2AMessage
from app.a2a.registry import AgentRegistry
from app.a2a.dispatcher import A2ADispatcher
from app.services.job_agent import smart_search


JOB_SEARCH_AGENT_CARD = AgentCard(
    name="JobSearchAgent",
    description="Primary orchestrator agent managing candidate matching, job search, and review queue.",
    version="1.0.0",
    url="http://localhost:8000/a2a/agents/job-search",
    capabilities=[
        AgentCapability(
            name="orchestrate_pipeline",
            description="Run full end-to-end candidate matching pipeline.",
            input_schema={"query": "str", "location": "str"},
            output_schema={"jobs": "list", "status": "str"},
        )
    ],
)


async def handle_job_search_message(message: A2AMessage) -> Dict[str, Any]:
    params = message.params
    query = params.get("query", "Software Engineer")
    location = params.get("location", "Remote")

    res = await smart_search(query=query, location=location, profile=None, resume_text=None)
    jobs = res.get("jobs", [])

    return {
        "agent": "JobSearchAgent",
        "action": message.method,
        "payload": {"jobs": jobs[:10], "total": len(jobs)},
    }


def register_job_search_agent() -> None:
    registry = AgentRegistry.get_instance()
    dispatcher = A2ADispatcher.get_instance()
    registry.register(JOB_SEARCH_AGENT_CARD)
    dispatcher.register_handler("JobSearchAgent", handle_job_search_message)
