"""Governed external research providers for public job/company intelligence.

This module deliberately keeps provider access behind a narrow typed interface. It
never accepts arbitrary provider URLs or Actor IDs from callers, never exposes
provider credentials in results, and returns only bounded, sanitized records.
"""
from __future__ import annotations

import ipaddress
import os
from dataclasses import dataclass
from typing import Any, Literal
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

    def __init__(self, client: httpx.AsyncClient | None = None):
        self.api_token = os.getenv("APIFY_API_TOKEN", "").strip()
        self.base_url = os.getenv("APIFY_API_BASE_URL", "https://api.apify.com/v2").rstrip("/")
        self.allowed_actors = frozenset(filter(None, (value.strip() for value in os.getenv("APIFY_ALLOWED_ACTORS", "").split(","))))
        self.actor_id = os.getenv("APIFY_RESEARCH_ACTOR_ID", "").strip()
        self._client = client

    async def search(self, request: ResearchRequest, context: ResearchContext) -> ResearchResponse:
        if not self.api_token or not self.actor_id:
            raise ProviderNotConfigured("APIFY_API_TOKEN and APIFY_RESEARCH_ACTOR_ID are required")
        if self.actor_id not in self.allowed_actors:
            raise ProviderRejected("Apify research Actor is not allowlisted")
        if self.base_url != "https://api.apify.com/v2":
            raise ProviderRejected("Apify base URL is not an approved hosted endpoint")
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=5.0))
        try:
            response = await client.post(
                f"{self.base_url}/acts/{self.actor_id}/runs",
                headers={"Authorization": f"Bearer {self.api_token}", "Content-Type": "application/json"},
                json={"query": request.query, "limit": request.limit},
            )
            response.raise_for_status()
            payload = response.json()
        except httpx.HTTPStatusError as exc:
            raise ProviderRejected(f"Apify request rejected with HTTP {exc.response.status_code}") from exc
        except (httpx.HTTPError, ValueError) as exc:
            raise ProviderRejected("Apify request failed") from exc
        finally:
            if owns_client:
                await client.aclose()
        run = payload.get("data", payload) if isinstance(payload, dict) else {}
        run_id = _bounded_text(run.get("id") if isinstance(run, dict) else "", 200)
        if not run_id:
            raise ProviderRejected("Apify did not return a run ID")
        return ResearchResponse(provider=self.name, query=request.query, items=[], result_count=0, truncated=False)


def provider_for(name: ProviderName, client: httpx.AsyncClient | None = None) -> ExternalResearchProvider:
    if name == "firecrawl":
        return FirecrawlResearchProvider(client)
    return ApifyResearchProvider(client)
