import pytest
import asyncio
from app.agent.agent_memory import AgentMemory
from app.agent.reflection_engine import ReflectionEngine
from app.agent.subagent_orchestrator import SubagentOrchestrator
from app.agent.agent_engine import GeneralistAgentEngine

def test_agent_memory():
    mem = AgentMemory()
    mem.record_episode(1, "Test Action", "print(1)", "1", True)
    mem.store_knowledge("key1", "val1")
    assert mem.recall_knowledge("key1") == "val1"
    summary = mem.get_summary()
    assert summary["total_episodes"] == 1
    assert summary["successful_episodes"] == 1

def test_reflection_engine():
    ref = ReflectionEngine()
    analysis = ref.analyze_failure("import non_existent_foo_123", "ModuleNotFoundError: No module named 'non_existent_foo_123'")
    assert "Missing Python dependency" in analysis["diagnosis"]
    assert "try:" in analysis["patched_code"]

@pytest.mark.asyncio
async def test_subagent_orchestrator():
    orch = SubagentOrchestrator()
    tasks = [
        {"agent_type": "researcher", "task": "Search for documentation"},
        {"agent_type": "coder", "task": "Write python script"}
    ]
    results = await orch.delegate_parallel(tasks)
    assert len(results) == 2
    assert results[0]["status"] == "completed"

@pytest.mark.asyncio
async def test_enterprise_agent_engine():
    engine = GeneralistAgentEngine()
    result = await engine.execute_task(goal="Build enterprise multi-agent system", max_steps=5)
    assert result["status"] == "completed"
    assert len(result["steps"]) == 3
    assert result["memory_summary"]["total_episodes"] == 3
    assert len(result["swarm_execution"]) == 3
