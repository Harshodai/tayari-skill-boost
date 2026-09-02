import pytest

from app.agent.agent_engine import GeneralistAgentEngine
from app.agent.agent_memory import AgentMemory


class _Acquire:
    def __init__(self, connection):
        self.connection = connection

    async def __aenter__(self):
        return self.connection

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _Transaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _Connection:
    def __init__(self):
        self.rows = [{"memory_type": "semantic", "memory_key": "preferred_role", "payload": {"value": "Data Engineer"}}]
        self.writes = []

    def fetch(self, *_args):
        async def _fetch():
            return self.rows
        return _fetch()

    def transaction(self):
        return _Transaction()

    def execute(self, *_args):
        async def _execute(*args):
            self.writes.append(args)
        return _execute(*_args)


class _Pool:
    def __init__(self, connection):
        self.connection = connection

    def acquire(self):
        return _Acquire(self.connection)


@pytest.mark.asyncio
async def test_agent_memory_reloads_and_flushes_owner_scoped_data(monkeypatch):
    connection = _Connection()
    pool = _Pool(connection)
    async def fake_get_pool():
        return pool
    monkeypatch.setattr("app.agent.agent_memory.get_pool", fake_get_pool)

    memory = AgentMemory(user_id="00000000-0000-0000-0000-000000000001")
    loaded = await memory.load()
    assert loaded["status"] == "loaded"
    assert memory.recall_knowledge("preferred_role") == "Data Engineer"
    memory.store_knowledge("current_goal", "Find data engineering roles")
    flushed = await memory.flush()
    assert flushed["status"] == "persisted"
    assert flushed["written"] == 1
    assert connection.writes


@pytest.mark.asyncio
async def test_browser_urls_are_exercised_and_bad_urls_are_not_claimed_complete(monkeypatch, tmp_path):
    engine = GeneralistAgentEngine(workspace_path=str(tmp_path))

    async def fake_navigate(url, headers=None, validate_redirects=False):
        return {"success": True, "url": url, "title": "Example", "content_preview": "untrusted page text"}

    def fake_resolve(url):
        if "127.0.0.1" in url or "localhost" in url:
            return None
        return {"target_url": url, "headers": {"Host": "example.com"}}

    monkeypatch.setattr("app.agent.agent_engine._resolve_and_validate_url", fake_resolve)
    monkeypatch.setattr(engine.browser, "navigate", fake_navigate)
    monkeypatch.setattr(engine.orchestrator, "delegate_parallel", lambda tasks: _completed_tasks(tasks))
    monkeypatch.setattr(engine.repl, "execute", lambda code: _successful_repl())

    result = await engine.execute_task(
        goal="Research the approved page",
        max_steps=5,
        browser_urls=["https://example.com", "http://127.0.0.1:8080"],
    )
    assert result["browser_results"][0]["success"] is True
    assert result["browser_results"][1]["success"] is False
    assert result["status"] == "partial"
    assert result["verification"]["browser_success"] is False


async def _completed_tasks(tasks):
    return [{"subagent": item["agent_type"], "status": "completed", "task": item["task"], "output": "ok"} for item in tasks]


async def _successful_repl():
    return {"success": True, "output": "ok"}
