from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "scripts" / "verify_staging_evidence_bundle.py"


def _module():
    spec = importlib.util.spec_from_file_location("staging_evidence_bundle", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _bundle():
    module = _module()
    categories = []
    for name, scenarios in module.REQUIRED_SCENARIOS.items():
        categories.append({
            "name": name,
            "status": "PASS",
            "scenarios": [
                {"name": scenario, "status": "PASS", "evidence_ref": f"evidence://{name}/{scenario}"}
                for scenario in sorted(scenarios)
            ],
        })
    return {
        "schema": "tayari.staging-evidence.v1",
        "status": "PASS",
        "environment": "staging",
        "run_id": "staging-run-20260818-001",
        "generated_at": "2026-08-18T12:00:00Z",
        "git_commit": "a" * 40,
        "operator_attestation": "operator-redacted-attestation",
        "categories": categories,
        "environment_attestation": {
            "target_base_url": "https://staging.example.test",
            "python_base_url": "https://python.staging.example.test",
            "image_digest": "sha256:" + "b" * 64,
            "sbom_sha256": "c" * 64,
            "provider_config_hash": "d" * 64,
        },
    }


def test_valid_redacted_bundle_passes_without_live_calls():
    result = _module().validate_bundle(_bundle(), require_live=False)
    assert result["status"] == "PASS"
    assert result["live_validation"] is False


def test_missing_required_scenario_fails_closed():
    bundle = _bundle()
    bundle["categories"][0]["scenarios"] = []
    with pytest.raises(ValueError, match="missing scenarios"):
        _module().validate_bundle(bundle, require_live=False)


def test_secret_shaped_evidence_fails_closed():
    bundle = _bundle()
    bundle["operator_attestation"] = "api_key=not-allowed-in-evidence"
    with pytest.raises(ValueError, match="secret-shaped"):
        _module().validate_bundle(bundle, require_live=False)


def test_live_validation_requires_explicit_operator_authorization(monkeypatch):
    monkeypatch.delenv("ALLOW_LIVE_PROVIDER_VERIFY", raising=False)
    with pytest.raises(ValueError, match="ALLOW_LIVE_PROVIDER_VERIFY=true"):
        _module().validate_bundle(_bundle(), require_live=True)
