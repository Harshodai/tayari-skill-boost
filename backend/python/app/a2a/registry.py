"""
Central Agent Discovery Registry for A2A Protocol.
Serves /.well-known/agent-card.json and manages agent capability discovery.
"""
from typing import Dict, Optional, List
import logging

from app.a2a.models import AgentCard, AgentCapability
from app.services.capabilities import capability_enabled

logger = logging.getLogger(__name__)


class AgentRegistry:
    """In-memory agent registry enabling dynamic capability discovery."""

    _instance: Optional["AgentRegistry"] = None

    def __init__(self):
        self._agents: Dict[str, AgentCard] = {}

    @classmethod
    def get_instance(cls) -> "AgentRegistry":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def register(self, card: AgentCard) -> None:
        """Register an agent capability card."""
        self._agents[card.name] = card
        logger.info("A2A Agent registered: %s (v%s)", card.name, card.version)

    def get_agent(self, name: str) -> Optional[AgentCard]:
        return self._agents.get(name)

    def list_agents(self) -> List[AgentCard]:
        return list(self._agents.values())

    def get_system_agent_card(self, host_url: str = "http://localhost:8000") -> AgentCard:
        """Return combined system Agent Card for /.well-known/agent-card.json."""
        all_capabilities: List[AgentCapability] = []
        visible_agents = [
            card
            for card in self._agents.values()
            if not card.required_capability or capability_enabled(card.required_capability)
        ]
        for card in visible_agents:
            all_capabilities.extend(card.capabilities)

        return AgentCard(
            name="Tayari AI Multi-Agent Platform",
            description="Production Tayari Agent-to-Agent Platform exposing specialized career agents.",
            version="1.0.0",
            url=host_url,
            capabilities=all_capabilities,
            metadata={"total_agents": len(visible_agents)},
        )
