"""Langfuse LLM Observability Client with strict fail-open semantics.

This module provides lazy singleton client integration with Langfuse (https://langfuse.com).
Design principles:
- Fail-open: If keys are missing, invalid, or remote calls fail, all LLM calls continue
  uninterrupted with zero exceptions raised to callers.
- Optional SDK: Operates cleanly whether the official `langfuse` python package is installed
  or absent.
- Testing support: Retains a bounded ring buffer of recent trace snapshots for diagnostics
  and unit testing.
"""
from __future__ import annotations

import logging
import os
import sys
import time
import uuid
from typing import Any, Dict, List, Optional
from threading import RLock

logger = logging.getLogger("tayari.telemetry.langfuse")

try:
    from langfuse import Langfuse
except ImportError:
    Langfuse = None


class LangfuseTelemetryClient:
    """Thread-safe lazy singleton client for Langfuse tracing."""

    _instance: Optional["LangfuseTelemetryClient"] = None
    _lock = RLock()

    def __init__(self) -> None:
        self._sdk_client: Any = None
        self._public_key: str = ""
        self._secret_key: str = ""
        self._host: str = ""
        self._enabled: bool = False
        self._initialized: bool = False
        self._recent_traces: List[Dict[str, Any]] = []
        self._trace_lock = RLock()
        self._max_recent_traces = 200
        self._lock = RLock()

    @classmethod
    def get_instance(cls) -> "LangfuseTelemetryClient":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
                    cls._instance.initialize()
        return cls._instance

    def initialize(self) -> None:
        """Initialize client from environment variables (fail-open)."""
        with self._lock:
            self._public_key = os.getenv("LANGFUSE_PUBLIC_KEY", "").strip()
            self._secret_key = os.getenv("LANGFUSE_SECRET_KEY", "").strip()
            self._host = os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com").strip() or "https://cloud.langfuse.com"

            if self._public_key and self._secret_key:
                self._enabled = True
                if Langfuse is not None and os.getenv("ENV") not in ("test", "testing") and "pytest" not in sys.modules:
                    try:
                        self._sdk_client = Langfuse(
                            public_key=self._public_key,
                            secret_key=self._secret_key,
                            host=self._host,
                        )
                        logger.info("Langfuse SDK client initialized for host: %s", self._host)
                    except Exception as exc:  # noqa: BLE001
                        logger.warning("Failed to initialize Langfuse SDK (failing open): %s", exc)
                        self._sdk_client = None
                else:
                    logger.debug("Langfuse library not installed; operating in lightweight fail-open telemetry mode.")
            else:
                self._enabled = False
                self._sdk_client = None
                logger.debug("Langfuse keys not configured; LLM observability disabled (fail-open).")

            self._initialized = True

    @property
    def is_enabled(self) -> bool:
        if not self._initialized:
            self.initialize()
        return self._enabled

    def trace_llm_call(
        self,
        trace_id: Optional[str] = None,
        model: str = "",
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        latency_ms: float = 0.0,
        cost_usd: float = 0.0,
        artifact_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        prompt_id: Optional[str] = None,
        prompt_version: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Record an LLM execution trace.

        Guaranteed fail-open: catches all exceptions and never raises to the caller.
        """
        try:
            merged_metadata = dict(metadata or {})
            if prompt_id is not None:
                merged_metadata.setdefault("prompt_id", prompt_id)
            if prompt_version is not None:
                merged_metadata.setdefault("prompt_version", prompt_version)
        except Exception:
            merged_metadata = {}
        trace_record = {
            "trace_id": trace_id or str(uuid.uuid4()),
            "model": model,
            "prompt_tokens": max(0, int(prompt_tokens)),
            "completion_tokens": max(0, int(completion_tokens)),
            "total_tokens": max(0, int(prompt_tokens)) + max(0, int(completion_tokens)),
            "latency_ms": round(float(latency_ms), 2),
            "cost_usd": round(float(cost_usd), 6),
            "artifact_id": artifact_id,
            "prompt_id": prompt_id if prompt_id is not None else merged_metadata.get("prompt_id"),
            "prompt_version": prompt_version if prompt_version is not None else merged_metadata.get("prompt_version"),
            "metadata": merged_metadata,
            "timestamp": time.time(),
        }

        # Keep bounded in-memory buffer for diagnostics and test assertions
        with self._trace_lock:
            self._recent_traces.append(trace_record)
            if len(self._recent_traces) > self._max_recent_traces:
                self._recent_traces.pop(0)

        # Fail-open check: if keys are missing or disabled, stop here safely
        if not self.is_enabled:
            return trace_record

        try:
            if self._sdk_client is not None:
                # Use official Langfuse SDK
                trace_name = merged_metadata.get("action") or merged_metadata.get("task") or "llm_call"
                trace = self._sdk_client.trace(
                    id=trace_record["trace_id"],
                    name=trace_name,
                    session_id=artifact_id,
                    metadata=merged_metadata,
                )
                trace.generation(
                    name="completion",
                    model=model,
                    usage={
                        "prompt_tokens": trace_record["prompt_tokens"],
                        "completion_tokens": trace_record["completion_tokens"],
                        "total_tokens": trace_record["total_tokens"],
                    },
                    cost_details={"total": trace_record["cost_usd"]},
                    metadata={
                        **merged_metadata,
                        "latency_ms": trace_record["latency_ms"],
                    },
                )
            else:
                # Langfuse SDK not installed, but keys configured: fail-open gracefully
                logger.debug(
                    "Langfuse keys provided without SDK; trace recorded in memory (fail-open): %s",
                    trace_record["trace_id"],
                )
        except Exception as exc:  # noqa: BLE001 - fail-open invariant
            logger.warning("Langfuse trace emission encountered an error (failing open): %s", exc)

        return trace_record

    def flush(self) -> None:
        """Flush SDK buffer if active."""
        if self._sdk_client is not None:
            try:
                self._sdk_client.flush()
            except Exception as exc:  # noqa: BLE001
                logger.debug("Langfuse flush warning: %s", exc)

    def get_recent_traces(self) -> List[Dict[str, Any]]:
        with self._trace_lock:
            return list(self._recent_traces)

    def reset(self) -> None:
        """Reset state for tests."""
        with self._lock:
            self._sdk_client = None
            self._public_key = ""
            self._secret_key = ""
            self._host = ""
            self._enabled = False
            self._initialized = False
        with self._trace_lock:
            self._recent_traces.clear()


def get_langfuse_client() -> LangfuseTelemetryClient:
    """Get singleton LangfuseTelemetryClient instance."""
    return LangfuseTelemetryClient.get_instance()


def trace_llm_call(
    trace_id: Optional[str] = None,
    model: str = "",
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    latency_ms: float = 0.0,
    cost_usd: float = 0.0,
    artifact_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    prompt_id: Optional[str] = None,
    prompt_version: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Module-level fail-open wrapper to trace an LLM call."""
    try:
        return get_langfuse_client().trace_llm_call(
            trace_id=trace_id,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            latency_ms=latency_ms,
            cost_usd=cost_usd,
            artifact_id=artifact_id,
            metadata=metadata,
            prompt_id=prompt_id,
            prompt_version=prompt_version,
        )
    except Exception as exc:  # noqa: BLE001 - fail-open invariant
        logger.warning("Langfuse trace wrapper error (failing open): %s", exc)
        return None


__all__ = [
    "LangfuseTelemetryClient",
    "get_langfuse_client",
    "trace_llm_call",
]
