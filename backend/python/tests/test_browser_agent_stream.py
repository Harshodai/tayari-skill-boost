"""Tests for the V7 Glass-Box browser stream generator.

Pure tests: browser_use import and get_llm are monkeypatched; no browser runs.
"""
import pytest

pytest.importorskip("pydantic")

from app.services.browser_automation.agent import stream_browser_agent

MODULE = "app.services.browser_automation.agent"


class _FakeState:
    screenshot = "aGVsbG8="
    url = "https://example.com/jobs/1"
    title = "Example Job"


class _FakeHistory:
    def final_result(self):
        return "Applied to the role."

    def is_done(self):
        return True

    def errors(self):
        return []

    def urls(self):
        return ["https://example.com/jobs/1"]

    def model_thoughts(self):
        return []


class _FakeAgent:
    def __init__(self, task, llm, register_new_step_callback):
        self._cb = register_new_step_callback

    async def run(self, max_steps=25):
        self._cb(_FakeState(), None, 1)
        return _FakeHistory()


@pytest.mark.asyncio
async def test_stream_yields_screenshot_then_done(monkeypatch):
    monkeypatch.setitem(__import__("sys").modules, "browser_use", type("browser_use", (), {"Agent": _FakeAgent})())
    monkeypatch.setattr(f"{MODULE}.get_llm", lambda: object())

    events = [e async for e in stream_browser_agent("Apply to the job", max_steps=5)]

    assert events[0]["type"] == "screenshot"
    assert events[0]["data"] == "aGVsbG8="
    assert events[0]["step"] == 1
    assert events[0]["url"] == "https://example.com/jobs/1"
    assert events[-1]["type"] == "done"
    assert "Applied" in events[-1]["result"]


@pytest.mark.asyncio
async def test_stream_emits_error_on_llm_config_failure(monkeypatch):
    monkeypatch.setitem(__import__("sys").modules, "browser_use", type("browser_use", (), {"Agent": _FakeAgent})())

    def raise_config():
        raise RuntimeError("no LLM configured")

    monkeypatch.setattr(f"{MODULE}.get_llm", raise_config)

    events = [e async for e in stream_browser_agent("Apply to the job")]
    assert len(events) == 1
    assert events[0]["type"] == "error"
    assert events[0]["error"] == "ai_service_unavailable"


@pytest.mark.asyncio
async def test_stream_rejects_blank_instruction(monkeypatch):
    events = [e async for e in stream_browser_agent("   ")]
    assert len(events) == 1
    assert events[0]["type"] == "error"
    assert events[0]["error"] == "invalid_instruction"


@pytest.mark.asyncio
async def test_stream_emits_error_when_browser_use_missing(monkeypatch):
    import builtins

    real_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name == "browser_use" or name.startswith("browser_use."):
            raise ImportError("No module named 'browser_use'")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fake_import)

    events = [e async for e in stream_browser_agent("Apply to the job")]
    assert len(events) == 1
    assert events[0]["type"] == "error"
    assert events[0]["error"] == "browser_agent_failed"