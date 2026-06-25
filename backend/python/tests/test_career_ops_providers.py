import pytest
import httpx
import asyncio
from unittest.mock import AsyncMock, MagicMock
from app.services.providers import greenhouse, lever, ashby, workday, bamboohr
from app.services.portal_scanner import (
    match_title,
    match_location,
    auto_detect_provider,
    compile_keyword,
    scan_portals
)

# --- Mocks ---
_orig_async_client = httpx.AsyncClient

def _client_with_handler(handler) -> httpx.AsyncClient:
    transport = httpx.MockTransport(handler)
    return _orig_async_client(transport=transport, timeout=10)

# --- Provider Tests ---

@pytest.mark.asyncio
async def test_greenhouse_provider(monkeypatch):
    payload = {
        "jobs": [
            {
                "id": 999,
                "title": "Staff AI Engineer",
                "absolute_url": "https://boards.greenhouse.io/google/jobs/999",
                "location": {"name": "Mountain View, CA"},
                "first_published": "2026-06-25T12:00:00Z"
            }
        ]
    }
    
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=payload)
        
    monkeypatch.setattr(httpx, "AsyncClient", lambda *args, **kwargs: _client_with_handler(handler))
    
    jobs = await greenhouse.fetch_jobs("google", "https://job-boards.greenhouse.io/google")
    assert len(jobs) == 1
    assert jobs[0]["title"] == "Staff AI Engineer"
    assert jobs[0]["location"] == "Mountain View, CA"
    assert jobs[0]["url"] == "https://boards.greenhouse.io/google/jobs/999"


@pytest.mark.asyncio
async def test_lever_provider(monkeypatch):
    payload = [
        {
            "text": "Go Developer",
            "hostedUrl": "https://jobs.lever.co/stripe/uuid1",
            "categories": {"location": "Remote"},
            "descriptionPlain": "Build robust Go APIs",
            "createdAt": 1782390000000
        }
    ]
    
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=payload)
        
    monkeypatch.setattr(httpx, "AsyncClient", lambda *args, **kwargs: _client_with_handler(handler))
    
    jobs = await lever.fetch_jobs("stripe", "https://jobs.lever.co/stripe")
    assert len(jobs) == 1
    assert jobs[0]["title"] == "Go Developer"
    assert jobs[0]["location"] == "Remote"
    assert "robust Go" in jobs[0]["description"]


@pytest.mark.asyncio
async def test_ashby_provider(monkeypatch):
    payload = {
        "jobs": [
            {
                "title": "Senior Product Manager",
                "jobUrl": "https://jobs.ashbyhq.com/notion/uuid2",
                "location": "New York",
                "publishedAt": "2026-06-25T15:00:00Z",
                "compensation": {
                    "minValue": 150000,
                    "maxValue": 200000,
                    "interval": "1 YEAR",
                    "currency": "USD"
                }
            }
        ]
    }
    
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=payload)
        
    monkeypatch.setattr(httpx, "AsyncClient", lambda *args, **kwargs: _client_with_handler(handler))
    
    jobs = await ashby.fetch_jobs("notion", "https://jobs.ashbyhq.com/notion")
    assert len(jobs) == 1
    assert jobs[0]["title"] == "Senior Product Manager"
    assert jobs[0]["salary"]["min"] == 150000
    assert jobs[0]["salary"]["max"] == 200000


@pytest.mark.asyncio
async def test_workday_provider(monkeypatch):
    payload = {
        "jobPostings": [
            {
                "title": "Software Engineer",
                "externalPath": "/job/123",
                "locationsText": "London, UK",
                "postedOn": "Posted Today"
            }
        ]
    }
    
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=payload)
        
    monkeypatch.setattr(httpx, "AsyncClient", lambda *args, **kwargs: _client_with_handler(handler))
    
    jobs = await workday.fetch_jobs("acme", "https://acme.wd1.myworkdayjobs.com/Careers")
    assert len(jobs) == 1
    assert jobs[0]["title"] == "Software Engineer"
    assert jobs[0]["location"] == "London, UK"


@pytest.mark.asyncio
async def test_bamboohr_provider(monkeypatch):
    payload = {
        "result": [
            {
                "id": "1",
                "jobOpeningName": "Tech Lead",
                "isRemote": True,
                "location": {"city": "Berlin", "state": "DE"}
            }
        ]
    }
    
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=payload)
        
    monkeypatch.setattr(httpx, "AsyncClient", lambda *args, **kwargs: _client_with_handler(handler))
    
    jobs = await bamboohr.fetch_jobs("netflix", "https://netflix.bamboohr.com/careers")
    assert len(jobs) == 1
    assert jobs[0]["title"] == "Tech Lead"
    assert "Berlin" in jobs[0]["location"]
    assert "Remote" in jobs[0]["location"]

# --- Scanner Helper Tests ---

def test_match_title():
    assert match_title("Senior Go Developer", ["go", "golang"], ["rust"]) is True
    assert match_title("Senior Rust Developer", ["go"], ["rust"]) is False
    assert match_title("Rust Developer", ["rust"], []) is True
    assert match_title("Staff DevOps Engineer", ["devops"], ["junior"]) is True
    assert match_title("Junior Engineer", ["engineer"], ["junior"]) is False

def test_match_location():
    assert match_location("San Francisco, CA", ["San Francisco"], ["Remote"]) is True
    assert match_location("Remote, US", ["Remote"], ["SF"]) is True
    assert match_location("London, UK", [], []) is True
    assert match_location("New York, NY", ["Remote"], [], ["New York"]) is True

def test_auto_detect_provider():
    assert auto_detect_provider("https://boards.greenhouse.io/airbnb") == "greenhouse"
    assert auto_detect_provider("https://jobs.lever.co/stripe") == "lever"
    assert auto_detect_provider("https://jobs.ashbyhq.com/notion") == "ashby"
    assert auto_detect_provider("https://acme.wd1.myworkdayjobs.com/Careers") == "workday"
    assert auto_detect_provider("https://acme.bamboohr.com/careers") == "bamboohr"
    assert auto_detect_provider("https://example.com") is None

# --- Mocked Scanner Database Integration ---

class FakeRecord(dict):
    def __getitem__(self, key):
        return super().get(key)

class FakePool:
    def __init__(self, fetch_results):
        self.fetch_results = fetch_results
        self.fetch_index = 0
        self.execute_called = False
        
    def acquire(self):
        return self
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass
        
    async def fetch(self, sql, *args):
        res = self.fetch_results[self.fetch_index]
        self.fetch_index += 1
        return [FakeRecord(r) for r in res]
        
    async def execute(self, sql, *args):
        self.execute_called = True
        return "INSERT 1"

@pytest.mark.asyncio
async def test_scan_portals_db_mock(monkeypatch):
    fetch_results = [
        # First call: list_user_portals
        [
            {
                "id": 1,
                "user_id": "test_user_id",
                "name": "google",
                "careers_url": "https://boards.greenhouse.io/google",
                "provider": "greenhouse",
                "enabled": True,
                "keywords_override": ["AI"]
            }
        ],
        # Second call: union of job_urls
        [
            {"job_url": "https://boards.greenhouse.io/google/jobs/already_applied"}
        ]
    ]
    
    fake_pool = FakePool(fetch_results)
    
    import app.services.portal_scanner as portal_scanner
    monkeypatch.setattr(portal_scanner, "get_pool", AsyncMock(return_value=fake_pool))
    
    # Mock greenhouse fetch_jobs
    mock_jobs = [
        {
            "title": "AI Researcher",
            "url": "https://boards.greenhouse.io/google/jobs/new_job",
            "company": "google",
            "location": "Mountain View, CA",
            "description": "AI systems development",
            "posted_at": None
        }
    ]
    monkeypatch.setattr(greenhouse, "fetch_jobs", AsyncMock(return_value=mock_jobs))
    
    discovered = await scan_portals("test_user_id")
    assert len(discovered) == 1
    assert discovered[0]["title"] == "AI Researcher"
    assert fake_pool.execute_called
