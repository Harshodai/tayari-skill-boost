#!/usr/bin/env python3
"""Validate redacted evidence from a throwaway PostgreSQL restore drill."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

SECRET_RE = re.compile(r"(?i)(password|secret|token|api[_-]?key)\s*[:=]")


def fail(message: str) -> None:
    raise ValueError(message)


def validate(payload: dict) -> dict:
    if payload.get("schema") != "tayari.recovery-evidence.v1":
        fail("unsupported recovery evidence schema")
    if payload.get("status") != "PASS":
        fail("recovery evidence must be PASS")
    if payload.get("mode") != "throwaway_restore":
        fail("recovery evidence must identify a throwaway restore")
    if payload.get("production_target_match") is not False:
        fail("production target match must be explicitly false")
    if payload.get("restore_completed") is not True:
        fail("restore_completed must be true")
    if payload.get("post_restore_queries_verified") is not True:
        fail("post_restore_queries_verified must be true")
    if payload.get("rls_negative_tests_passed") is not True:
        fail("post-restore RLS negative tests must pass")
    if payload.get("tenant_delete_verified") is not True:
        fail("tenant deletion verification is required")
    if payload.get("audit_events_reconciled") is not True:
        fail("audit event reconciliation is required")
    if payload.get("rollback_verified") is not True:
        fail("rollback verification is required")
    for key in ("run_id", "git_commit", "backup_sha256", "target_fingerprint", "operator_attestation"):
        if not payload.get(key):
            fail(f"{key} is required")
    if not re.fullmatch(r"[0-9a-f]{40}", str(payload["git_commit"])):
        fail("git_commit must be a full commit SHA")
    for key in ("backup_sha256", "target_fingerprint"):
        if not re.fullmatch(r"[0-9a-f]{64}", str(payload[key])):
            fail(f"{key} must be a SHA-256 digest")
    for key in ("rpo_seconds", "rto_seconds", "restore_duration_seconds"):
        value = payload.get(key)
        if not isinstance(value, (int, float)) or value < 0:
            fail(f"{key} must be a non-negative number")
    raw = json.dumps(payload, sort_keys=True)
    if SECRET_RE.search(raw) or "-----BEGIN" in raw:
        fail("secret-shaped material is not allowed in recovery evidence")
    return {
        "status": "PASS",
        "schema": payload["schema"],
        "run_id": payload["run_id"],
        "git_commit": payload["git_commit"],
        "evidence_sha256": hashlib.sha256(raw.encode()).hexdigest(),
        "rpo_seconds": payload["rpo_seconds"],
        "rto_seconds": payload["rto_seconds"],
    }


def plan() -> dict:
    return {
        "schema": "tayari.recovery-evidence.v1",
        "mutates_external_state": True,
        "target": "throwaway_database_only",
        "required_assertions": [
            "restore_completed",
            "post_restore_queries_verified",
            "rls_negative_tests_passed",
            "tenant_delete_verified",
            "audit_events_reconciled",
            "rollback_verified",
            "production_target_match=false",
        ],
        "required_metrics": ["rpo_seconds", "rto_seconds", "restore_duration_seconds"],
        "promotion_rule": "dry-run output is not recovery evidence",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", action="store_true")
    parser.add_argument("--evidence", type=Path)
    args = parser.parse_args()
    try:
        if args.plan:
            print(json.dumps(plan(), indent=2, sort_keys=True))
            return 0
        if not args.evidence:
            fail("--evidence is required unless --plan is used")
        payload = json.loads(args.evidence.read_text(encoding="utf-8"))
        print(json.dumps(validate(payload), indent=2, sort_keys=True))
        return 0
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(json.dumps({"status": "FAIL", "error": str(exc)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
