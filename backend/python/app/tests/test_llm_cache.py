import json

import pytest

from app.services import llm_cache


class FakeAsyncRedis:
    def __init__(self, exc=None):
        self.store = {}
        self.set_calls = []
        self.exc = exc

    async def get(self, key):
        if self.exc:
            raise self.exc
        return self.store.get(key)

    async def set(self, key, value, ex=None):
        if self.exc:
            raise self.exc
        self.store[key] = value
        self.set_calls.append({"key": key, "ex": ex})
        return True


def test_key_stability_same_inputs_same_key():
    k1 = llm_cache.build_optimizer_cache_key("resume", "jd")
    k2 = llm_cache.build_optimizer_cache_key("resume", "jd")
    assert k1 == k2
    assert k1.startswith("tayari:opt:")


def test_prompt_version_miss():
    k1 = llm_cache.build_optimizer_cache_key("resume", "jd", prompt_version="v1")
    k2 = llm_cache.build_optimizer_cache_key("resume", "jd", prompt_version="v2")
    assert k1 != k2


def test_extra_params_change_key():
    k1 = llm_cache.build_optimizer_cache_key("resume", "jd", target_role="a")
    k2 = llm_cache.build_optimizer_cache_key("resume", "jd", target_role="b")
    assert k1 != k2


@pytest.mark.asyncio
async def test_set_passes_ttl_and_roundtrips_dict():
    redis = FakeAsyncRedis()
    key = llm_cache.build_optimizer_cache_key("resume", "jd")
    payload = {"optimized_text": "hello", "new_heuristic_score": 90}
    assert await llm_cache.set_optimizer_result(redis, key, payload, ttl=123) is True
    assert redis.set_calls[0]["ex"] == 123
    assert await llm_cache.get_optimizer_result(redis, key) == payload


@pytest.mark.asyncio
async def test_fail_open_on_redis_exception():
    redis = FakeAsyncRedis(exc=RuntimeError("redis down"))
    key = llm_cache.build_optimizer_cache_key("resume", "jd")
    assert await llm_cache.get_optimizer_result(redis, key) is None
    assert await llm_cache.set_optimizer_result(redis, key, {"a": 1}) is False


@pytest.mark.asyncio
async def test_fail_open_on_none_client():
    assert await llm_cache.get_optimizer_result(None, "k") is None
    assert await llm_cache.set_optimizer_result(None, "k", {"a": 1}) is False


@pytest.mark.asyncio
async def test_corrupt_payload_returns_none():
    redis = FakeAsyncRedis()
    redis.store["k"] = "not-json{"
    assert await llm_cache.get_optimizer_result(redis, "k") is None
