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


class FirecrawlCrawlRequest(BaseModel):
    url: str = Field(min_length=8, max_length=2000)
    limit: int = Field(default=10, ge=1, le=50)


class FirecrawlBatchScrapeRequest(BaseModel):
    urls: list[str] = Field(min_length=1, max_length=20)
    limit: int = Field(default=20, ge=1, le=100)


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


@dataclass(frozen=True)
class FirecrawlJobState:
    job_id: str
    status: str
    documents: list[Any]
    next_url: str | None = None
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
    _terminal_statuses = frozenset({"COMPLETED", "SUCCEEDED", "FAILED", "CANCELLED", "ABORTED"})
    _active_statuses = frozenset({"QUEUED", "SCRAPING", "CRAWLING", "RUNNING", "PENDING"})

    def __init__(self, client: httpx.AsyncClient | None = None):
        self.api_key = os.getenv("FIRECRAWL_API_KEY", "").strip()
        self.base_url = os.getenv("FIRECRAWL_API_BASE_URL", "https://api.firecrawl.dev/v1").rstrip("/")
        self.max_attempts = _bounded_int_env("FIRECRAWL_HTTP_MAX_ATTEMPTS", 3, 1, 5)
        self.poll_deadline = _bounded_float_env("FIRECRAWL_JOB_DEADLINE_SECONDS", 180.0, 1.0, 900.0)
        self.poll_interval = _bounded_float_env("FIRECRAWL_POLL_INTERVAL_SECONDS", 1.0, 0.1, 30.0)
        self.max_poll_interval = max(self.poll_interval, _bounded_float_env("FIRECRAWL_MAX_POLL_INTERVAL_SECONDS", 10.0, 0.1, 60.0))
        self._client = client

    def _validate_config(self) -> None:
        if not self.api_key:
            raise ProviderNotConfigured("FIRECRAWL_API_KEY is required")
        if not self.base_url.startswith("https://api.firecrawl.dev/"):
            raise ProviderRejected("Firecrawl base URL is not an approved hosted endpoint")

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

    async def _request_json(self, client: httpx.AsyncClient, method: str, path: str, *, body: dict[str, Any] | None = None, params: dict[str, Any] | None = None) -> Any:
        for attempt in range(self.max_attempts):
            try:
                response = await client.request(method, f"{self.base_url}{path}", headers=self._headers(), json=body, params=params)
            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                if attempt + 1 >= self.max_attempts:
                    raise ProviderRejected("Firecrawl request failed after bounded retries") from exc
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
                raise ProviderRejected(f"Firecrawl request rejected with HTTP {exc.response.status_code}") from exc
            except ValueError as exc:
                raise ProviderRejected("Firecrawl returned malformed JSON") from exc
        raise ProviderRejected("Firecrawl request failed")

    @staticmethod
    def _backoff(attempt: int, retry_after: str | None) -> float:
        if retry_after:
            try:
                return max(0.0, min(float(retry_after), 60.0))
            except ValueError:
                pass
        return min(30.0, (2**attempt) + random.uniform(0.0, 0.25))

    @staticmethod
    def _documents(payload: Any) -> tuple[list[Any], str | None]:
        data = payload.get("data", payload) if isinstance(payload, dict) else payload
        if isinstance(data, dict):
            documents = data.get("documents", data.get("results", data.get("web", [])))
            next_url = data.get("next") or data.get("nextUrl") or data.get("next_url")
        else:
            documents, next_url = data, None
        return (documents if isinstance(documents, list) else []), (str(next_url) if next_url else None)

    @classmethod
    def _job_state(cls, payload: Any, fallback_id: str) -> FirecrawlJobState:
        outer = payload if isinstance(payload, dict) else {}
        nested = outer.get("data")
        data = nested if isinstance(nested, dict) else outer
        if not isinstance(data, dict):
            raise ProviderRejected("Firecrawl returned an invalid job payload")
        job_id = _bounded_text(outer.get("id") or outer.get("jobId") or data.get("id") or data.get("jobId") or fallback_id, 200)
        status = _bounded_text(outer.get("status") or data.get("status") or ("COMPLETED" if nested else ""), 40).upper()
        documents, next_url = cls._documents(payload)
        error = _bounded_text(outer.get("error") or outer.get("errorMessage") or data.get("error") or data.get("errorMessage"), 1000) or None
        if not job_id:
            raise ProviderRejected("Firecrawl did not return a job ID")
        return FirecrawlJobState(job_id=job_id, status=status or "QUEUED", documents=documents, next_url=next_url, error_message=error)

    async def search(self, request: ResearchRequest, context: ResearchContext) -> ResearchResponse:
        self._validate_config()
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=httpx.Timeout(15.0, connect=5.0))
        try:
            payload = await self._request_json(client, "POST", "/search", body={"query": request.query, "limit": request.limit})
        finally:
            if owns_client:
                await client.aclose()
        raw_items, _ = self._documents(payload)
        items = [item for item in (_safe_item(raw, "firecrawl") for raw in raw_items) if item]
        return ResearchResponse(provider=self.name, query=request.query, items=items[: request.limit], result_count=len(items), truncated=len(items) > request.limit)

    async def start_crawl(self, client: httpx.AsyncClient, request: FirecrawlCrawlRequest) -> FirecrawlJobState:
        if not _public_web_url(request.url):
            raise ProviderRejected("Firecrawl crawl URL must be public HTTP(S)")
        payload = await self._request_json(client, "POST", "/crawl", body={"url": request.url, "limit": request.limit, "scrapeOptions": {"formats": ["markdown"]}})
        return self._job_state(payload, "")

    async def start_batch_scrape(self, client: httpx.AsyncClient, request: FirecrawlBatchScrapeRequest) -> FirecrawlJobState:
        urls = [_bounded_text(url, 2000) for url in request.urls if _public_web_url(url)]
        if not urls or len(urls) != len(request.urls):
            raise ProviderRejected("Firecrawl batch URLs must all be public HTTP(S)")
        payload = await self._request_json(client, "POST", "/batch/scrape", body={"urls": urls, "scrapeOptions": {"formats": ["markdown"]}})
        return self._job_state(payload, "")

    async def poll_job(self, client: httpx.AsyncClient, job_id: str, operation: Literal["crawl", "batch"]) -> FirecrawlJobState:
        deadline = time.monotonic() + self.poll_deadline
        delay = self.poll_interval
        path = f"/crawl/{job_id}" if operation == "crawl" else f"/batch/scrape/{job_id}"
        state = FirecrawlJobState(job_id=job_id, status="QUEUED", documents=[])
        while True:
            payload = await self._request_json(client, "GET", path)
            state = self._job_state(payload, job_id)
            if state.status in self._terminal_statuses:
                return state
            if state.status not in self._active_statuses:
                raise ProviderRejected(f"Firecrawl returned unknown job status: {state.status}")
            if time.monotonic() + delay > deadline:
                raise ProviderRejected("Firecrawl job timed out before reaching a terminal state")
            await asyncio.sleep(delay)
            delay = min(self.max_poll_interval, delay * 2)

    async def _fetch_next_pages(self, client: httpx.AsyncClient, state: FirecrawlJobState) -> list[Any]:
        documents = list(state.documents)
        next_url = state.next_url
        while next_url and len(documents) < 100:
            parsed = urlparse(next_url)
            base = urlparse(self.base_url)
            if parsed.scheme != "https" or parsed.netloc != "api.firecrawl.dev" or base.netloc != parsed.netloc:
                raise ProviderRejected("Firecrawl pagination URL is not an approved hosted endpoint")
            base_path = base.path.rstrip("/")
            relative_path = parsed.path[len(base_path):] if parsed.path.startswith(base_path) else parsed.path
            payload = await self._request_json(client, "GET", relative_path + (f"?{parsed.query}" if parsed.query else ""))
            page, next_url = self._documents(payload)
            if not page:
                break
            documents.extend(page)
        return documents

    async def _job_result(self, request_query: str, request_limit: int, operation: Literal["crawl", "batch"], started: FirecrawlJobState, client: httpx.AsyncClient) -> ResearchResponse:
        state = await self.poll_job(client, started.job_id, operation)
        if state.status not in {"COMPLETED", "SUCCEEDED"}:
            detail = f": {state.error_message}" if state.error_message else ""
            raise ProviderRejected(f"Firecrawl job ended with {state.status}{detail}")
        raw_items = await self._fetch_next_pages(client, state)
        items = [item for item in (_safe_item(raw, "firecrawl") for raw in raw_items) if item]
        return ResearchResponse(provider=self.name, query=request_query, items=items[:request_limit], result_count=len(items), truncated=len(items) > request_limit)

    async def crawl(self, request: FirecrawlCrawlRequest, context: ResearchContext) -> ResearchResponse:
        self._validate_config()
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=5.0))
        try:
            started = await self.start_crawl(client, request)
            return await self._job_result(request.url, request.limit, "crawl", started, client)
        finally:
            if owns_client:
                await client.aclose()

    async def batch_scrape(self, request: FirecrawlBatchScrapeRequest, context: ResearchContext) -> ResearchResponse:
        self._validate_config()
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=5.0))
        try:
            started = await self.start_batch_scrape(client, request)
            return await self._job_result("batch-scrape", request.limit, "batch", started, client)
        finally:
            if owns_client:
                await client.aclose()

    async def cancel_job(self, client: httpx.AsyncClient, job_id: str, operation: Literal["crawl", "batch"]) -> bool:
        path = f"/crawl/{job_id}/cancel" if operation == "crawl" else f"/batch/scrape/{job_id}/cancel"
        try:
            await self._request_json(client, "POST", path)
            return True
        except ProviderRejected:
            return False


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

    async def abort_run(self, client: httpx.AsyncClient, run_id: str) -> bool:
        await self._request_json(client, "POST", f"/actor-runs/{run_id}/abort")
        return True

    async def abort_remote_run(self, run_id: str) -> bool:
        """Abort an active remote Actor before marking the local job cancelled."""
        if not self.api_token or not self.actor_id:
            raise ProviderNotConfigured("APIFY_API_TOKEN and APIFY_RESEARCH_ACTOR_ID are required")
        if self.actor_id not in self.allowed_actors:
            raise ProviderRejected("Apify research Actor is not allowlisted")
        if self.base_url != "https://api.apify.com/v2":
            raise ProviderRejected("Apify base URL is not an approved hosted endpoint")
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=5.0))
        try:
            return await self.abort_run(client, run_id)
        except ProviderRejected:
            return False
        finally:
            if owns_client:
                await client.aclose()

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
