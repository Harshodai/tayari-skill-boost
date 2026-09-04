"""Process-local operational counters exposed through the protected metrics route.

The registry intentionally keeps labels bounded and uses a lock so it is safe
for FastAPI's worker threads and Celery signal callbacks. Production instances
are scraped independently; aggregate them in the monitoring system.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from threading import Lock
from typing import Any


class MetricsRegistry:
    def __init__(self) -> None:
        self._lock = Lock()
        self._counters: dict[str, int] = defaultdict(int)
        self._provider_errors: dict[str, int] = defaultdict(int)
        self._queue_age_seconds = 0.0
        self._queue_age_updated_at: str | None = None

    def increment(self, name: str, amount: int = 1) -> int:
        if amount < 0:
            raise ValueError("counter increments must be non-negative")
        with self._lock:
            self._counters[name] += amount
            return self._counters[name]

    def observe_request(self, status: int) -> None:
        with self._lock:
            self._counters["requests_total"] += 1
            if status >= 500:
                self._counters["request_errors_total"] += 1

    def record_provider_error(self, provider: str) -> int:
        provider = str(provider or "unknown").strip()[:96] or "unknown"
        with self._lock:
            self._counters["llm_errors_total"] += 1
            self._provider_errors[provider] += 1
            return self._counters["llm_errors_total"]

    def record_cost_budget_exceeded(self) -> int:
        with self._lock:
            self._counters["llm_cost_budget_exceeded_total"] += 1
            self._counters["llm_daily_cost_budget_exceeded_total"] += 1
            return self._counters["llm_daily_cost_budget_exceeded_total"]

    def record_queue_age(self, age_seconds: float) -> None:
        with self._lock:
            self._queue_age_seconds = max(0.0, float(age_seconds))
            self._queue_age_updated_at = datetime.now(timezone.utc).isoformat()

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            counters = dict(self._counters)
            providers = dict(self._provider_errors)
            return {
                "service": "python-ai-engine",
                "counters": counters,
                "provider_errors_by_name": providers,
                "queue_age_seconds": self._queue_age_seconds,
                "queue_age_updated_at": self._queue_age_updated_at,
            }

    def reset(self) -> None:
        """Reset state for isolated proof tests and local development."""
        with self._lock:
            self._counters.clear()
            self._provider_errors.clear()
            self._queue_age_seconds = 0.0
            self._queue_age_updated_at = None


metrics = MetricsRegistry()

__all__ = ["MetricsRegistry", "metrics"]
