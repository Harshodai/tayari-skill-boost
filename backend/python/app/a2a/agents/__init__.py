"""
A2A Agent Package — initializes and registers all specialized Tayari agents.
"""
from app.a2a.agents.ats_agent import register_ats_agent
from app.a2a.agents.optimizer_agent import register_optimizer_agent
from app.a2a.agents.truth_gate_agent import register_truth_gate_agent
from app.a2a.agents.interview_coach_agent import register_interview_coach_agent
from app.a2a.agents.job_search_agent import register_job_search_agent


def register_all_a2a_agents() -> None:
    """Register all A2A agents into the central registry and dispatcher."""
    register_ats_agent()
    register_optimizer_agent()
    register_truth_gate_agent()
    register_interview_coach_agent()
    register_job_search_agent()
