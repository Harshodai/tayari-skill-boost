"""Test configuration for the Hermes test suite.

Registers the ``network`` marker and skips network-gated tests by default.
Run them explicitly with ``-m network`` (CI without provider keys stays green).
"""
from __future__ import annotations

import os
import sys

# Make the backend/python package root (containing ``app/``) importable.
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

import pytest


def pytest_configure(config):
    config.addinivalue_line(
        "markers", "network: requires live network/provider keys; skipped by default"
    )


def pytest_collection_modifyitems(config, items):
    skip_network = pytest.mark.skip(reason="network test; run with -m network to enable")
    for item in items:
        if "network" in item.keywords:
            item.add_marker(skip_network)