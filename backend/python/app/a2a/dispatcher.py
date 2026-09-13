"""
Asynchronous A2ADispatcher for inter-agent message routing and task delegation.
Enforces Pydantic model contracts and bounded timeouts on every message hop.
"""
import asyncio
from typing import Dict, Any, Callable, Awaitable, Optional
import logging
import os

from app.a2a.models import A2AMessage, A2AResponse
from app.a2a.registry import AgentRegistry
from app.a2a.authorization import A2APeerPrincipal, peer_allows

logger = logging.getLogger(__name__)


AgentHandler = Callable[[A2AMessage], Awaitable[Dict[str, Any]]]


class A2ADispatcher:
    """Central async message router and task execution broker for A2A communication."""

    DEFAULT_TIMEOUT_SECONDS: float = 30.0
    _instance: Optional["A2ADispatcher"] = None

    def __init__(self, timeout: float = DEFAULT_TIMEOUT_SECONDS):
        self._handlers: Dict[str, AgentHandler] = {}
        self.registry = AgentRegistry.get_instance()
        self.timeout = timeout

    @classmethod
    def get_instance(cls) -> "A2ADispatcher":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def register_handler(self, agent_name: str, handler: AgentHandler) -> None:
        """Register an async execution handler for a specific target agent."""
        self._handlers[agent_name] = handler
        logger.info("A2ADispatcher registered execution handler for '%s'", agent_name)

    async def dispatch(self, message: A2AMessage, principal: A2APeerPrincipal | None = None) -> A2AResponse:
        """Dispatch only an authorized peer skill with bounded timeout and trace auditing."""
        if principal is not None and not peer_allows(principal, message.recipient, message.method):
            logger.warning(
                "A2A authorization denied: peer=%s recipient=%s method=%s",
                principal.peer_id, message.recipient, message.method,
            )
            raise PermissionError("peer is not authorized for recipient and method")
        if principal is None and os.getenv("APP_ENV", "development").strip().lower() in {"production", "prod", "staging"}:
            raise PermissionError("verified A2A peer principal is required")
        logger.info(
            "A2A Dispatch: [%s] sender=%s -> recipient=%s method=%s",
            message.trace_id, message.sender, message.recipient, message.method
        )

        handler = self._handlers.get(message.recipient)
        if not handler:
            error_msg = f"No registered A2A handler for target agent '{message.recipient}'"
            logger.error("A2A Error: %s", error_msg)
            return A2AResponse(
                id=message.id,
                error={"code": -32601, "message": error_msg},
                trace_id=message.trace_id,
            )

        try:
            result = await asyncio.wait_for(handler(message), timeout=self.timeout)
            return A2AResponse(
                id=message.id,
                result=result,
                trace_id=message.trace_id,
            )
        except asyncio.TimeoutError:
            logger.warning("A2A Handler timeout for message %s (agent '%s') after %ss", message.id, message.recipient, self.timeout)
            return A2AResponse(
                id=message.id,
                error={"code": -32603, "message": f"Agent execution timed out after {self.timeout}s"},
                trace_id=message.trace_id,
            )
        except Exception as exc:
            logger.exception("A2A Exception handling message %s: %s", message.id, exc)
            return A2AResponse(
                id=message.id,
                error={"code": -32603, "message": "Internal agent execution error"},
                trace_id=message.trace_id,
            )
