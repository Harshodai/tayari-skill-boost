import pytest
import httpx

from app.services.external_research import (
    ApifyResearchProvider,
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
