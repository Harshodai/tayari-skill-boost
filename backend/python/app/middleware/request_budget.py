"""Request-level resource budgets for the Python AI service."""
from __future__ import annotations

import json
import os
from typing import Awaitable, Callable


class RequestBodyTooLarge(Exception):
    """Internal sentinel used to stop reading an oversized chunked body."""


class RequestBudgetMiddleware:
    """Reject request bodies above a bounded cap before expensive parsing."""

    def __init__(self, app, max_body_bytes: int | None = None):
        self.app = app
        configured = max_body_bytes or int(os.getenv("MAX_REQUEST_BODY_BYTES", str(12 * 1024 * 1024)))
        self.max_body_bytes = max(1, min(configured, 20 * 1024 * 1024))

    @staticmethod
    async def _reject(send: Callable[[dict], Awaitable[None]], limit: int) -> None:
        payload = json.dumps({"detail": "request body exceeds size limit"}).encode("utf-8")
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(payload)).encode("ascii")),
                    (b"x-request-body-limit", str(limit).encode("ascii")),
                ],
            }
        )
        await send({"type": "http.response.body", "body": payload})

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        content_length = None
        for key, value in scope.get("headers", []):
            if key.lower() == b"content-length":
                try:
                    content_length = int(value)
                except (TypeError, ValueError):
                    content_length = None
                break

        if content_length is not None and content_length > self.max_body_bytes:
            await self._reject(send, self.max_body_bytes)
            return

        total = 0
        response_started = False

        async def limited_receive():
            nonlocal total
            message = await receive()
            if message.get("type") == "http.request":
                total += len(message.get("body") or b"")
                if total > self.max_body_bytes:
                    raise RequestBodyTooLarge
            return message

        async def tracked_send(message):
            nonlocal response_started
            if message.get("type") == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracked_send)
        except RequestBodyTooLarge:
            # Body parsing happens before handlers in the FastAPI routes. If a
            # custom downstream app emitted a response before consuming the
            # body, the connection is closed rather than appending a second
            # response; normal FastAPI requests receive a clean 413.
            if not response_started:
                await self._reject(send, self.max_body_bytes)
