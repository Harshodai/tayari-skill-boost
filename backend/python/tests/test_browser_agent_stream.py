"""Tests for the V7 Glass-Box browser stream generator.

Pure tests: browser_use import and get_llm are monkeypatched; no browser runs.
"""
import os
import sys

# app.main's import chain fail-fasts without JWT_SECRET (app/tests/conftest.py
# sets it for that tree; this file must stand alone when run directly).
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-for-browser-stream-tests")

import pytest

pytest.importorskip("pydantic")

from fastapi import HTTPException

import app.main as main_module
import app.services.db as db_module
from app.main import browser_automation_stream_endpoint
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


# --- endpoint-level fail-closed tests for the run_id trust anchor -----------


def _authz_endpoint_request(monkeypatch):
    """Return the endpoint with a synthetic verified actor for direct calls."""
    monkeypatch.setenv("CAPABILITY_AUTONOMOUS_BROWSER", "true")

    async def call(payload, request):
        return await browser_automation_stream_endpoint(payload, request, _user_id="u-test")
    return call


@pytest.mark.asyncio
async def test_stream_unknown_run_fails_closed_404(monkeypatch):
    endpoint = _authz_endpoint_request(monkeypatch)

    async def no_run(run_id: str):
        return None

    monkeypatch.setattr(db_module, "load_agent_run", no_run)

    with pytest.raises(HTTPException) as exc:
        await endpoint(
            {"instruction": "x", "run_id": "11111111-1111-1111-1111-111111111111"},
            request=object(),
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_stream_mismatched_owner_fails_closed_403(monkeypatch):
    endpoint = _authz_endpoint_request(monkeypatch)

    async def foreign_run(run_id: str):
        return {"user_id": "u-other", "config": None, "job_url": None}

    monkeypatch.setattr(db_module, "load_agent_run", foreign_run)

    with pytest.raises(HTTPException) as exc:
        await endpoint(
            {"instruction": "x", "run_id": "22222222-2222-2222-2222-222222222222"},
            request=object(),
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_stream_authorized_run_streams_successfully(monkeypatch):
    endpoint = _authz_endpoint_request(monkeypatch)

    async def owned_run(run_id: str):
        return {"user_id": "u-test", "config": {"job_url": "https://jobs.example.com/123"}, "job_url": None}

    monkeypatch.setattr(db_module, "load_agent_run", owned_run)
    monkeypatch.setitem(sys.modules, "browser_use", type("browser_use", (), {"Agent": _FakeAgent})())
    monkeypatch.setattr(f"{MODULE}.get_llm", lambda: object())

    response = await endpoint(
        {"instruction": "Apply", "run_id": "33333333-3333-3333-3333-333333333333"},
        request=object(),
    )
    chunks = [c async for c in response.body_iterator]
    body = "".join(chunks)
    assert "screenshot" in body
    assert "done" in body


@pytest.mark.asyncio
async def test_opensandbox_requires_isolated_computer_capability(monkeypatch):
    monkeypatch.setenv("BROWSER_PROVIDER", "opensandbox")
    monkeypatch.setenv("CAPABILITY_AUTONOMOUS_BROWSER", "true")
    monkeypatch.setenv("CAPABILITY_WORKSPACE_ISOLATED_COMPUTER", "false")

    with pytest.raises(HTTPException) as exc:
        await browser_automation_stream_endpoint({"instruction": "observe"}, request=object(), _user_id="u-test")
    assert exc.value.status_code == 423
    assert exc.value.detail["capability"] == "workspace.isolated_computer"


@pytest.mark.asyncio
async def test_local_bridge_requires_bridge_capability(monkeypatch):
    monkeypatch.setenv("BROWSER_PROVIDER", "local_bridge")
    monkeypatch.setenv("CAPABILITY_AUTONOMOUS_BROWSER", "true")
    monkeypatch.setenv("CAPABILITY_WORKSPACE_LOCAL_BROWSER_BRIDGE", "false")

    with pytest.raises(HTTPException) as exc:
        await browser_automation_stream_endpoint({"instruction": "observe"}, request=object(), _user_id="u-test")
    assert exc.value.status_code == 423
    assert exc.value.detail["capability"] == "workspace.local_browser_bridge"
