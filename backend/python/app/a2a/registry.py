"""
Central Agent Discovery Registry for A2A Protocol.
Serves /.well-known/agent-card.json and manages agent capability discovery.
"""
from typing import Dict, Optional, List
import logging

from app.a2a.models import AgentCard, AgentCapability
from app.services.capabilities import capability_enabled
from app.a2a.authorization import A2APeerPrincipal, card_allows

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

    def get_system_agent_card(self, host_url: str = "http://localhost:8000", principal: A2APeerPrincipal | None = None) -> AgentCard:
        """Return a peer-scoped Agent Card for /.well-known/agent-card.json."""
        all_capabilities: List[AgentCapability] = []
        visible_agents = []
        for card in self._agents.values():
            if card.required_capability and not capability_enabled(card.required_capability):
                continue
            allowed = [capability for capability in card.capabilities if principal is None or card_allows(principal, card.name, capability.name)]
            if principal is not None and not allowed:
                continue
            visible_agents.append(card)
            all_capabilities.extend(allowed)

        return AgentCard(
            name="Tayari AI Multi-Agent Platform",
            description="Production Tayari Agent-to-Agent Platform exposing authorized specialized career agents.",
            version="1.0.0",
            url=host_url,
            capabilities=all_capabilities,
            metadata={"total_agents": len(visible_agents), "peer_scoped": principal is not None},
        )
