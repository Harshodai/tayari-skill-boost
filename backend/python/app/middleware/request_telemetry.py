"""Structured request telemetry for the Python AI engine."""
from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.telemetry import metrics

logger = logging.getLogger("tayari.http")


def _trace_id(request: Request) -> str:
    supplied = request.headers.get("X-Request-ID", "").strip()
    if supplied and len(supplied) <= 128 and not any(char in supplied for char in "\r\n"):
        return supplied
    return str(uuid.uuid4())


def _route_for_metrics(request: Request) -> str:
    route = request.scope.get("route")
    route_path = getattr(route, "path", None)
    if route_path:
        return str(route_path)
    path = request.url.path
    return path if path in {"/health", "/healthz", "/readyz", "/metrics"} else "unmatched"


class RequestTelemetryMiddleware(BaseHTTPMiddleware):
    """Emit one JSON event per request and echo a correlation identifier."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        started = time.perf_counter()
        trace_id = _trace_id(request)
        request.state.trace_id = trace_id
        response: Response | None = None
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            return response
        except Exception:
            logger.exception("request_failed", extra={"trace_id": trace_id})
            raise
        finally:
            duration_ms = round((time.perf_counter() - started) * 1000, 3)
            metrics.observe_request(status=status)
            event = {
                "event": "http_request",
                "trace_id": trace_id,
                "method": request.method,
                "path": request.url.path,
                "status": status,
                "duration_ms": duration_ms,
                "user_id": request.headers.get("X-User-Id", "anonymous") or "anonymous",
                "route": _route_for_metrics(request),
            }
            logger.info(json.dumps(event, sort_keys=True, separators=(",", ":")))
            if response is not None:
                response.headers["X-Request-ID"] = trace_id


__all__ = ["RequestTelemetryMiddleware"]
