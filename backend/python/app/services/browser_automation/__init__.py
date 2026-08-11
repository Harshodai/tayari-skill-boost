"""Browser Automation Agent Service Package.

Exposes run_browser_agent and AgentResult for internal Python backend services and FastAPI endpoints.
"""

from app.services.browser_automation.agent import (
    AgentResult,
    run_browser_agent,
    stream_browser_agent,
    get_llm,
)
from app.services.browser_automation.session import (
    BrowserSession,
    BrowserAuthzError,
    cancel_run,
    get_provider,
    get_session,
    is_cancelled,
)

__all__ = [
    "AgentResult",
    "run_browser_agent",
    "stream_browser_agent",
    "get_llm",
    "BrowserSession",
    "BrowserAuthzError",
    "cancel_run",
    "get_provider",
    "get_session",
    "is_cancelled",
]
