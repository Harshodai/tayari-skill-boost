"""Governed external research providers for public job/company intelligence.

This module deliberately keeps provider access behind a narrow typed interface. It
never accepts arbitrary provider URLs or Actor IDs from callers, never exposes
provider credentials in results, and returns only bounded, sanitized records.
"""
from __future__ import annotations

import asyncio
import ipaddress
import os
import random
import time
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Literal
from urllib.parse import urlparse

import httpx
from pydantic import BaseModel, Field


ProviderName = Literal["firecrawl", "apify"]


class ResearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=500)
    provider: ProviderName = "firecrawl"
    limit: int = Field(default=10, ge=1, le=20)


class ResearchItem(BaseModel):
    title: str = Field(default="", max_length=500)
    url: str = Field(default="", max_length=2000)
    description: str = Field(default="", max_length=4000)
    source: str = Field(default="", max_length=40)


class ResearchResponse(BaseModel):
    provider: ProviderName
    query: str
    items: list[ResearchItem]
    result_count: int
    truncated: bool = False
    provenance: dict[str, Any] | None = None


class ProviderNotConfigured(RuntimeError):
    """Raised when a provider is not explicitly configured for this deployment."""


class ProviderRejected(RuntimeError):
    """Raised when provider policy rejects an operation or result."""


@dataclass(frozen=True)
class ResearchContext:
    subject: str
    tenant_id: str | None
    request_id: str | None


@dataclass(frozen=True)
class ApifyRunState:
    run_id: str
    status: str
    dataset_id: str | None = None
    error_message: str | None = None


def _public_web_url(value: str) -> bool:
    """Allow only public HTTP(S) URLs in provider-returned source records."""
    try:
        parsed = urlparse(value)
    except ValueError:
        return False
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return False
    host = parsed.hostname.rstrip(".").lower()
    if host in {"localhost", "localhost.localdomain"} or host.endswith((".local", ".internal")):
        return False
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return True
    return not (
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_reserved
        or address.is_multicast
        or address.is_unspecified
    )


def _bounded_text(value: Any, maximum: int) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip()[:maximum]


def _bounded_int_env(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        value = default
    return max(minimum, min(value, maximum))


def _bounded_float_env(name: str, default: float, minimum: float, maximum: float) -> float:
    try:
        value = float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        value = default
    return max(minimum, min(value, maximum))


def _safe_item(raw: Any, source: str) -> ResearchItem | None:
    if not isinstance(raw, dict):
        return None
    url = _bounded_text(raw.get("url") or raw.get("link") or raw.get("sourceURL"), 2000)
    if url and not _public_web_url(url):
        url = ""
    return ResearchItem(
        title=_bounded_text(raw.get("title") or raw.get("name"), 500),
        url=url,
        description=_bounded_text(raw.get("description") or raw.get("markdown") or raw.get("text"), 4000),
        source=source,
    )


class ExternalResearchProvider:
    name: ProviderName

    async def search(self, request: ResearchRequest, context: ResearchContext) -> ResearchResponse:
        raise NotImplementedError


class FirecrawlResearchProvider(ExternalResearchProvider):
    name: ProviderName = "firecrawl"

    def __init__(self, client: httpx.AsyncClient | None = None):
        self.api_key = os.getenv("FIRECRAWL_API_KEY", "").strip()
        self.base_url = os.getenv("FIRECRAWL_API_BASE_URL", "https://api.firecrawl.dev/v1").rstrip("/")
        self._client = client

    async def search(self, request: ResearchRequest, context: ResearchContext) -> ResearchResponse:
        if not self.api_key:
            raise ProviderNotConfigured("FIRECRAWL_API_KEY is required")
        if not self.base_url.startswith("https://api.firecrawl.dev/"):
            raise ProviderRejected("Firecrawl base URL is not an approved hosted endpoint")
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=httpx.Timeout(15.0, connect=5.0))
        try:
            response = await client.post(
                f"{self.base_url}/search",
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                json={"query": request.query, "limit": request.limit},
            )
            response.raise_for_status()
            payload = response.json()
        except httpx.HTTPStatusError as exc:
            raise ProviderRejected(f"Firecrawl request rejected with HTTP {exc.response.status_code}") from exc
        except (httpx.HTTPError, ValueError) as exc:
            raise ProviderRejected("Firecrawl request failed") from exc
        finally:
            if owns_client:
                await client.aclose()
        raw_items = payload.get("data", payload) if isinstance(payload, dict) else []
        if isinstance(raw_items, dict):
            raw_items = raw_items.get("web", raw_items.get("results", []))
        source_items = raw_items if isinstance(raw_items, list) else []
        items = [item for item in (_safe_item(raw, "firecrawl") for raw in source_items) if item]
        return ResearchResponse(provider=self.name, query=request.query, items=items[: request.limit], result_count=len(items), truncated=len(items) > request.limit)


class ApifyResearchProvider(ExternalResearchProvider):
    name: ProviderName = "apify"
    _terminal_statuses = frozenset({"SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"})
    _active_statuses = frozenset({"READY", "RUNNING", "ABORTING"})

    def __init__(self, client: httpx.AsyncClient | None = None):
        self.api_token = os.getenv("APIFY_API_TOKEN", "").strip()
        self.base_url = os.getenv("APIFY_API_BASE_URL", "https://api.apify.com/v2").rstrip("/")
        self.allowed_actors = frozenset(filter(None, (value.strip() for value in os.getenv("APIFY_ALLOWED_ACTORS", "").split(","))))
        self.actor_id = os.getenv("APIFY_RESEARCH_ACTOR_ID", "").strip()
        self.max_attempts = _bounded_int_env("APIFY_HTTP_MAX_ATTEMPTS", 3, 1, 5)
        self.poll_deadline = _bounded_float_env("APIFY_RUN_DEADLINE_SECONDS", 120.0, 1.0, 900.0)
        self.poll_interval = _bounded_float_env("APIFY_POLL_INTERVAL_SECONDS", 1.0, 0.1, 30.0)
        self.max_poll_interval = max(self.poll_interval, _bounded_float_env("APIFY_MAX_POLL_INTERVAL_SECONDS", 10.0, 0.1, 60.0))
        self._client = client

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.api_token}", "Content-Type": "application/json"}

    async def _request_json(self, client: httpx.AsyncClient, method: str, path: str, *, params: dict[str, int] | None = None, body: dict[str, Any] | None = None) -> Any:
        """Call Apify with bounded retries and Retry-After-aware backoff."""
        for attempt in range(self.max_attempts):
            try:
                response = await client.request(method, f"{self.base_url}{path}", headers=self._headers(), params=params, json=body)
            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                if attempt + 1 >= self.max_attempts:
                    raise ProviderRejected("Apify request failed after bounded retries") from exc
                await asyncio.sleep(self._backoff(attempt, None))
                continue
            if response.status_code == 429 or 500 <= response.status_code <= 599:
                if attempt + 1 < self.max_attempts:
                    await asyncio.sleep(self._backoff(attempt, response.headers.get("Retry-After")))
                    continue
            try:
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as exc:
                raise ProviderRejected(f"Apify request rejected with HTTP {exc.response.status_code}") from exc
            except ValueError as exc:
                raise ProviderRejected("Apify returned malformed JSON") from exc
        raise ProviderRejected("Apify request failed")

    def _backoff(self, attempt: int, retry_after: str | None) -> float:
        if retry_after:
            try:
                return max(0.0, min(float(retry_after), 60.0))
            except ValueError:
                pass
        return min(30.0, (2**attempt) + random.uniform(0.0, 0.25))

    @staticmethod
    def _run_state(payload: Any, fallback_run_id: str) -> ApifyRunState:
        data = payload.get("data", payload) if isinstance(payload, dict) else {}
        if not isinstance(data, dict):
            raise ProviderRejected("Apify returned an invalid run payload")
        run_id = _bounded_text(data.get("id") or fallback_run_id, 200)
        status = _bounded_text(data.get("status"), 40).upper()
        dataset_id = _bounded_text(data.get("defaultDatasetId") or data.get("default_dataset_id"), 200) or None
        error = _bounded_text(data.get("errorMessage") or data.get("error"), 1000) or None
        if not run_id or not status:
            raise ProviderRejected("Apify returned an incomplete run payload")
        return ApifyRunState(run_id=run_id, status=status, dataset_id=dataset_id, error_message=error)

    async def start_run(self, client: httpx.AsyncClient, request: ResearchRequest) -> ApifyRunState:
        payload = await self._request_json(client, "POST", f"/actors/{self.actor_id}/runs", body={"query": request.query, "limit": request.limit})
        data = payload.get("data", payload) if isinstance(payload, dict) else {}
        if not isinstance(data, dict):
            raise ProviderRejected("Apify returned an invalid run acknowledgement")
        run_id = _bounded_text(data.get("id"), 200)
        dataset_id = _bounded_text(data.get("defaultDatasetId") or data.get("default_dataset_id"), 200) or None
        if not run_id:
            raise ProviderRejected("Apify did not return a run ID")
        return ApifyRunState(run_id=run_id, status="READY", dataset_id=dataset_id)

    async def get_run(self, client: httpx.AsyncClient, run_id: str) -> ApifyRunState:
        payload = await self._request_json(client, "GET", f"/actor-runs/{run_id}")
        return self._run_state(payload, run_id)

    async def poll_run(self, client: httpx.AsyncClient, run_id: str) -> ApifyRunState:
        deadline = time.monotonic() + self.poll_deadline
        delay = self.poll_interval
        while True:
            state = await self.get_run(client, run_id)
            if state.status in self._terminal_statuses:
                return state
            if state.status not in self._active_statuses:
                raise ProviderRejected(f"Apify returned unknown run status: {state.status}")
            if time.monotonic() + delay > deadline:
                raise ProviderRejected("Apify run timed out before reaching a terminal state")
            await asyncio.sleep(delay)
            delay = min(self.max_poll_interval, delay * 2)

    async def fetch_dataset_items(self, client: httpx.AsyncClient, dataset_id: str, limit: int) -> tuple[list[ResearchItem], bool]:
        items: list[ResearchItem] = []
        offset = 0
        page_size = min(100, limit + 1)
        while len(items) < page_size:
            request_limit = page_size - len(items)
            payload = await self._request_json(client, "GET", f"/datasets/{dataset_id}/items", params={"offset": offset, "limit": request_limit})
            if isinstance(payload, list):
                raw_items = payload
            elif isinstance(payload, dict):
                data = payload.get("data", payload)
                raw_items = data.get("items", data.get("results", [])) if isinstance(data, dict) else []
            else:
                raw_items = []
            if not isinstance(raw_items, list) or not raw_items:
                break
            for raw in raw_items:
                safe = _safe_item(raw, "apify")
                if safe:
                    items.append(safe)
                    if len(items) >= page_size:
                        break
            if len(raw_items) < request_limit:
                break
            offset += len(raw_items)
        truncated = len(items) > limit
        return items[:limit], truncated

    async def abort_run(self, client: httpx.AsyncClient, run_id: str) -> None:
        try:
            await self._request_json(client, "POST", f"/actor-runs/{run_id}/abort")
        except ProviderRejected:
            # Cancellation is best effort; the durable job still records timeout/cancelled.
            return

    async def search(self, request: ResearchRequest, context: ResearchContext, *, on_run_started: Callable[[str], Awaitable[None]] | None = None) -> ResearchResponse:
        if not self.api_token or not self.actor_id:
            raise ProviderNotConfigured("APIFY_API_TOKEN and APIFY_RESEARCH_ACTOR_ID are required")
        if self.actor_id not in self.allowed_actors:
            raise ProviderRejected("Apify research Actor is not allowlisted")
        if self.base_url != "https://api.apify.com/v2":
            raise ProviderRejected("Apify base URL is not an approved hosted endpoint")
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=5.0))
        try:
            started = await self.start_run(client, request)
            if on_run_started is not None:
                await on_run_started(started.run_id)
            state = await self.poll_run(client, started.run_id)
            if state.status != "SUCCEEDED":
                detail = f": {state.error_message}" if state.error_message else ""
                raise ProviderRejected(f"Apify run ended with {state.status}{detail}")
            dataset_id = state.dataset_id or started.dataset_id
            if not dataset_id:
                raise ProviderRejected("Apify succeeded without a default dataset ID")
            items, truncated = await self.fetch_dataset_items(client, dataset_id, request.limit)
            return ResearchResponse(provider=self.name, query=request.query, items=items, result_count=len(items), truncated=truncated)
        finally:
            if owns_client:
                await client.aclose()


def provider_for(name: ProviderName, client: httpx.AsyncClient | None = None) -> ExternalResearchProvider:
    if name == "firecrawl":
        return FirecrawlResearchProvider(client)
    return ApifyResearchProvider(client)
