"""Test configuration for the app test suite.

Two responsibilities:
1. The AI engine's auth dependency now fail-fasts when ``JWT_SECRET`` is unset
   (see ``app/auth/dependencies.py``), mirroring the Go gateway. The tests import
   ``app.main`` at module scope, so set a harmless test secret before any import.
2. Register the ``network`` marker (used for tests that need a live LLM provider)
   and skip those tests by default, matching ``backend/python/tests/conftest.py``.
   Run them explicitly with ``-m network``.
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
