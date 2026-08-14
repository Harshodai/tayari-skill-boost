"""Protect the Python AI engine from direct production access.

The Go gateway is the only public API boundary. In production every request
except a minimal health probe must carry the shared service token that the Go
AI client injects. User identity remains a separate X-User-Id header and is
never used as the service authentication secret.
"""

from __future__ import annotations

import hmac
import os
from typing import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


class InternalGatewayMiddleware(BaseHTTPMiddleware):
    """Require the Go-to-Python service token in production."""

    _health_paths = frozenset({"/health", "/api/health", "/api/v1/health", "/healthz", "/readyz", "/metrics"})

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        environment = os.getenv("ENV", "development").lower()
        if environment != "production" or request.url.path in self._health_paths:
            return await call_next(request)

        expected = os.getenv("AI_INTERNAL_TOKEN", "")
        provided = request.headers.get("X-Internal-Token", "")
        if not expected:
            return JSONResponse(
                status_code=503,
                content={"detail": "AI service internal authentication is not configured"},
            )
        if not provided or not hmac.compare_digest(provided, expected):
            return JSONResponse(status_code=401, content={"detail": "Internal gateway authentication required"})

        return await call_next(request)
