"""LLM provider abstraction layer — Tayari version.
Supports OpenAI-compatible endpoints (Groq, OpenRouter, Together, local Ollama, vLLM),
a dedicated ``hermes`` tier (Hermes agent endpoint), and a graceful mock fallback
when no LLM is configured so the API never crashes.
"""
import json
import logging
import os
import re
import uuid

import httpx

# Hermes env keys live in the hermes config module (single source of truth).
# We import the module (not the values) so tests can monkeypatch the attributes
# and the change is observed at call time.
from app.services.hermes import config as hermes_config

logger = logging.getLogger(__name__)


LLM_BASE_URL = os.environ.get("LLM_BASE_URL", os.environ.get("LLM_API_URL", ""))
LLM_API_KEY = os.environ.get("LLM_API_KEY", os.environ.get("LLM_API_KEY", ""))
LLM_MODEL = os.environ.get("LLM_MODEL", os.environ.get("LLM_MODEL", "default"))


def _is_ollama() -> bool:
    return "ollama" in LLM_BASE_URL.lower() or "11434" in LLM_BASE_URL


def _hermes_active() -> bool:
    """True when the Hermes agent endpoint is configured (HERMES_AGENT_URL set)."""
    return bool(hermes_config.HERMES_AGENT_URL)


def active_engine() -> str:
    """Which agent engine is live — surfaced in agent traces and /health."""
    if _hermes_active():
        return f"hermes-{hermes_config.HERMES_MODEL}"
    if LLM_BASE_URL:
        if _is_ollama():
            return f"ollama-{LLM_MODEL}"
        return f"open-source ({LLM_MODEL})"
    return "mock-fallback"


async def llm_complete(system_message: str, user_message: str, tier: str = "fast",
                       session_id = None, max_tokens: int = 800, temperature: float = 0.3) -> str:
    """Single-shot completion. tier: 'fast'/'smart' (no-op), 'hermes' (Hermes endpoint)."""
    session_id = session_id or f"tayari-{uuid.uuid4().hex[:12]}"
    if tier == "hermes" and _hermes_active():
        return await _hermes_complete(system_message, user_message,
                                      max_tokens=max_tokens, temperature=temperature)
    if LLM_BASE_URL:
        if _is_ollama():
            return await _ollama_complete(system_message, user_message, max_tokens=max_tokens, temperature=temperature)
        return await _openai_compatible_complete(system_message, user_message, max_tokens=max_tokens, temperature=temperature)
    return _mock_complete(system_message, user_message)


async def _hermes_complete(system_message: str, user_message: str,
                           max_tokens: int = 800, temperature: float = 0.3) -> str:
    """Hermes-tier completion against an OpenAI-compatible /chat/completions endpoint.

    On any error the call falls through to the mock fallback so the API never
    crashes when the Hermes endpoint is unreachable.
    """
    base = hermes_config.HERMES_AGENT_URL.rstrip("/")
    headers = {"Content-Type": "application/json"}
    if hermes_config.HERMES_API_KEY:
        headers["Authorization"] = f"Bearer {hermes_config.HERMES_API_KEY}"
    payload = {
        "model": hermes_config.HERMES_MODEL,
        "messages": [
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    try:
        async with httpx.AsyncClient(timeout=180) as client:
            resp = await client.post(f"{base}/chat/completions", json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        return data["choices"][0]["message"]["content"]
    except Exception as exc:  # noqa: BLE001 - degrade to mock, never crash
        logger.warning("hermes completion failed (%s); falling back to mock", exc)
        return _mock_complete(system_message, user_message)


async def _openai_compatible_complete(system_message: str, user_message: str, max_tokens: int = 800, temperature: float = 0.3) -> str:
    headers = {"Content-Type": "application/json"}
    if LLM_API_KEY:
        headers["Authorization"] = f"Bearer {LLM_API_KEY}"
    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    base = LLM_BASE_URL.rstrip("/")
    async with httpx.AsyncClient(timeout=180) as client:
        resp = await client.post(f"{base}/chat/completions", json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()
    return data["choices"][0]["message"]["content"]


async def _ollama_complete(system_message: str, user_message: str, max_tokens: int = 800, temperature: float = 0.3) -> str:
    """Ollama uses /api/generate with a single prompt string, not chat messages."""
    prompt = f"{system_message}\n\n{user_message}"
    payload = {
        "model": LLM_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        },
    }
    base = LLM_BASE_URL.rstrip("/")
    async with httpx.AsyncClient(timeout=300) as client:
        resp = await client.post(f"{base}/api/generate", json=payload)
        resp.raise_for_status()
        data = resp.json()
    return data.get("response", "")


def _mock_complete(system_message: str, user_message: str) -> str:
    """Graceful fallback when no LLM is configured. Returns a basic response."""
    logger.warning("No LLM configured (LLM_BASE_URL/LLM_API_KEY missing). Returning mock response.")
    # Return a minimal JSON structure if the caller expects JSON, otherwise a generic message.
    return json.dumps({
        "score": 75,
        "changes": ["Added action verbs", "Quantified achievements", "Matched keywords"],
        "keywords_added": ["Python", "FastAPI", "Docker"],
        "estimated_score": 80,
    })


def extract_json(text: str):
    """Robustly extract a JSON object/array from an LLM response."""
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    for opener, closer in (("{", "}"), ("[", "]")):
        start = text.find(opener)
        end = text.rfind(closer)
        if start != -1 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except json.JSONDecodeError:
                continue
    logger.error("Failed to parse JSON from LLM response: %s", text[:400])
    raise ValueError("LLM returned unparseable JSON")
