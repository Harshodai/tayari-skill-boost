"""LLM provider abstraction layer — Tayari version.

Design: SOLID-principled provider hierarchy.
  - Interface (LLMProvider): Single Responsibility — one method, complete().
  - Concrete providers: OpenAI-compatible, Ollama, OpenRouter, NVIDIA NIM, Hermes, Mock.
  - Factory (build_provider): Open/Closed — add providers without touching routing logic.
  - llm_complete() and llm_json(): stable public API, propagate LLMNotConfiguredError upward.

Provider selection (priority order):
  1. tier == 'hermes'     → HermesProvider  (if HERMES_AGENT_URL set)
  2. LLM_PROVIDER=openrouter → OpenRouterProvider (OPENROUTER_API_KEY required)
  3. LLM_PROVIDER=nvidia_nim → NVIDIANIMProvider  (NVIDIA_NIM_API_KEY required)
  4. LLM_PROVIDER=ollama  → OllamaProvider        (LLM_BASE_URL ending in /v1 or 11434)
  5. LLM_BASE_URL set     → OpenAICompatibleProvider (generic)
  6. No config            → raises LLMNotConfiguredError (never returns fabricated data)

Environment variables:
  LLM_PROVIDER        = openrouter | nvidia_nim | ollama | openai | (empty → auto-detect)
  LLM_BASE_URL        = base URL for the chosen provider
  LLM_API_KEY         = API key (also read as OPENROUTER_API_KEY, NVIDIA_NIM_API_KEY)
  LLM_MODEL           = model name
  OPENROUTER_API_KEY  = OpenRouter specific key
  OPENROUTER_MODEL    = default: openai/gpt-4o-mini
  NVIDIA_NIM_API_KEY  = NVIDIA NIM specific key
  NVIDIA_NIM_MODEL    = default: meta/llama-3.1-70b-instruct

Model routing (optional — per-tier model selection within the chosen provider):
  <MODEL_VAR>_FAST / <MODEL_VAR>_SMART override <MODEL_VAR> for tier='fast'
  (classification, ranking, drafting) and tier='smart' (the reflexion
  optimizer) respectively — e.g. OPENROUTER_MODEL_FAST=openai/gpt-4o-mini
  alongside OPENROUTER_MODEL_SMART=anthropic/claude-sonnet-5. Unset means every
  tier uses <MODEL_VAR>, which is the pre-existing behaviour.
  NVIDIA_NIM_BASE_URL = default: https://integrate.api.nvidia.com/v1
  HERMES_AGENT_URL    / HERMES_API_KEY / HERMES_MODEL (from hermes config module)
"""
from __future__ import annotations

import json
import logging
import os
import re
import time
import uuid
from abc import ABC, abstractmethod
from collections import defaultdict
from datetime import datetime, timezone
from threading import Lock
from typing import Optional, Type, TypeVar, Any, Dict, List
from pydantic import BaseModel, ValidationError

import httpx

from app.services.hermes import config as hermes_config
from app.services.ai_orchestration import SUPPORTED_TIERS, normalize_tier
from app.services.pii_scrubber import scrub as _scrub_pii
from app.telemetry import metrics
from app.telemetry.langfuse_client import trace_llm_call

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# LLM Observability & Token Pricing (WP-06)
# ---------------------------------------------------------------------------

def estimate_tokens(text: str) -> int:
    """Fast approximation of token count (~4 chars per token)."""
    if not text:
        return 0
    return max(1, len(text) // 4)


def get_model_pricing(model_name: str) -> tuple[float, float]:
    """Return (input_price_per_million, output_price_per_million) USD."""
    m = (model_name or "").lower()
    if "free" in m or "unconfigured" in m:
        return (0.0, 0.0)
    if "gpt-4o-mini" in m:
        return (0.15, 0.60)
    if "gpt-4o" in m:
        return (2.50, 10.00)
    if "sonnet" in m:
        return (3.00, 15.00)
    if "haiku" in m:
        return (0.80, 4.00)
    if "gemini" in m and "flash" in m:
        return (0.10, 0.40)
    if "gemini" in m and "pro" in m:
        return (1.25, 5.00)
    if "70b" in m:
        return (0.50, 0.75)
    if "8b" in m:
        return (0.05, 0.08)
    return (1.00, 3.00)


def calculate_llm_cost(model_name: str, prompt_tokens: int, completion_tokens: int) -> float:
    """Estimate USD cost for prompt and completion tokens."""
    in_rate, out_rate = get_model_pricing(model_name)
    cost = (prompt_tokens * (in_rate / 1_000_000.0)) + (completion_tokens * (out_rate / 1_000_000.0))
    return round(cost, 6)


class DailyCostTracker:
    """Tracks daily token spend per user/process against MAX_DAILY_LLM_COST_USD."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._spend_by_day_and_user: dict[tuple[str, str], float] = defaultdict(float)

    def record_cost(self, cost_usd: float, user_id: Optional[str] = None) -> tuple[float, bool, float]:
        """Record spend and return (new_total_spend, is_exceeded, limit)."""
        if not user_id or not str(user_id).strip():
            raise ValueError("record_cost requires a real user_id; synthetic identities rejected")
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        uid = str(user_id).strip()
        key = (today, uid)

        limit_str = os.getenv("MAX_DAILY_LLM_COST_USD", "0.50").strip()
        try:
            limit = float(limit_str)
        except ValueError:
            limit = 0.50

        with self._lock:
            new_total = self._spend_by_day_and_user[key] + cost_usd
            self._spend_by_day_and_user[key] = new_total
            is_exceeded = new_total > limit
            return new_total, is_exceeded, limit

    def reset(self) -> None:
        with self._lock:
            self._spend_by_day_and_user.clear()


daily_cost_tracker = DailyCostTracker()


# Holds references to fire-and-forget background tasks (privacy ledger writes)
# so they aren't garbage-collected mid-execution — asyncio only holds a weak
# reference to a task once nothing else refers to it.
_background_tasks: set = set()


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class LLMNotConfiguredError(RuntimeError):
    """Raised when no LLM provider is configured or the provider call fails.

    Callers (FastAPI route handlers) should catch this and return HTTP 503
    so users see an honest error rather than fabricated data.
    """


# ---------------------------------------------------------------------------
# Interface (Liskov + Dependency Inversion)
# ---------------------------------------------------------------------------

class LLMProvider(ABC):
    """Abstract base — every concrete provider must implement complete()."""

    @abstractmethod
    async def complete(
        self,
        system_message: str,
        user_message: str,
        max_tokens: int = 800,
        temperature: float = 0.3,
    ) -> str: ...

    def active_engine_label(self) -> str:
        return self.__class__.__name__


# ---------------------------------------------------------------------------
# Concrete providers
# ---------------------------------------------------------------------------

class OpenAICompatibleProvider(LLMProvider):
    """Any OpenAI-compatible /chat/completions endpoint (vLLM, Together, Groq, etc.)."""

    def __init__(self, base_url: str, api_key: str, model: str) -> None:
        self._base = base_url.rstrip("/")
        self._key = api_key
        self._model = model

    async def complete(self, system_message: str, user_message: str,
                       max_tokens: int = 800, temperature: float = 0.3) -> str:
        headers = {"Content-Type": "application/json"}
        if self._key:
            headers["Authorization"] = f"Bearer {self._key}"
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        async with httpx.AsyncClient(timeout=180) as client:
            resp = await client.post(f"{self._base}/chat/completions",
                                     json=payload, headers=headers)
            resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]

    def active_engine_label(self) -> str:
        return f"openai-compatible ({self._model})"


class OllamaProvider(LLMProvider):
    """Local Ollama server — uses /api/generate (not chat/completions)."""

    def __init__(self, base_url: str, model: str) -> None:
        self._base = base_url.rstrip("/")
        self._model = model

    async def complete(self, system_message: str, user_message: str,
                       max_tokens: int = 800, temperature: float = 0.3) -> str:
        payload = {
            "model": self._model,
            "prompt": f"{system_message}\n\n{user_message}",
            "stream": False,
            "options": {"temperature": temperature, "num_predict": max_tokens},
        }
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(f"{self._base}/api/generate", json=payload)
            resp.raise_for_status()
        return resp.json().get("response", "")

    def active_engine_label(self) -> str:
        return f"ollama-{self._model}"


class OpenRouterProvider(LLMProvider):
    """OpenRouter (https://openrouter.ai) — OpenAI-compatible with extra headers."""

    BASE = "https://openrouter.ai/api/v1"
    DEFAULT_MODEL = "openrouter/free"
    MAX_RETRIES = 3

    def __init__(self, api_key: str, model: str) -> None:
        self._key = api_key
        self._model = model or self.DEFAULT_MODEL

    async def complete(self, system_message: str, user_message: str,
                       max_tokens: int = 800, temperature: float = 0.3) -> str:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._key}",
            "HTTP-Referer": "https://tayari.app",
            "X-Title": "Tayari AI",
        }
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        for attempt in range(self.MAX_RETRIES):
            try:
                async with httpx.AsyncClient(timeout=180) as client:
                    resp = await client.post(f"{self.BASE}/chat/completions",
                                             json=payload, headers=headers)
                    if resp.status_code == 429:
                        remaining = resp.headers.get("X-RateLimit-Remaining", "0")
                        reset = resp.headers.get("X-RateLimit-Reset", "5")
                        wait = (2 ** attempt) + (int(reset) if reset.isdigit() else 5)
                        logger.warning("OpenRouter 429 (attempt %d/%d, remaining=%s); retrying in %ds",
                                       attempt + 1, self.MAX_RETRIES, remaining, wait)
                        import asyncio
                        await asyncio.sleep(wait)
                        continue
                    resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"]
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429 and attempt < self.MAX_RETRIES - 1:
                    continue
                logger.error("OpenRouter HTTP error after %d retries: %s", attempt + 1, e)
                raise
            except Exception as e:
                logger.error("OpenRouter request error (attempt %d/%d): %s", attempt + 1, self.MAX_RETRIES, e)
                if attempt == self.MAX_RETRIES - 1:
                    raise
        raise RuntimeError("OpenRouter exhausted retries")

    def active_engine_label(self) -> str:
        return f"openrouter/{self._model}"


class NVIDIANIMProvider(LLMProvider):
    """NVIDIA NIM inference API — OpenAI-compatible with exponential backoff retry.
    Mirrors the askmukthiguru NimService retry pattern for production reliability.
    """

    DEFAULT_BASE = "https://integrate.api.nvidia.com/v1"
    DEFAULT_MODEL = "meta/llama-3.1-70b-instruct"
    MAX_RETRIES = 3

    def __init__(self, api_key: str, model: str, base_url: str) -> None:
        self._key = api_key
        self._model = model or self.DEFAULT_MODEL
        self._base = (base_url or self.DEFAULT_BASE).rstrip("/")

    async def complete(self, system_message: str, user_message: str,
                       max_tokens: int = 800, temperature: float = 0.3) -> str:
        import asyncio
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._key}",
        }
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }
        last_exc: Exception | None = None
        for attempt in range(self.MAX_RETRIES):
            try:
                async with httpx.AsyncClient(timeout=180) as client:
                    resp = await client.post(
                        f"{self._base}/chat/completions",
                        json=payload,
                        headers=headers,
                    )
                    if resp.status_code == 429:
                        wait = 2 ** attempt  # 1s, 2s, 4s
                        logger.warning(
                            "NVIDIA NIM 429 rate-limit (attempt %d/%d); retrying in %ds",
                            attempt + 1, self.MAX_RETRIES, wait,
                        )
                        await asyncio.sleep(wait)
                        continue
                    resp.raise_for_status()
                content = resp.json()["choices"][0]["message"]["content"]
                if attempt > 0:
                    logger.info("NVIDIA NIM succeeded on attempt %d", attempt + 1)
                return content
            except httpx.HTTPStatusError as exc:
                logger.warning("NVIDIA NIM HTTP error attempt %d: %s", attempt + 1, exc)
                last_exc = exc
                if exc.response.status_code not in (429, 500, 502, 503) or attempt == self.MAX_RETRIES - 1:
                    raise
                await asyncio.sleep(2 ** attempt)
            except Exception as exc:
                logger.warning("NVIDIA NIM error attempt %d: %s", attempt + 1, exc)
                last_exc = exc
                if attempt == self.MAX_RETRIES - 1:
                    raise
                await asyncio.sleep(2 ** attempt)
        raise RuntimeError(f"NVIDIA NIM exhausted {self.MAX_RETRIES} retries") from last_exc

    def active_engine_label(self) -> str:
        return f"nvidia-nim/{self._model}"


class HermesProvider(LLMProvider):
    """Hermes agent endpoint — OpenAI-compatible, falls back to mock on error."""

    async def complete(self, system_message: str, user_message: str,
                       max_tokens: int = 800, temperature: float = 0.3) -> str:
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
                resp = await client.post(f"{base}/chat/completions",
                                         json=payload, headers=headers)
                resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
        except Exception as exc:  # noqa: BLE001
            logger.warning("hermes completion failed (%s)", exc)
            raise LLMNotConfiguredError(
                f"Hermes provider failed: {exc}"
            ) from exc

    def active_engine_label(self) -> str:
        return f"hermes-{hermes_config.HERMES_MODEL}"


class MockProvider(LLMProvider):
    """Used only when no LLM is configured. Always raises LLMNotConfiguredError
    so callers never receive fabricated AI data."""

    async def complete(self, system_message: str, user_message: str,
                       max_tokens: int = 800, temperature: float = 0.3) -> str:
        logger.warning("No LLM configured — raising LLMNotConfiguredError.")
        raise LLMNotConfiguredError(
            "No LLM provider is configured. Set LLM_PROVIDER and the matching "
            "API key or base URL. See .env.example for options."
        )

    def active_engine_label(self) -> str:
        return "unconfigured"


# ---------------------------------------------------------------------------
# Factory (Open/Closed — extend here, not inside callers)
# ---------------------------------------------------------------------------

def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


def _tier_model(var: str, tier: str, default: str) -> str:
    """Resolve a model for a named quality tier without silently changing installs.

    ``cheap`` and ``fast`` prefer their own deployment overrides. ``deep`` can
    use a dedicated override and otherwise falls back to the existing smart
    override. If no suffixed variable is present, the original unsuffixed model
    remains the fallback, preserving existing deployments exactly.
    """
    resolved = normalize_tier(tier)
    suffixes = {
        "cheap": ("CHEAP", "FAST"),
        "fast": ("FAST",),
        "smart": ("SMART",),
        "deep": ("DEEP", "SMART"),
        "hermes": (),
    }.get(resolved, ("FAST",))
    for suffix in suffixes:
        configured = _env(f"{var}_{suffix}")
        if configured:
            return configured
    return _env(var, default)


def build_provider(tier: str = "default") -> LLMProvider:
    """Return the configured provider for a named routing tier.

    Tier selection chooses a model override within the configured provider; it
    does not silently fail over to a different provider. ``hermes`` remains an
    explicit provider tier for scraping/agent runtimes.
    """
    tier = normalize_tier(tier)
    # Hermes tier — always honoured when available
    if tier == "hermes" and hermes_config.HERMES_AGENT_URL:
        return HermesProvider()

    provider_name = _env("LLM_PROVIDER").lower()

    if provider_name == "openrouter":
        key = _env("OPENROUTER_API_KEY") or _env("LLM_API_KEY")
        model = _tier_model("OPENROUTER_MODEL", tier, "openai/gpt-4o-mini")
        if key:
            return OpenRouterProvider(key, model)
        raise LLMNotConfiguredError("LLM_PROVIDER=openrouter requires OPENROUTER_API_KEY")

    if provider_name == "nvidia_nim":
        key = _env("NVIDIA_NIM_API_KEY") or _env("LLM_API_KEY")
        model = _tier_model("NVIDIA_NIM_MODEL", tier, "meta/llama-3.1-70b-instruct")
        base = _env("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1")
        if key:
            return NVIDIANIMProvider(key, model, base)
        raise LLMNotConfiguredError("LLM_PROVIDER=nvidia_nim requires NVIDIA_NIM_API_KEY")

    # Auto-detect NVIDIA NIM: if key is present and no explicit provider chosen, prefer NIM
    if provider_name in ("", "auto"):
        nim_key = _env("NVIDIA_NIM_API_KEY")
        if nim_key:
            nim_model = _tier_model("NVIDIA_NIM_MODEL", tier, "meta/llama-3.1-70b-instruct")
            nim_base = _env("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1")
            logger.info("Auto-detected NVIDIA NIM (NVIDIA_NIM_API_KEY set) → using NVIDIANIMProvider")
            return NVIDIANIMProvider(nim_key, nim_model, nim_base)

    if provider_name == "ollama":
        base = _env("LLM_BASE_URL")
        if not base:
            raise LLMNotConfiguredError("LLM_PROVIDER=ollama requires LLM_BASE_URL")
        if "ollama" not in base.lower() and "11434" not in base:
            raise LLMNotConfiguredError("LLM_PROVIDER=ollama requires an Ollama LLM_BASE_URL")
        return OllamaProvider(base, _tier_model("LLM_MODEL", tier, "llama3.1"))

    # Generic OpenAI-compatible (Groq, Together, local vLLM …). An explicit
    # provider label without an endpoint is not allowed to silently become a
    # MockProvider or another provider.
    if _env("LLM_BASE_URL"):
        return OpenAICompatibleProvider(
            _env("LLM_BASE_URL"),
            _env("LLM_API_KEY"),
            _tier_model("LLM_MODEL", tier, "default"),
        )

    if provider_name not in {"", "auto"}:
        raise LLMNotConfiguredError(
            f"LLM_PROVIDER={provider_name} requires LLM_BASE_URL or a supported provider credential"
        )

    return MockProvider()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def _hermes_active() -> bool:
    """Return True if HERMES_AGENT_URL is set and non-empty."""
    return bool(hermes_config.HERMES_AGENT_URL)


def active_engine() -> str:
    """Snapshot the default active engine label (for /health)."""
    if _hermes_active():
        return f"hermes-{hermes_config.HERMES_MODEL}"
    return build_provider().active_engine_label()


def routing_snapshot() -> dict[str, Any]:
    """Return safe, non-secret routing diagnostics for an authenticated UI.

    The snapshot reports configured provider/model labels and whether each named
    tier is available. API keys, endpoint URLs, prompts, and user data are never
    returned. A missing provider is represented as ``unconfigured`` rather than
    as a fabricated model capability.
    """
    provider_name = _env("LLM_PROVIDER").lower() or "auto"
    tiers: dict[str, dict[str, str | bool]] = {}
    for tier in SUPPORTED_TIERS:
        try:
            provider = build_provider(tier)
            tiers[tier] = {
                "available": not isinstance(provider, MockProvider),
                "engine": provider.active_engine_label(),
            }
        except Exception as exc:  # noqa: BLE001 - diagnostics must never break a request
            tiers[tier] = {
                "available": False,
                "engine": "unconfigured",
                "reason": str(exc)[:160] or exc.__class__.__name__,
            }
    return {
        "provider_mode": provider_name,
        "default_engine": active_engine(),
        "tiers": tiers,
        "fallback_policy": "explicit_only",
        "secrets_exposed": False,
    }


def is_llm_configured() -> bool:
    """True when a real LLM provider is configured (not the MockProvider)."""
    if _hermes_active():
        return True
    return not isinstance(build_provider(), MockProvider)


async def llm_complete(
    system_message: str,
    user_message: str,
    tier: str = "fast",
    session_id: Optional[str] = None,  # noqa: F841 — kept for backward compat
    max_tokens: int = 800,
    temperature: float = 0.3,
    # Privacy ledger context (optional — callers can pass these without breaking existing usage)
    _user_id: Optional[str] = None,
    _resource: Optional[str] = None,
) -> str:
    """Single-shot completion. tier: 'fast'/'smart' (same provider), 'hermes'.

    Raises:
        LLMNotConfiguredError: when the provider is not configured or the
            remote call fails permanently. Callers must catch this and
            return an appropriate HTTP error (503).
    """
    import asyncio
    try:
        provider = build_provider(tier)
    except Exception:
        metrics.record_provider_error("factory")
        raise

    provider_name = "unknown"
    try:
        provider_name = provider.active_engine_label()
    except Exception:
        pass
    # ponytail: single choke point — scrub only the outbound copy; callers keep
    # the original for truthfulness/guardrail checks, only scrubbed text leaves.
    user_message_out, scrubbed_user = _scrub_pii(user_message)
    system_message_out, scrubbed_system = _scrub_pii(system_message)
    scrubbed_fields = scrubbed_user + [f for f in scrubbed_system if f not in scrubbed_user]
    if scrubbed_fields:
        logger.info("PII scrubbed before LLM call: %s", ",".join(scrubbed_fields))
    start_time = time.perf_counter()
    try:
        result = await provider.complete(system_message_out, user_message_out,
                                         max_tokens=max_tokens, temperature=temperature)
        if not result:
            raise LLMNotConfiguredError("LLM provider returned an empty response.")
    except Exception:
        metrics.record_provider_error(provider_name)
        raise

    latency_ms = (time.perf_counter() - start_time) * 1000.0
    prompt_tokens = estimate_tokens(system_message_out) + estimate_tokens(user_message_out)
    completion_tokens = estimate_tokens(result)
    cost_usd = calculate_llm_cost(provider_name, prompt_tokens, completion_tokens)

    # Daily budget tracking & alerting (do not fail the request)
    try:
        total_spend, exceeded, limit = daily_cost_tracker.record_cost(cost_usd, _user_id)
        if exceeded:
            logger.warning(
                "Daily LLM cost budget exceeded for user=%s: accumulated $%.4f > limit $%.4f",
                _user_id, total_spend, limit,
            )
            metrics.record_cost_budget_exceeded()
    except Exception as exc:  # noqa: BLE001
        logger.debug("Daily budget tracking error (failing open): %s", exc)

    # Fail-open Langfuse observability trace
    try:
        trace_llm_call(
            trace_id=session_id or str(uuid.uuid4()),
            model=provider_name,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            latency_ms=latency_ms,
            cost_usd=cost_usd,
            artifact_id=session_id,
            metadata={
                "tier": tier,
                "user_id": _user_id,
                "resource": _resource or "llm_complete",
                "max_tokens": max_tokens,
                "temperature": temperature,
                "pii_scrubbed": scrubbed_fields,
            },
        )
    except Exception as exc:  # noqa: BLE001
        logger.debug("Langfuse trace call error (failing open): %s", exc)

    # Privacy ledger — fire-and-forget, non-blocking
    if _user_id:
        try:
            from app.services.privacy_ledger import ledger  # avoid circular at import time
            task = asyncio.create_task(ledger.record(
                user_id=_user_id,
                action="llm_inference",
                resource=_resource or "llm_complete",
                detail={"provider": provider.active_engine_label(), "tier": tier, "max_tokens": max_tokens},
            ))
            _background_tasks.add(task)
            task.add_done_callback(_background_tasks.discard)
        except Exception:
            pass  # ledger failure must never affect the LLM response

    return result



# ---------------------------------------------------------------------------
# JSON utilities
# ---------------------------------------------------------------------------

T = TypeVar("T", bound=BaseModel)


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
    # Truncated array recovery: e.g. [ {...}, {...}, {"index": 2 ...
    if "[" in text:
        start = text.find("[")
        last_obj_end = text.rfind("}")
        if last_obj_end > start:
            try:
                return json.loads(text[start:last_obj_end + 1] + "]")
            except json.JSONDecodeError:
                pass
    logger.error("Failed to parse JSON from LLM response: %s", text[:400])
    raise ValueError("LLM returned unparseable JSON")


async def llm_json(
    system_message: str,
    user_message: str,
    response_model: Optional[Type[T]] = None,
    tier: str = "fast",
    max_tokens: int = 1500,
    max_retries: int = 2,
    _user_id: Optional[str] = None,
    _resource: Optional[str] = None,
) -> T | dict | list:
    """Complete and parse LLM response into a Pydantic model T or JSON dict/list.

    Enforces Pydantic model validation (model_validate_json) with an automated
    self-correcting retry loop if parsing or schema validation fails.
    """
    # ponytail: no scrub here — llm_json delegates to llm_complete, the single
    # choke point, so user text is scrubbed once before leaving the process.
    schema_instruction = ""
    if response_model is not None:
        json_schema = json.dumps(response_model.model_json_schema(), indent=2)
        schema_instruction = (
            f"\n\nSTRICT JSON OUTPUT REQUIREMENT:\n"
            f"You MUST return a single JSON object strictly matching this Pydantic schema:\n"
            f"```json\n{json_schema}\n```\n"
            f"Do not include any prose, commentary, or markdown formatting outside the JSON."
        )

    sys_prompt = system_message + schema_instruction + (
        "\n\nIMPORTANT: Respond with ONLY a single valid raw JSON string. No markdown fences, no preface."
    )

    current_user_msg = user_message

    for attempt in range(max_retries + 1):
        raw_text = await llm_complete(
            sys_prompt,
            current_user_msg,
            tier=tier,
            max_tokens=max_tokens,
            _user_id=_user_id,
            _resource=_resource,
        )

        clean_text = raw_text.strip()
        if clean_text.startswith("```"):
            lines = clean_text.splitlines()
            if len(lines) >= 2 and lines[0].startswith("```"):
                clean_text = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])

        if response_model is not None:
            try:
                return response_model.model_validate_json(clean_text)
            except (ValidationError, ValueError, json.JSONDecodeError) as exc:
                logger.warning(
                    "Pydantic validation failed for %s (attempt %d/%d): %s",
                    response_model.__name__, attempt + 1, max_retries + 1, exc
                )
                if attempt == max_retries:
                    raise ValueError(f"LLM output failed Pydantic validation after {max_retries + 1} attempts: {exc}") from exc
                current_user_msg = (
                    f"{user_message}\n\n"
                    f"[SYSTEM CORRECTION]: Your previous JSON response failed validation for schema {response_model.__name__}.\n"
                    f"Validation error details:\n{exc}\n"
                    f"Please regenerate your response strictly adhering to the JSON schema."
                )
        else:
            try:
                return json.loads(clean_text)
            except json.JSONDecodeError as exc:
                if attempt == max_retries:
                    return extract_json(clean_text)
                current_user_msg = (
                    f"{user_message}\n\n"
                    f"[SYSTEM CORRECTION]: Your previous response was invalid JSON and could not be parsed.\n"
                    f"JSON error details: {exc}\n"
                    f"Please regenerate your response strictly formatted as valid JSON."
                )



# ---------------------------------------------------------------------------
# Task helpers (ported from archive, adapted to use llm_json above)
# ---------------------------------------------------------------------------

def _clip(text: str, n: int = 9000) -> str:
    text = text or ""
    return text if len(text) <= n else text[:n] + "\n...[truncated]"


# ---------------------------------------------------------------------------
# Prompt-injection defense: wrap untrusted user content with a delimiter
# ---------------------------------------------------------------------------

from app.services.prompt_safety import UNTRUSTED_DELIM as _UNTRUSTED_DELIM, UNTRUSTED_INSTRUCTION as _UNTRUSTED_INSTRUCTION, untrusted as _untrusted


async def interview_questions(profile_summary: str, application: dict, jd: str = "") -> dict:
    """Generate per-application interview intelligence (ported from archive llm_service.py)."""
    system = (
        "You are an interview intelligence engine. For a given company + role, surface the "
        "questions candidates most frequently report being asked (behavioral, technical, "
        "role-specific), grounded in the job description and the company's known interview style. "
        "Be specific and practical."
        + _UNTRUSTED_INSTRUCTION
    )
    user = f"""Generate the interview question intel for this application.

COMPANY: {application.get('company', '')}
ROLE: {application.get('title', '')}
JOB DESCRIPTION:
{_untrusted(_clip(jd or application.get('notes', ''), 3500))}
CANDIDATE PROFILE:
{_untrusted(_clip(profile_summary, 1500))}

Return JSON:
{{
  "company": "", "role": "",
  "commonly_asked": [{{"question": "", "category": "behavioral|technical|role|culture|system-design", "why_asked": "", "how_to_answer": ""}}],
  "recent_topics": ["<themes/skills currently emphasized for this role/company>"],
  "red_flags_to_avoid": ["<strings>"],
  "preparation_focus": ["<top areas to study>"],
  "source_note": "AI-generated from model knowledge + the job description."
}}"""
    return await llm_json(system, user)


async def summarize_saved_post(url: str, note: str = "", source: str = "") -> dict:
    """Categorize and summarize a saved web item for the Knowledge Hub."""
    system = (
        "You categorize and summarize a saved web item (LinkedIn/Medium/Substack/etc.) "
        "for a job seeker's personal knowledge hub. Infer intent from the URL and the user's "
        "note. If you cannot infer content, rely on the user's note."
        + _UNTRUSTED_INSTRUCTION
    )
    user = f"""Saved item:
URL: {url}
SOURCE: {source or 'unknown'}
USER NOTE:
{_untrusted(note or 'none')}

Return JSON:
{{
  "title": "<best-guess concise title>",
  "summary": "<1-2 sentence summary or 'Open the link for details' if unknown>",
  "tags": ["<short topical tags>"],
  "category": "interview-questions|career-advice|technical|company-research|networking|other",
  "is_interview_related": <true|false>
}}"""
    return await llm_json(system, user)


async def parse_application_email(email_text: str) -> dict:
    """Parse a recruiter email into structured Kanban tracking data."""
    system = (
        "You parse job-application related emails into structured tracking data. "
        "Map the email to the correct pipeline stage."
        + _UNTRUSTED_INSTRUCTION
    )
    stages = "saved, applied, phone_screen, interview, offer, rejected"
    user = f"""Parse this email. Stages: {stages}.

EMAIL:
{_untrusted(_clip(email_text, 6000))}

Return JSON:
{{
  "is_job_related": <true|false>,
  "company": "", "title": "", "location": "",
  "stage": "saved|applied|phone_screen|interview|offer|rejected",
  "interview_date": "<ISO 8601 or null>",
  "contact": "<recruiter/contact name or email or null>",
  "summary": "<1 sentence of what the email says>"
}}"""
    return await llm_json(system, user)


async def extract_profile_from_resume(resume_text: str) -> dict:
    """Extract structured profile data from resume text."""
    system = ("You extract structured profile data from a resume. Be accurate; use null/empty when unknown."
              + _UNTRUSTED_INSTRUCTION)
    user = f"""Extract a profile from this resume.

RESUME:
{_untrusted(_clip(resume_text))}

Return JSON:
{{
  "full_name": "", "headline": "", "location": "", "email": "", "phone": "",
  "current_role": "", "years_experience": <number or 0>,
  "skills": ["<strings>"], "target_roles": ["<likely next roles>"],
  "summary": "<2 sentence professional summary>"
}}"""
    return await llm_json(system, user)


def ats_compliance(text: str) -> dict:
    t = text or ""
    low = t.lower()
    SECTIONS = ["experience", "education", "skills", "summary", "projects", "certification", "work"]
    has_email = bool(re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", t))
    has_phone = bool(re.search(r"(\+?\d[\d\s().-]{7,}\d)", t))
    sections_found = sorted({s for s in SECTIONS if s in low})
    bullets = len(re.findall(r"(^|\n)\s*[-*\u2022\u00b7]", t))
    words = len(t.split())
    quantified = len(re.findall(r"\d+%|\$\s?\d|\b\d{2,}\b", t))
    has_tabs = "\t" in t
    checks = [
        {"label": "Contact email is parseable", "pass": has_email},
        {"label": "Phone number present", "pass": has_phone},
        {"label": "Has \u2265 3 standard sections", "pass": len(sections_found) >= 3},
        {"label": "Uses bullet points", "pass": bullets >= 3},
        {"label": "Length is ATS-friendly (250\u20131200 words)", "pass": 250 <= words <= 1200},
        {"label": "Quantified achievements present", "pass": quantified >= 3},
        {"label": "No tab/column artifacts", "pass": not has_tabs},
    ]
    passed = sum(1 for c in checks if c["pass"])
    return {
        "score": round(passed / len(checks) * 100),
        "passed": passed,
        "total": len(checks),
        "checks": checks,
        "sections_found": sections_found,
        "word_count": words,
        "bullet_count": bullets,
    }


async def analyze_resume(resume_text: str, jd: str, custom_instructions: str = "") -> dict:
    system = (
        "You are an expert technical recruiter and a 2026-era semantic ATS analyzer. "
        "Modern ATS use transformer embeddings and reward context, not bare keyword lists. "
        "Apply the hybrid methodology: Exact terms (for must-haves) + Semantic variants + Proof "
        "(measurable outcomes). Reward bullets that follow Problem -> Action -> Result. "
        "Be rigorous and honest; never inflate scores."
        + _UNTRUSTED_INSTRUCTION
    )
    user = f"""Analyze this resume against the job description using 2026 semantic-ATS best practices.

RESUME:
{_untrusted(_clip(resume_text))}

JOB DESCRIPTION:
{_untrusted(_clip(jd))}

USER CUSTOM INSTRUCTIONS (consider these):
{_untrusted(custom_instructions or 'none')}

Return JSON with this exact shape:
{{
  "overall_score": <int 0-100>,
  "section_scores": {{"skills_match": <int>, "experience_relevance": <int>, "education_fit": <int>, "formatting": <int>}},
  "matched_keywords": [<strings present in BOTH resume and JD>],
  "missing_keywords": [<important JD keywords missing from resume>],
  "keyword_buckets": {{
     "must_have": [{{"term": "<critical skill/cert/tool>", "present": <true|false>}}],
     "preferred": [{{"term": "<secondary skill>", "present": <true|false>}}],
     "soft": [{{"term": "<action verb/soft skill/domain term>", "present": <true|false>}}]
  }},
  "weak_bullets": [{{"original": "<a weak resume bullet>", "match": "direct|implied|none", "rewrite": "<Action + Tool/Method + Measurable Outcome + Scope>"}}],
  "formatting_checks": {{
     "single_column": <true|false>, "standard_headings": <true|false>,
     "acronyms_expanded": <true|false>, "no_tables_or_graphics": <true|false>,
     "notes": "<short formatting guidance>"
  }},
  "recommendations": [<specific, actionable improvements>],
  "ats_issues": [<formatting/parsing problems that hurt ATS>],
  "summary": "<2-3 sentence honest assessment>"
}}"""
    result = await llm_json(system, user)
    if isinstance(result, dict):
        result["ats_compliance"] = ats_compliance(resume_text)
    return result

