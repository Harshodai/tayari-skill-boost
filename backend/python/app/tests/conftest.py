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
import sys
import types

import pytest

# Fallback stubs for running unit tests on bare-metal host when dependencies are inside Docker
try:
    import pydantic
except ImportError:
    pydantic_mock = types.ModuleType("pydantic")
    class BaseModel:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)
        def model_dump(self, *args, **kwargs):
            return self.__dict__
        def dict(self, *args, **kwargs):
            return self.__dict__
    def Field(*args, default=None, default_factory=None, **kwargs):
        if default_factory is not None:
            return default_factory()
        return default if (not args or args[0] is ...) else (args[0] if args else default)
    class ConfigDict(dict):
        pass
    class ValidationError(Exception):
        pass
    pydantic_mock.BaseModel = BaseModel
    pydantic_mock.Field = Field
    pydantic_mock.ConfigDict = ConfigDict
    pydantic_mock.ValidationError = ValidationError
    pydantic_mock.EmailStr = str
    sys.modules["pydantic"] = pydantic_mock

try:
    import fastapi
except ImportError:
    fastapi_mock = types.ModuleType("fastapi")
    class FastAPI:
        def __init__(self, *args, **kwargs):
            pass
        def get(self, *args, **kwargs):
            return lambda fn: fn
        def post(self, *args, **kwargs):
            return lambda fn: fn
        def put(self, *args, **kwargs):
            return lambda fn: fn
        def delete(self, *args, **kwargs):
            return lambda fn: fn
        def include_router(self, *args, **kwargs):
            pass
        def add_middleware(self, *args, **kwargs):
            pass
    class APIRouter(FastAPI):
        pass
    class HTTPException(Exception):
        def __init__(self, status_code=500, detail=""):
            self.status_code = status_code
            self.detail = detail
    fastapi_mock.FastAPI = FastAPI
    fastapi_mock.APIRouter = APIRouter
    fastapi_mock.HTTPException = HTTPException
    fastapi_mock.Depends = lambda x=None: x
    fastapi_mock.Query = lambda default=None, **kwargs: default
    fastapi_mock.Header = lambda default=None, **kwargs: default
    fastapi_mock.status = types.SimpleNamespace(
        HTTP_400_BAD_REQUEST=400,
        HTTP_401_UNAUTHORIZED=401,
        HTTP_403_FORBIDDEN=403,
        HTTP_404_NOT_FOUND=404,
        HTTP_422_UNPROCESSABLE_ENTITY=422,
        HTTP_500_INTERNAL_SERVER_ERROR=500,
    )
    sys.modules["fastapi"] = fastapi_mock
    sys.modules["fastapi.responses"] = types.ModuleType("fastapi.responses")
    sys.modules["fastapi.responses"].JSONResponse = lambda content, status_code=200: {"content": content, "status": status_code}

os.environ.setdefault("JWT_SECRET", "test-jwt-secret-for-app-tests-minimum-32-chars")


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
    try:
        from app.api.resume_graph import _RATE_LIMIT
        _RATE_LIMIT.clear()
        yield
        _RATE_LIMIT.clear()
    except ImportError:
        yield
