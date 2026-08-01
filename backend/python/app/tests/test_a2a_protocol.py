"""
Unit tests for A2A Protocol, Agent Cards, Registry, and Dispatcher.
"""
import asyncio
import pytest
from app.a2a.models import A2AMessage, A2AResponse, AgentCard, AgentCapability
from app.a2a.registry import AgentRegistry
from app.a2a.dispatcher import A2ADispatcher
from app.a2a.agents import register_all_a2a_agents


@pytest.fixture(autouse=True)
def setup_a2a():
    register_all_a2a_agents()


def test_agent_registry():
    registry = AgentRegistry.get_instance()
    agents = registry.list_agents()
    agent_names = [a.name for a in agents]
    assert "AtsScorerAgent" in agent_names
    assert "OptimizerAgent" in agent_names
    assert "TruthGateAgent" in agent_names
    assert "InterviewCoachAgent" in agent_names
    assert "JobSearchAgent" in agent_names


def test_system_agent_card():
    registry = AgentRegistry.get_instance()
    card = registry.get_system_agent_card()
    assert card.name == "Tayari AI Multi-Agent Platform"
    assert len(card.capabilities) >= 5


@pytest.mark.asyncio
async def test_a2a_dispatch_ats_agent():
    dispatcher = A2ADispatcher.get_instance()
    msg = A2AMessage(
        sender="TestRunner",
        recipient="AtsScorerAgent",
        method="analyze_ats",
        params={
            "resume_text": "Experienced Python Engineer with FastAPI expertise.",
            "job_description": "Looking for Senior Python Developer with FastAPI and Docker skills.",
        },
    )
    resp = await dispatcher.dispatch(msg)
    assert resp.error is None
    assert resp.result is not None
    assert resp.result["agent"] == "AtsScorerAgent"
    assert "score_data" in resp.result


@pytest.mark.asyncio
async def test_a2a_dispatch_truth_gate_agent():
    dispatcher = A2ADispatcher.get_instance()
    msg = A2AMessage(
        sender="TestRunner",
        recipient="TruthGateAgent",
        method="check_authenticity",
        params={
            "original_text": "Built Python backend microservices.",
            "optimized_text": "Built Python backend microservices improving latency.",
        },
    )
    resp = await dispatcher.dispatch(msg)
    assert resp.error is None
    assert resp.result["agent"] == "TruthGateAgent"
    assert "payload" in resp.result


@pytest.mark.asyncio
async def test_a2a_dispatch_exception_hides_raw_stacktrace():
    """Verify that exception in handler returns generic error message without leaking str(exc)."""
    dispatcher = A2ADispatcher.get_instance()

    async def throwing_handler(msg: A2AMessage):
        raise ValueError("Secret internal database connection string error")

    dispatcher.register_handler("FailingAgent", throwing_handler)
    msg = A2AMessage(sender="Test", recipient="FailingAgent", method="test")
    resp = await dispatcher.dispatch(msg)

    assert resp.error is not None
    assert resp.error["code"] == -32603
    assert resp.error["message"] == "Internal agent execution error"
    assert "Secret internal database" not in resp.error["message"]


@pytest.mark.asyncio
async def test_a2a_dispatch_timeout():
    """Verify that slow handlers time out gracefully via wait_for."""
    dispatcher = A2ADispatcher.get_instance()
    original_timeout = dispatcher.timeout
    dispatcher.timeout = 0.1  # set 100ms timeout for test

    async def slow_handler(msg: A2AMessage):
        await asyncio.sleep(0.5)
        return {"done": True}

    dispatcher.register_handler("SlowAgent", slow_handler)
    msg = A2AMessage(sender="Test", recipient="SlowAgent", method="test")
    resp = await dispatcher.dispatch(msg)

    dispatcher.timeout = original_timeout

    assert resp.error is not None
    assert resp.error["code"] == -32603
    assert "timed out" in resp.error["message"]
