"""Browser Automation Agent Service Package.

Exposes run_browser_agent and AgentResult for internal Python backend services and FastAPI endpoints.
"""

from app.services.browser_automation.agent import (
    AgentResult,
    run_browser_agent,
    get_llm,
)

__all__ = ["AgentResult", "run_browser_agent", "get_llm"]
