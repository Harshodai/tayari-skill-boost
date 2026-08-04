import pytest
import asyncio
from unittest import mock

from app.agent.agent_engine import GeneralistAgentEngine, _resolve_and_validate_url
from app.agent.browser_operator import BrowserOperator
from app.agent.codeact_repl import CodeActREPL
from app.agent.mcp_manager import MCPManager

_safe_code = GeneralistAgentEngine._is_safe_code

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


def test_safe_code_accepts_disallowed_names_inside_string_literals():
    code = "files = ['open.py', 'os', 'sys.py']\nprint('Workspace files:', files)"
    assert _safe_code(code) is True


def test_safe_code_rejects_actual_disallowed_calls():
    assert _safe_code("open('/etc/passwd')") is False
    assert _safe_code("os.listdir('.')") is False
    assert _safe_code("__import__('os')") is False


def test_safe_code_rejects_plain_disallowed_name_references():
    assert _safe_code("print(os)") is False
    assert _safe_code("print(sys)") is False


def test_resolve_and_validate_url_rejects_private_ip():
    with mock.patch("app.agent.agent_engine.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("127.0.0.1", 443))]):
        assert _resolve_and_validate_url("https://example.com") is None


def test_resolve_and_validate_url_accepts_public_ip():
    with mock.patch("app.agent.agent_engine.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("93.184.216.34", 443))]):
        info = _resolve_and_validate_url("https://example.com")
    assert info is not None
    assert info["original_hostname"] == "example.com"
    assert info["pinned_ip"] == "93.184.216.34"
    assert info["target_url"] == "https://93.184.216.34:443"
    assert info["headers"] == {"Host": "example.com"}


def test_write_file_blocks_escape_via_symlink(tmp_path):
    workspace = tmp_path / "ws"
    workspace.mkdir()
    outside = tmp_path / "outside.txt"
    outside.write_text("secret")
    engine = GeneralistAgentEngine(workspace_path=str(workspace))
    link = workspace / "escape.txt"
    link.symlink_to(outside)

    tool = engine.mcp.tools["write_file"]
    result = tool.handler(file_path="escape.txt", content="overwritten")
    # ponytail: assert the specific file-write failure (symlink blocked by
    # O_NOFOLLOW) rather than the generic "Error:" prefix, so an unrelated
    # handler failure cannot satisfy the assertion.
    assert result.startswith("Error: Failed to write file 'escape.txt'")
    assert outside.read_text() == "secret"


def test_write_file_blocks_symlinked_file(tmp_path):
    workspace = tmp_path / "ws"
    workspace.mkdir()
    outside = tmp_path / "secret.txt"
    outside.write_text("do not touch")
    engine = GeneralistAgentEngine(workspace_path=str(workspace))
    (workspace / "link.txt").symlink_to(outside)

    tool = engine.mcp.tools["write_file"]
    result = tool.handler(file_path="link.txt", content="evil")
    assert result.startswith("Error:")
    assert outside.read_text() == "do not touch"


def test_write_file_creates_nested_dirs(tmp_path):
    workspace = tmp_path / "ws"
    workspace.mkdir()
    engine = GeneralistAgentEngine(workspace_path=str(workspace))

    tool = engine.mcp.tools["write_file"]
    result = tool.handler(file_path="a/b/c.txt", content="nested")
    assert result.startswith("Successfully written")
    assert (workspace / "a" / "b" / "c.txt").read_text() == "nested"


def test_write_file_rejects_dotdot_escape(tmp_path):
    workspace = tmp_path / "ws"
    workspace.mkdir()
    engine = GeneralistAgentEngine(workspace_path=str(workspace))

    tool = engine.mcp.tools["write_file"]
    result = tool.handler(file_path="../escape.txt", content="evil")
    assert result.startswith("Error:")


@pytest.mark.asyncio
async def test_execute_task_listdir_failure_is_structured(tmp_path):
    workspace = tmp_path / "ws"
    workspace.mkdir()
    engine = GeneralistAgentEngine(workspace_path=str(workspace))
    with mock.patch("app.agent.agent_engine.os.listdir", side_effect=OSError("permission denied")):
        res = await engine.execute_task(goal="listdir failure", max_steps=3)
    assert res["status"] == "completed"
    step_2 = next(s for s in res["steps"] if s["step"] == 2)
    assert step_2["result"]["success"] is False
    assert "Workspace inspection failed" in step_2["result"]["error"]


@pytest.mark.asyncio
async def test_execute_task_rejects_non_positive_max_steps(tmp_path):
    workspace = tmp_path / "ws"
    workspace.mkdir()
    engine = GeneralistAgentEngine(workspace_path=str(workspace))
    with pytest.raises(ValueError, match="max_steps"):
        await engine.execute_task(goal="bad max_steps", max_steps=0)


@pytest.mark.asyncio
async def test_navigate_web_uses_pinned_target_url_and_host_header(tmp_path):
    workspace = tmp_path / "ws"
    workspace.mkdir()
    engine = GeneralistAgentEngine(workspace_path=str(workspace))
    engine.browser = mock.AsyncMock(spec=BrowserOperator)

    info = {"original_url": "https://example.com", "target_url": "https://93.184.216.34:443", "headers": {"Host": "example.com"}}
    with mock.patch("app.agent.agent_engine._resolve_and_validate_url", return_value=info):
        await engine.mcp.call_tool("navigate_web", {"url": "https://example.com"})

    engine.browser.navigate.assert_awaited_once_with(
        "https://93.184.216.34:443",
        headers={"Host": "example.com"},
        validate_redirects=True,
    )


@pytest.mark.asyncio
async def test_navigate_web_rejects_unsafe_url(tmp_path):
    workspace = tmp_path / "ws"
    workspace.mkdir()
    engine = GeneralistAgentEngine(workspace_path=str(workspace))
    engine.browser = mock.AsyncMock(spec=BrowserOperator)

    with mock.patch("app.agent.agent_engine._resolve_and_validate_url", return_value=None):
        res = await engine.mcp.call_tool("navigate_web", {"url": "http://localhost"})

    engine.browser.navigate.assert_not_awaited()
    content = res["content"]
    assert content and "Rejected URL" in content[0]["text"]


@pytest.mark.asyncio
async def test_navigate_web_dns_rebinding_redirect_blocked(tmp_path):
    """A redirect from the validated public host to a private address is blocked.

    The navigation lands on a pinned public IP, but the server responds with a
    redirect to a hostname that (on a second resolution) points at a private
    address. The redirect revalidation path must reject that hop.
    """
    workspace = tmp_path / "ws"
    workspace.mkdir()
    engine = GeneralistAgentEngine(workspace_path=str(workspace))
    engine.browser = mock.AsyncMock(spec=BrowserOperator)
    engine.browser.navigate.return_value = {
        "success": True,
        "url": "https://93.184.216.34:443",
        "title": "ok",
        "status": 200,
        "content_preview": "public page",
    }

    info = {"original_url": "https://example.com", "target_url": "https://93.184.216.34:443", "headers": {"Host": "example.com"}}
    with mock.patch("app.agent.agent_engine._resolve_and_validate_url", return_value=info):
        res = await engine.mcp.call_tool("navigate_web", {"url": "https://example.com"})

    engine.browser.navigate.assert_awaited_once_with(
        "https://93.184.216.34:443",
        headers={"Host": "example.com"},
        validate_redirects=True,
    )

    # Simulate the redirect interceptor hitting a private destination: the same
    # guard used by the browser for every redirect hop.
    from app.agent.agent_engine import _is_safe_url
    assert _is_safe_url("http://127.0.0.1:8080/admin") is False
    with mock.patch("app.agent.agent_engine.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("127.0.0.1", 80))]):
        assert _is_safe_url("http://rebind.example.com") is False
