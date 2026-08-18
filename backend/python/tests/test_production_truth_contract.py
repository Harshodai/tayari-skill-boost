from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest
from fastapi import HTTPException


ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "scripts" / "verify_production_truth_contract.py"


def _load_truth_contract():
    spec = importlib.util.spec_from_file_location("production_truth_contract", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_production_truth_contract_passes():
    assert _load_truth_contract().main() == 0


def test_legacy_job_seeker_fixture_is_disabled_by_default(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("JWT_SECRET", "ci-test-jwt-secret-not-production")
    from app.routes.agent import _require_legacy_job_seeker_fixture

    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.delenv("ENABLE_LEGACY_JOB_SEEKER_FIXTURE", raising=False)
    with pytest.raises(HTTPException) as exc_info:
        _require_legacy_job_seeker_fixture()
    assert exc_info.value.status_code == 423
    assert exc_info.value.detail["capability"] == "demo.legacy_job_seeker_engine"


def test_legacy_job_seeker_fixture_requires_explicit_development_enablement(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("JWT_SECRET", "ci-test-jwt-secret-not-production")
    from app.routes.agent import _require_legacy_job_seeker_fixture

    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("ENABLE_LEGACY_JOB_SEEKER_FIXTURE", "true")
    _require_legacy_job_seeker_fixture()

    monkeypatch.setenv("APP_ENV", "staging")
    with pytest.raises(HTTPException) as exc_info:
        _require_legacy_job_seeker_fixture()
    assert exc_info.value.status_code == 423
