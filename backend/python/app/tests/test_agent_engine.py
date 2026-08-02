import pytest
import asyncio
from app.agent.codeact_repl import CodeActREPL
from app.agent.mcp_manager import MCPManager
from app.agent.agent_engine import GeneralistAgentEngine

@pytest.mark.asyncio
async def test_codeact_repl_basic():
    repl = CodeActREPL()
    res = await repl.execute("a = 10\nb = 20\nprint(a + b)")
    assert res["success"] is True
    assert "30" in res["stdout"]

@pytest.mark.asyncio
async def test_codeact_repl_error():
    repl = CodeActREPL()
    res = await repl.execute("raise ValueError('test error')")
    assert res["success"] is False
    assert "ValueError" in res["error"]

def test_mcp_manager():
    mcp = MCPManager()
    mcp.register_tool(
        name="test_tool",
        description="A dummy test tool",
        input_schema={"type": "object"},
        handler=lambda x: f"hello {x}"
    )
    tools = mcp.list_tools()
    assert len(tools) == 1
    assert tools[0]["name"] == "test_tool"

@pytest.mark.asyncio
async def test_agent_engine_run():
    engine = GeneralistAgentEngine()
    res = await engine.execute_task(goal="Test generalist agent run", max_steps=3)
    assert res["status"] == "completed"
    assert res["total_steps"] >= 3
    assert len(res["steps"]) >= 3
