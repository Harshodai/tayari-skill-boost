"""LLM hermes-tier tests.

Validates the additive ``hermes`` LLM tier in ``app.services.llm_service``:
- ``_hermes_active`` reflects HERMES_AGENT_URL presence.
- ``active_engine()`` reports ``hermes-{model}`` when the Hermes endpoint is set.
- ``llm_complete(..., tier="hermes")`` routes to the Hermes endpoint and
  returns the mocked ``choices[0].message.content``.
- When the Hermes endpoint fails or is not configured, ``llm_complete`` raises
  ``LLMNotConfiguredError`` (never silently returns fabricated mock text).
  ``LLM_ALLOW_MOCK_FALLBACK`` is deliberately inert: the silent-mock path was
  removed, and a test below pins that the flag cannot re-enable it.

httpx is mocked via ``httpx.MockTransport`` (no extra deps required).

Run: python -m pytest tests/test_llm_hermes.py -v
"""
from __future__ import annotations

import asyncio
import json
from typing import Any

import httpx
import pytest

from app.services import llm_service
from app.services.hermes import config as hermes_config


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _patch_client(monkeypatch: pytest.MonkeyPatch, handler: Any) -> None:
    """Replace ``httpx.AsyncClient`` in llm_service with a MockTransport-backed one."""
    class _MockClient(httpx.AsyncClient):
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            kwargs.pop("transport", None)
            super().__init__(transport=httpx.MockTransport(handler), **{
                k: v for k, v in kwargs.items() if k != "timeout"
            })
    monkeypatch.setattr(llm_service.httpx, "AsyncClient", _MockClient)


@pytest.fixture
def clean_llm_env(monkeypatch):
    """Strip the generic LLM endpoint so only the hermes tier is in play."""
    monkeypatch.setenv("LLM_PROVIDER", "")
    monkeypatch.setenv("LLM_BASE_URL", "")
    monkeypatch.setenv("LLM_API_KEY", "")
    monkeypatch.setenv("LLM_MODEL", "default")
    monkeypatch.setattr(hermes_config, "HERMES_AGENT_URL", "")
    monkeypatch.setattr(hermes_config, "HERMES_API_KEY", "")
    monkeypatch.setattr(hermes_config, "HERMES_MODEL", "hermes3:8b")


# ---------------------------------------------------------------------------
# _hermes_active + active_engine label
# ---------------------------------------------------------------------------

def test_hermes_active_when_url_set(clean_llm_env, monkeypatch):
    monkeypatch.setattr(hermes_config, "HERMES_AGENT_URL", "http://ollama:11434/v1")
    assert llm_service._hermes_active() is True
    assert llm_service.active_engine() == "hermes-hermes3:8b"


def test_hermes_inactive_when_url_blank(clean_llm_env):
    assert llm_service._hermes_active() is False
    # No LLM_BASE_URL either -> MockProvider reports "unconfigured"
    assert llm_service.active_engine() == "unconfigured"


def test_hermes_takes_precedence_over_generic_llm(clean_llm_env, monkeypatch):
    """When both HERMES_AGENT_URL and LLM_BASE_URL are set, active_engine() reports hermes."""
    monkeypatch.setattr(hermes_config, "HERMES_AGENT_URL", "http://ollama:11434/v1")
    monkeypatch.setenv("LLM_BASE_URL", "http://groq.example/v1")
    monkeypatch.setenv("LLM_MODEL", "groq-model")
    assert llm_service.active_engine() == "hermes-hermes3:8b"


# ---------------------------------------------------------------------------
# llm_complete(tier="hermes") routes to the Hermes endpoint
# ---------------------------------------------------------------------------

def test_llm_complete_hermes_returns_endpoint_content(clean_llm_env, monkeypatch):
    monkeypatch.setattr(hermes_config, "HERMES_AGENT_URL", "http://ollama:11434/v1")
    monkeypatch.setattr(hermes_config, "HERMES_API_KEY", "secret-key")
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["auth"] = request.headers.get("authorization")
        body = json.loads(request.content.decode())
        captured["model"] = body.get("model")
        captured["messages"] = body.get("messages")
        return httpx.Response(200, json={
            "choices": [{"message": {"content": "hermes-ranked jobs"}}]
        })

    _patch_client(monkeypatch, handler)
    result = asyncio.run(llm_service.llm_complete(
        "you are a ranker", "rank these jobs", tier="hermes",
    ))
    assert result == "hermes-ranked jobs"
    assert captured["url"].endswith("/chat/completions")
    assert captured["auth"] == "Bearer secret-key"
    assert captured["model"] == "hermes3:8b"
    assert captured["messages"][0]["role"] == "system"
    assert captured["messages"][1]["content"] == "rank these jobs"


def test_llm_complete_hermes_without_auth_header(clean_llm_env, monkeypatch):
    """When HERMES_API_KEY is blank, no Authorization header is sent."""
    monkeypatch.setattr(hermes_config, "HERMES_AGENT_URL", "http://ollama:11434/v1")
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["auth"] = request.headers.get("authorization")
        return httpx.Response(200, json={
            "choices": [{"message": {"content": "ok"}}]
        })

    _patch_client(monkeypatch, handler)
    result = asyncio.run(llm_service.llm_complete("s", "u", tier="hermes"))
    assert result == "ok"
    assert captured["auth"] is None


def test_llm_complete_hermes_http_error_raises_by_default(clean_llm_env, monkeypatch):
    """A 500 from the Hermes endpoint raises LLMNotConfiguredError, not a silent mock."""
    monkeypatch.setattr(hermes_config, "HERMES_AGENT_URL", "http://ollama:11434/v1")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="boom")

    _patch_client(monkeypatch, handler)
    with pytest.raises(llm_service.LLMNotConfiguredError):
        asyncio.run(llm_service.llm_complete("s", "u", tier="hermes"))


def test_llm_complete_hermes_http_error_ignores_mock_fallback_flag(clean_llm_env, monkeypatch):
    """``LLM_ALLOW_MOCK_FALLBACK=true`` must NOT degrade a Hermes failure to mock.

    The silent-mock path was removed; the flag is inert. Pin this so nobody
    re-adds fabricated AI output behind an env var.
    """
    monkeypatch.setattr(hermes_config, "HERMES_AGENT_URL", "http://ollama:11434/v1")
    monkeypatch.setenv("LLM_ALLOW_MOCK_FALLBACK", "true")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="boom")

    _patch_client(monkeypatch, handler)
    with pytest.raises(llm_service.LLMNotConfiguredError):
        asyncio.run(llm_service.llm_complete("s", "u", tier="hermes"))


def test_llm_complete_hermes_tier_without_endpoint_raises_by_default(clean_llm_env):
    """tier='hermes' but HERMES_AGENT_URL unset + no LLM_BASE_URL -> raises, no silent mock."""
    with pytest.raises(llm_service.LLMNotConfiguredError):
        asyncio.run(llm_service.llm_complete("s", "u", tier="hermes"))


def test_llm_complete_fast_tier_unchanged_when_hermes_set(clean_llm_env, monkeypatch):
    """tier='fast' must NOT route to hermes even when hermes is configured."""
    monkeypatch.setattr(hermes_config, "HERMES_AGENT_URL", "http://ollama:11434/v1")
    called_hermes = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        called_hermes["n"] += 1
        return httpx.Response(200, json={
            "choices": [{"message": {"content": "x"}}]
        })

    _patch_client(monkeypatch, handler)
    # tier="fast" with no LLM_BASE_URL -> raises (hermes NOT called, no silent mock)
    with pytest.raises(llm_service.LLMNotConfiguredError):
        asyncio.run(llm_service.llm_complete("s", "u", tier="fast"))
    assert called_hermes["n"] == 0