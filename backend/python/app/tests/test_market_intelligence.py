"""Tests for C3 market-intelligence first slice (real demand signals, fail-open).

Truthfulness contract under test:
- fresh verified cache hit => no HTTP fetch
- stale/missing cache => fetch attempted
- fetch failure => provenance "unavailable", count None (never fabricated)
- every verified figure carries source + fetched_at
- scenario_planner prefers verified market counts, keeps "illustrative" otherwise
"""
import json

import pytest

from app.services import market_intelligence as mi
from app.services.scenario_planner import plan_scenario


class FakeAsyncRedis:
    def __init__(self, exc=None):
        self.store = {}
        self.set_calls = []
        self.get_calls = []
        self.exc = exc

    async def get(self, key):
        self.get_calls.append(key)
        if self.exc:
            raise self.exc
        return self.store.get(key)

    async def set(self, key, value, ex=None):
        if self.exc:
            raise self.exc
        self.store[key] = value
        self.set_calls.append({"key": key, "ex": ex})
        return True


def _verified_payload(count=42, source="arbeitnow"):
    return json.dumps({
        "role": "Backend Engineer",
        "count": count,
        "provenance": "verified",
        "source": source,
        "fetched_at": "2026-09-03T00:00:00+00:00",
    })


def _arbeitnow_ok(url, timeout=5):
    assert "arbeitnow" in url
    return {"data": [
        {"title": "Backend Engineer (Python)"},
        {"title": "Senior Backend Engineer"},
        {"title": "Frontend Developer"},
    ]}


def _raise(url, timeout=5):
    raise TimeoutError("connection timed out")


@pytest.mark.asyncio
async def test_fresh_cache_hit_avoids_fetch():
    redis = FakeAsyncRedis()
    key = mi.build_market_cache_key("Backend Engineer")
    redis.store[key] = _verified_payload()
    result = await mi.get_role_demand("Backend Engineer", redis_client=redis, http_get=_raise)
    assert result["provenance"] == "verified"
    assert result["count"] == 42
    assert result["source"] == "arbeitnow"
    assert "fetched_at" in result


@pytest.mark.asyncio
async def test_cache_miss_triggers_fetch_and_caches_24h():
    redis = FakeAsyncRedis()
    result = await mi.get_role_demand("Backend Engineer", redis_client=redis, http_get=_arbeitnow_ok)
    assert result["provenance"] == "verified"
    assert result["count"] == 2
    assert result["source"] == "arbeitnow"
    assert result["fetched_at"]
    assert redis.set_calls and redis.set_calls[0]["ex"] == mi.MARKET_CACHE_TTL_SECONDS == 86400


@pytest.mark.asyncio
async def test_fetch_failure_yields_unavailable_never_fabricates():
    redis = FakeAsyncRedis()
    result = await mi.get_role_demand("Backend Engineer", redis_client=redis, http_get=_raise)
    assert result["provenance"] == "unavailable"
    assert result["count"] is None
    assert "fetched_at" not in result or result.get("fetched_at") is None


@pytest.mark.asyncio
async def test_redis_down_fail_open_still_fetches():
    redis = FakeAsyncRedis(exc=RuntimeError("redis down"))
    result = await mi.get_role_demand("Backend Engineer", redis_client=redis, http_get=_arbeitnow_ok)
    assert result["provenance"] == "verified"
    assert result["count"] == 2


@pytest.mark.asyncio
async def test_remotive_fallback_when_arbeitnow_fails():
    def http_get(url, timeout=5):
        if "arbeitnow" in url:
            raise ConnectionError("arbeitnow down")
        assert "remotive" in url
        return {"jobs": [{"title": "Backend Engineer"}], "job-count": 7}

    redis = FakeAsyncRedis()
    result = await mi.get_role_demand("Backend Engineer", redis_client=redis, http_get=http_get)
    assert result["provenance"] == "verified"
    assert result["count"] == 7
    assert result["source"] == "remotive"


def test_onet_without_credentials_is_unavailable(monkeypatch):
    monkeypatch.delenv("ONET_USERNAME", raising=False)
    monkeypatch.delenv("ONET_PASSWORD", raising=False)
    result = mi.fetch_onet_taxonomy("backend", http_get=_raise)
    assert result["provenance"] == "unavailable"
    assert result["count"] is None


def test_scenario_planner_prefers_verified_market_counts():
    market = {"Staff Engineer": {
        "role": "Staff Engineer", "count": 37, "provenance": "verified",
        "source": "arbeitnow", "fetched_at": "2026-09-03T00:00:00+00:00",
    }}
    plan = plan_scenario(
        "seniority_increase", ["Python", "FastAPI"],
        current_title="Senior Developer", target_role="Staff Engineer",
        market_counts=market,
    )
    primary = plan["available_roles"][0]
    assert primary["count"] == 37
    assert primary["provenance"] == "verified"
    assert primary["source"] == "arbeitnow"


def test_scenario_planner_keeps_illustrative_without_market_data():
    plan = plan_scenario("role_change", ["Python"], target_role="ML Engineer")
    assert all(r["provenance"] == "illustrative" for r in plan["available_roles"])
    plan2 = plan_scenario(
        "role_change", ["Python"], target_role="ML Engineer",
        market_counts={"ML Engineer": {"provenance": "unavailable", "count": None}},
    )
    assert all(r["provenance"] == "illustrative" for r in plan2["available_roles"])
