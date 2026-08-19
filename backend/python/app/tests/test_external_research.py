import pytest
import httpx
from fastapi import HTTPException

import app.api.external_research_routes as external_research_routes
from app.services.external_research import (
    ApifyResearchProvider,
    FirecrawlBatchScrapeRequest,
    FirecrawlCrawlRequest,
    FirecrawlResearchProvider,
    ProviderNotConfigured,
    ProviderRejected,
    ResearchContext,
    ResearchRequest,
    _public_web_url,
)


@pytest.mark.parametrize(
    ("url", "allowed"),
    [
        ("https://jobs.example.com/posting", True),
        ("http://127.0.0.1/admin", False),
        ("http://169.254.169.254/latest/meta-data", False),
        ("https://service.internal/data", False),
        ("file:///etc/passwd", False),
    ],
)
def test_public_web_url_policy(url, allowed):
    assert _public_web_url(url) is allowed


@pytest.mark.asyncio
async def test_firecrawl_results_are_bounded_and_private_urls_removed(monkeypatch):
    monkeypatch.setenv("FIRECRAWL_API_KEY", "test-firecrawl-key")
    monkeypatch.setenv("FIRECRAWL_API_BASE_URL", "https://api.firecrawl.dev/v1")

    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"] == "Bearer test-firecrawl-key"
        return httpx.Response(
            200,
            json={
                "data": [
                    {"title": "Public job", "url": "https://jobs.example.com/1", "description": "A" * 5000},
                    {"title": "Private", "url": "http://127.0.0.1/admin", "description": "do not expose"},
                ],
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await FirecrawlResearchProvider(client).search(
            ResearchRequest(query="Senior engineer", limit=2),
            ResearchContext(subject="user-a", tenant_id="tenant-a", request_id="req-1"),
        )

    assert result.provider == "firecrawl"
    assert result.items[0].url == "https://jobs.example.com/1"
    assert len(result.items[0].description) == 4000
    assert result.items[1].url == ""


@pytest.mark.asyncio
async def test_apify_actor_must_be_allowlisted(monkeypatch):
    monkeypatch.setenv("APIFY_API_TOKEN", "test-apify-token")
    monkeypatch.setenv("APIFY_RESEARCH_ACTOR_ID", "unapproved-actor")
    monkeypatch.setenv("APIFY_ALLOWED_ACTORS", "approved-actor")
    provider = ApifyResearchProvider()

    with pytest.raises(ProviderRejected, match="allowlisted"):
        await provider.search(
            ResearchRequest(query="public jobs", provider="apify"),
            ResearchContext(subject="user-a", tenant_id="tenant-a", request_id="req-2"),
        )


@pytest.mark.asyncio
async def test_apify_polls_to_success_and_fetches_dataset_items(monkeypatch):
    monkeypatch.setenv("APIFY_API_TOKEN", "test-apify-token")
    monkeypatch.setenv("APIFY_RESEARCH_ACTOR_ID", "approved-actor")
    monkeypatch.setenv("APIFY_ALLOWED_ACTORS", "approved-actor")
    monkeypatch.setenv("APIFY_POLL_INTERVAL_SECONDS", "0.1")
    monkeypatch.setenv("APIFY_MAX_POLL_INTERVAL_SECONDS", "0.1")
    monkeypatch.setenv("APIFY_HTTP_MAX_ATTEMPTS", "1")
    statuses = iter(["RUNNING", "SUCCEEDED"])
    calls: list[tuple[str, str]] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        calls.append((request.method, request.url.path))
        if request.method == "POST" and request.url.path.endswith("/actors/approved-actor/runs"):
            return httpx.Response(201, json={"data": {"id": "run-123", "defaultDatasetId": "dataset-123"}})
        if request.method == "GET" and request.url.path.endswith("/actor-runs/run-123"):
            return httpx.Response(200, json={"data": {"id": "run-123", "status": next(statuses), "defaultDatasetId": "dataset-123"}})
        if request.method == "GET" and request.url.path.endswith("/datasets/dataset-123/items"):
            return httpx.Response(200, json={"data": {"items": [
                {"title": "Public job", "url": "https://jobs.example.com/1", "description": "A" * 5000},
                {"title": "Private job", "url": "http://127.0.0.1/admin", "description": "private"},
            ]}})
        return httpx.Response(404, json={"error": "unexpected request"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await ApifyResearchProvider(client).search(
            ResearchRequest(query="public jobs", provider="apify", limit=2),
            ResearchContext(subject="user-a", tenant_id="tenant-a", request_id="req-3"),
        )

    assert result.result_count == 2
    assert result.truncated is False
    assert len(result.items[0].description) == 4000
    assert result.items[1].url == ""
    assert calls == [
        ("POST", "/v2/actors/approved-actor/runs"),
        ("GET", "/v2/actor-runs/run-123"),
        ("GET", "/v2/actor-runs/run-123"),
        ("GET", "/v2/datasets/dataset-123/items"),
    ]


@pytest.mark.asyncio
async def test_apify_terminal_failure_is_not_empty_success(monkeypatch):
    monkeypatch.setenv("APIFY_API_TOKEN", "test-apify-token")
    monkeypatch.setenv("APIFY_RESEARCH_ACTOR_ID", "approved-actor")
    monkeypatch.setenv("APIFY_ALLOWED_ACTORS", "approved-actor")
    monkeypatch.setenv("APIFY_HTTP_MAX_ATTEMPTS", "1")

    async def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            return httpx.Response(201, json={"data": {"id": "run-failed"}})
        return httpx.Response(200, json={"data": {"id": "run-failed", "status": "FAILED", "errorMessage": "actor failed"}})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(ProviderRejected, match="FAILED"):
            await ApifyResearchProvider(client).search(
                ResearchRequest(query="public jobs", provider="apify"),
                ResearchContext(subject="user-a", tenant_id="tenant-a", request_id="req-4"),
            )


@pytest.mark.asyncio
async def test_apify_missing_credentials_fails_closed(monkeypatch):
    monkeypatch.delenv("APIFY_API_TOKEN", raising=False)
    monkeypatch.delenv("APIFY_RESEARCH_ACTOR_ID", raising=False)
    provider = ApifyResearchProvider()
    with pytest.raises(ProviderNotConfigured, match="APIFY_API_TOKEN"):
        await provider.search(
            ResearchRequest(query="public jobs", provider="apify"),
            ResearchContext(subject="user-a", tenant_id="tenant-a", request_id="req-5"),
        )


@pytest.mark.asyncio
async def test_firecrawl_crawl_polls_and_follows_next_page(monkeypatch):
    monkeypatch.setenv("FIRECRAWL_API_KEY", "test-firecrawl-key")
    monkeypatch.setenv("FIRECRAWL_API_BASE_URL", "https://api.firecrawl.dev/v2")
    monkeypatch.setenv("FIRECRAWL_POLL_INTERVAL_SECONDS", "0.1")
    monkeypatch.setenv("FIRECRAWL_MAX_POLL_INTERVAL_SECONDS", "0.1")
    monkeypatch.setenv("FIRECRAWL_HTTP_MAX_ATTEMPTS", "1")
    calls: list[tuple[str, str]] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        calls.append((request.method, request.url.path))
        if request.method == "POST" and request.url.path.endswith("/crawl"):
            return httpx.Response(202, json={"id": "crawl-1"})
        if request.method == "GET" and request.url.path.endswith("/crawl/crawl-1") and request.url.params.get("cursor") == "next":
            return httpx.Response(200, json={"status": "completed", "data": {"documents": [{"title": "Page two", "url": "https://example.com/2", "markdown": "two"}]}})
        if request.method == "GET" and request.url.path.endswith("/crawl/crawl-1"):
            return httpx.Response(200, json={"status": "completed", "data": {"documents": [{"title": "Page one", "url": "https://example.com/1", "markdown": "one"}], "next": "https://api.firecrawl.dev/v2/crawl/crawl-1?cursor=next"}})
        return httpx.Response(404, json={"error": "unexpected request"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await FirecrawlResearchProvider(client).crawl(
            FirecrawlCrawlRequest(url="https://example.com", limit=2),
            ResearchContext(subject="user-a", tenant_id="tenant-a", request_id="req-crawl"),
        )

    assert result.result_count == 2
    assert [item.url for item in result.items] == ["https://example.com/1", "https://example.com/2"]
    assert calls[0] == ("POST", "/v2/crawl")
    assert calls.count(("GET", "/v2/crawl/crawl-1")) == 2


@pytest.mark.asyncio
async def test_firecrawl_batch_scrape_rejects_private_urls_and_fetches_documents(monkeypatch):
    monkeypatch.setenv("FIRECRAWL_API_KEY", "test-firecrawl-key")
    monkeypatch.setenv("FIRECRAWL_API_BASE_URL", "https://api.firecrawl.dev/v2")
    provider = FirecrawlResearchProvider()
    with pytest.raises(ProviderRejected, match="public HTTP"):
        await provider.batch_scrape(
            FirecrawlBatchScrapeRequest(urls=["https://example.com", "http://127.0.0.1/admin"]),
            ResearchContext(subject="user-a", tenant_id="tenant-a", request_id="req-batch-reject"),
        )

    async def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            return httpx.Response(202, json={"id": "batch-1"})
        if request.method == "GET":
            return httpx.Response(200, json={"status": "completed", "data": {"documents": [{"title": "Batch page", "url": "https://example.com/1", "markdown": "B" * 5000}]}})
        return httpx.Response(404)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await FirecrawlResearchProvider(client).batch_scrape(
            FirecrawlBatchScrapeRequest(urls=["https://example.com"], limit=1),
            ResearchContext(subject="user-a", tenant_id="tenant-a", request_id="req-batch"),
        )
    assert result.result_count == 1
    assert len(result.items[0].description) == 4000


@pytest.mark.asyncio
async def test_firecrawl_cancel_job_calls_remote_cancel(monkeypatch):
    monkeypatch.setenv("FIRECRAWL_API_KEY", "test-firecrawl-key")
    monkeypatch.setenv("FIRECRAWL_API_BASE_URL", "https://api.firecrawl.dev/v2")
    seen: list[tuple[str, str]] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        seen.append((request.method, request.url.path))
        return httpx.Response(200, json={"success": True})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        assert await FirecrawlResearchProvider(client).cancel_job(client, "crawl-1", "crawl") is True
        assert await FirecrawlResearchProvider(client).cancel_job(client, "batch-1", "batch") is True
    assert seen == [("POST", "/v2/crawl/crawl-1/cancel"), ("POST", "/v2/batch/scrape/batch-1/cancel")]


@pytest.mark.asyncio
async def test_apify_abort_remote_run_calls_authenticated_abort_endpoint(monkeypatch):
    monkeypatch.setenv("APIFY_API_TOKEN", "test-apify-token")
    monkeypatch.setenv("APIFY_RESEARCH_ACTOR_ID", "approved-actor")
    monkeypatch.setenv("APIFY_ALLOWED_ACTORS", "approved-actor")
    seen: list[tuple[str, str, str]] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        seen.append((request.method, request.url.path, request.headers["authorization"]))
        return httpx.Response(200, json={"data": {"status": "ABORTING"}})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        assert await ApifyResearchProvider(client).abort_remote_run("run-456") is True
    assert seen == [("POST", "/v2/actor-runs/run-456/abort", "Bearer test-apify-token")]


@pytest.mark.asyncio
async def test_cancel_route_aborts_remote_before_local_cancel(monkeypatch):
    events: list[str] = []

    class FakeProvider:
        async def abort_remote_run(self, run_id: str) -> bool:
            events.append(f"abort:{run_id}")
            return True

    async def fake_load(job_id: str, user_id: str):
        return {"job_id": job_id, "user_id": user_id, "status": "running", "provider_run_id": "run-789"}

    async def fake_cancel(job_id: str, user_id: str):
        events.append("local-cancel")
        return {"job_id": job_id}

    monkeypatch.setattr(external_research_routes, "require_capability", lambda _: None)
    monkeypatch.setattr(external_research_routes, "ApifyResearchProvider", FakeProvider)
    monkeypatch.setattr(external_research_routes, "load_external_research_run_for_user", fake_load)
    monkeypatch.setattr(external_research_routes, "cancel_external_research_run", fake_cancel)

    result = await external_research_routes.cancel_external_research("job-1", "user-1")
    assert result.status == "cancelled"
    assert events == ["abort:run-789", "local-cancel"]


@pytest.mark.asyncio
async def test_cancel_route_refuses_local_cancel_when_remote_abort_fails(monkeypatch):
    local_cancel_called = False

    class FakeProvider:
        async def abort_remote_run(self, run_id: str) -> bool:
            return False

    async def fake_load(job_id: str, user_id: str):
        return {"job_id": job_id, "user_id": user_id, "status": "running", "provider_run_id": "run-790"}

    async def fake_cancel(job_id: str, user_id: str):
        nonlocal local_cancel_called
        local_cancel_called = True
        return {"job_id": job_id}

    monkeypatch.setattr(external_research_routes, "require_capability", lambda _: None)
    monkeypatch.setattr(external_research_routes, "ApifyResearchProvider", FakeProvider)
    monkeypatch.setattr(external_research_routes, "load_external_research_run_for_user", fake_load)
    monkeypatch.setattr(external_research_routes, "cancel_external_research_run", fake_cancel)

    with pytest.raises(HTTPException, match="abort_failed"):
        await external_research_routes.cancel_external_research("job-2", "user-1")
    assert local_cancel_called is False
