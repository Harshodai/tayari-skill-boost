import pytest
import httpx

from app.services.external_research import (
    ApifyResearchProvider,
    FirecrawlResearchProvider,
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
