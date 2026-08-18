from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "scripts" / "verify_recovery_evidence.py"


def _module():
    spec = importlib.util.spec_from_file_location("recovery_evidence", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _payload():
    return {
        "schema": "tayari.recovery-evidence.v1",
        "status": "PASS",
        "mode": "throwaway_restore",
        "production_target_match": False,
        "restore_completed": True,
        "post_restore_queries_verified": True,
        "rls_negative_tests_passed": True,
        "tenant_delete_verified": True,
        "audit_events_reconciled": True,
        "rollback_verified": True,
        "run_id": "recovery-run-001",
        "git_commit": "a" * 40,
        "backup_sha256": "b" * 64,
        "target_fingerprint": "c" * 64,
        "operator_attestation": "redacted-attestation",
        "rpo_seconds": 300,
        "rto_seconds": 900,
        "restore_duration_seconds": 120,
    }


def test_valid_recovery_evidence_passes():
    result = _module().validate(_payload())
    assert result["status"] == "PASS"
    assert result["rto_seconds"] == 900


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("production_target_match", True, "production target"),
        ("restore_completed", False, "restore_completed"),
        ("rls_negative_tests_passed", False, "RLS"),
        ("tenant_delete_verified", False, "tenant deletion"),
        ("rollback_verified", False, "rollback"),
    ],
)
def test_recovery_evidence_fail_closed(field, value, message):
    payload = _payload()
    payload[field] = value
    with pytest.raises(ValueError, match=message):
        _module().validate(payload)
