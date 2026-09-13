"""Test configuration for the app test suite.

Three responsibilities:
1. The AI engine's auth dependency now fail-fasts when ``JWT_SECRET`` is unset
   (see ``app/auth/dependencies.py``), mirroring the Go gateway. The tests import
   ``app.main`` at module scope, so set a harmless test secret before any import.
2. Register the ``network`` marker (used for tests that need a live LLM provider)
   and skip those tests by default, matching ``backend/python/tests/conftest.py``.
   Run them explicitly with ``-m network``.
3. Reset the resume-graph in-process rate limiter between tests, so a test's
   result never depends on how many resume-graph requests earlier tests made.
"""
from __future__ import annotations

import os

import pytest

os.environ.setdefault("JWT_SECRET", "test-jwt-secret-for-app-tests")


def pytest_configure(config):
    config.addinivalue_line(
        "markers", "network: requires live network/provider keys; skipped by default"
    )


def pytest_collection_modifyitems(config, items):
    if config.getoption("-m") and "network" in config.getoption("-m"):
        return
    skip_network = pytest.mark.skip(reason="network test; run with -m network to enable")
    for item in items:
        if "network" in item.keywords:
            item.add_marker(skip_network)


@pytest.fixture(autouse=True)
def _reset_resume_graph_rate_limit():
    """Clear ``app.api.resume_graph._RATE_LIMIT`` before every test.

    The limiter is a module-global dict keyed by client IP, and every
    ``TestClient`` request arrives as the same key ("testclient"). Its 5
    requests/minute budget is therefore shared across the whole session, so a
    test that expects 200/404 fails with 429 purely because earlier tests in
    the run happened to hit ``/v1/resume-graph`` first. Resetting per test
    isolates that global instead of changing production limiter behaviour.
    """
    from app.api.resume_graph import _RATE_LIMIT

    _RATE_LIMIT.clear()
    yield
    _RATE_LIMIT.clear()
