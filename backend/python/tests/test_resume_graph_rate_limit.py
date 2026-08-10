"""Tests for the resume-graph rate limiter store bounding.

Pure tests: exercise _rate_limit_check directly; no network.
"""
import pytest

pytest.importorskip("pydantic")

from fastapi import HTTPException

from app.api.resume_graph import (
    _RATE_LIMIT,
    _RATE_LIMIT_MAX,
    _RATE_LIMIT_WINDOW,
    _rate_limit_check,
)


@pytest.fixture(autouse=True)
def _clear_store():
    _RATE_LIMIT.clear()
    yield
    _RATE_LIMIT.clear()


def test_rate_limit_allows_window_then_429():
    now = 1_000_000.0
    for _ in range(_RATE_LIMIT_MAX):
        _rate_limit_check("user-1", now)
    with pytest.raises(HTTPException) as exc:
        _rate_limit_check("user-1", now)
    assert exc.value.status_code == 429


def test_rate_limit_window_expires():
    now = 1_000_000.0
    for _ in range(_RATE_LIMIT_MAX):
        _rate_limit_check("user-1", now)
    _rate_limit_check("user-1", now + _RATE_LIMIT_WINDOW + 1)
    assert len(_RATE_LIMIT["user-1"]) == 1


def test_rate_limit_evicts_stale_keys_when_store_full():
    now = 1_000_000.0
    for i in range(10_000):
        _rate_limit_check(f"user-{i}", now)
    assert len(_RATE_LIMIT) == 10_000
    _rate_limit_check("user-99999", now + _RATE_LIMIT_WINDOW + 1)
    assert len(_RATE_LIMIT) <= 10_000
    assert "user-99999" in _RATE_LIMIT


def test_rate_limit_evicts_oldest_when_all_active():
    now = 1_000_000.0
    for i in range(10_000):
        _rate_limit_check(f"user-{i}", now)
    _rate_limit_check("user-99999", now + 1)
    assert len(_RATE_LIMIT) <= 10_000
    assert "user-99999" in _RATE_LIMIT