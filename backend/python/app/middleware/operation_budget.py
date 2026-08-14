"""Small, bounded operation quotas for expensive AI service routes."""
from __future__ import annotations

import asyncio
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import Callable

from starlette.responses import JSONResponse


@dataclass(frozen=True)
class BudgetRule:
    limit: int
    window_seconds: int


DEFAULT_RULES = {
    "public_ats_scan": BudgetRule(30, 60),
    "job_import": BudgetRule(20, 60),
    "ai_generation": BudgetRule(20, 60),
    "browser_automation": BudgetRule(4, 60),
    "autopilot_start": BudgetRule(2, 3600),
}


class OperationBudget:
    """Process-local bounded counter used when no shared quota backend exists."""

    def __init__(self, rules: dict[str, BudgetRule] | None = None, max_keys: int = 10_000):
        self.rules = rules or DEFAULT_RULES
        self.max_keys = max(100, max_keys)
        self._events: OrderedDict[tuple[str, str], list[float]] = OrderedDict()
        self._lock = asyncio.Lock()

    async def consume(self, operation: str, identity: str, now: float | None = None) -> bool:
        rule = self.rules.get(operation)
        if rule is None:
            return True
        current = now if now is not None else time.monotonic()
        key = (operation, identity)
        async with self._lock:
            events = self._events.setdefault(key, [])
            cutoff = current - rule.window_seconds
            events[:] = [stamp for stamp in events if stamp > cutoff]
            if len(events) >= rule.limit:
                self._events.move_to_end(key)
                return False
            events.append(current)
            self._events.move_to_end(key)
            while len(self._events) > self.max_keys:
                self._events.popitem(last=False)
            return True


class OperationBudgetMiddleware:
    """Apply operation quotas before route parsing and expensive work."""

    _health_paths = frozenset({"/health", "/api/health", "/api/v1/health", "/healthz", "/readyz"})

    def __init__(self, app, budget: OperationBudget | None = None):
        self.app = app
        self.budget = budget or OperationBudget()

    @staticmethod
    def _operation(path: str) -> str | None:
        if path == "/api/v1/ats/score":
            return "public_ats_scan"
        if path.endswith("/job-descriptions/import"):
            return "job_import"
        if "/browser/automation" in path:
            return "browser_automation"
        if path.endswith("/autopilot/run"):
            return "autopilot_start"
        if path.startswith("/api/v1/") and any(
            marker in path
            for marker in (
                "/strategic/",
                "/optimizer/",
                "/cover-letter/",
                "/communication/",
                "/interview/",
                "/one-shot/",
                "/resume",
                "/export/",
            )
        ):
            return "ai_generation"
        return None

    @staticmethod
    def _identity(scope) -> str:
        headers = {key.lower(): value for key, value in scope.get("headers", [])}
        user_id = headers.get(b"x-user-id", b"").decode("utf-8", "ignore").strip()
        client = scope.get("client") or ("unknown", 0)
        ip = str(client[0])
        return f"user:{user_id}:ip:{ip}" if user_id else f"anon:ip:{ip}"

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http" or scope.get("path") in self._health_paths:
            await self.app(scope, receive, send)
            return
        operation = self._operation(scope.get("path", ""))
        if operation is None:
            await self.app(scope, receive, send)
            return
        allowed = await self.budget.consume(operation, self._identity(scope))
        if not allowed:
            response = JSONResponse(
                {"detail": f"{operation} quota exceeded"},
                status_code=429,
                headers={"Retry-After": str(self.budget.rules[operation].window_seconds)},
            )
            await response(scope, receive, send)
            return
        await self.app(scope, receive, send)
