#!/usr/bin/env python3
"""Validate a no-secrets staging evidence bundle for JobTayari promotion.

This tool does not call providers by default. It validates operator-supplied,
redacted evidence produced by real staging runs and fails closed when required
categories, scenario results, or environment attestations are missing.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

REQUIRED_CATEGORIES = {
    "computer_isolated",
    "computer_local_bridge",
    "tenant_isolation",
    "privacy_deletion_restore",
    "provider_integrations",
    "adversarial_agent_safety",
    "observability_recovery",
}
REQUIRED_SCENARIOS = {
    "computer_isolated": {"create", "teardown", "network_boundary", "crash_recovery"},
    "computer_local_bridge": {"attach", "origin_switch_rejected", "revoke", "stop_latency"},
    "tenant_isolation": {"tenant_a_read_denies_tenant_b", "tenant_a_write_denies_tenant_b", "cache_namespace_isolation"},
    "privacy_deletion_restore": {"backup_restore", "account_delete", "export_delete_reconciliation"},
    "provider_integrations": {"firecrawl", "apify", "a2a", "mcp", "gmail", "stripe"},
    "adversarial_agent_safety": {"prompt_injection", "visual_injection", "tool_misuse", "credential_boundary"},
    "observability_recovery": {"kill_switch_alert", "provenance_correlation", "rollback", "rpo_rto"},
}
SECRET_PATTERNS = (
    re.compile(r"(?i)(api[_-]?key|secret|token|password|private[_-]?key)\s*[:=]\s*[^\s,}\]]+"),
    re.compile(r"-----BEGIN [A-Z ]+ PRIVATE KEY-----"),
    re.compile(r"sk-[A-Za-z0-9]{16,}"),
)


def _fail(message: str) -> "NoReturn":
    raise ValueError(message)


def _load(path: Path) -> dict:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        _fail(f"cannot read evidence JSON: {exc}")
    if not isinstance(payload, dict):
        _fail("evidence root must be an object")
    return payload


def _check_no_secrets(value: object, path: str = "root") -> None:
    text = json.dumps(value, sort_keys=True)
    for pattern in SECRET_PATTERNS:
        if pattern.search(text):
            _fail(f"possible secret-shaped value found at {path}")


def _check_url(name: str, value: str, *, require_https: bool) -> None:
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        _fail(f"{name} must be an absolute HTTP(S) URL")
    if require_https and parsed.scheme != "https":
        _fail(f"{name} must use HTTPS for staging evidence")
    host = (parsed.hostname or "").lower()
    if host in {"localhost", "127.0.0.1", "::1"} or host.startswith("10.") or host.startswith("192.168."):
        _fail(f"{name} must not point at a local/private operator endpoint")


def validate_bundle(payload: dict, *, require_live: bool) -> dict:
    if payload.get("schema") != "tayari.staging-evidence.v1":
        _fail("unsupported evidence schema; expected tayari.staging-evidence.v1")
    if payload.get("status") != "PASS":
        _fail("evidence bundle status must be PASS")
    if payload.get("environment") not in {"staging", "staging-hostile-verification"}:
        _fail("evidence bundle must identify staging environment")
    if not payload.get("run_id") or not payload.get("generated_at"):
        _fail("run_id and generated_at are required")
    if not payload.get("git_commit") or not re.fullmatch(r"[0-9a-f]{40}", str(payload["git_commit"])):
        _fail("git_commit must be a full 40-character commit SHA")
    if not payload.get("operator_attestation"):
        _fail("operator_attestation is required")

    _check_no_secrets(payload)
    categories = payload.get("categories")
    if not isinstance(categories, list):
        _fail("categories must be a list")
    seen: set[str] = set()
    for category in categories:
        if not isinstance(category, dict):
            _fail("each category must be an object")
        name = category.get("name")
        seen.add(str(name))
        if name not in REQUIRED_CATEGORIES:
            _fail(f"unknown evidence category: {name}")
        if category.get("status") != "PASS":
            _fail(f"category {name} is not PASS")
        scenarios = category.get("scenarios")
        if not isinstance(scenarios, list):
            _fail(f"category {name} scenarios must be a list")
        scenario_names = {str(item.get("name")) for item in scenarios if isinstance(item, dict)}
        missing = REQUIRED_SCENARIOS[name] - scenario_names
        if missing:
            _fail(f"category {name} missing scenarios: {sorted(missing)}")
        if any(item.get("status") != "PASS" for item in scenarios if isinstance(item, dict)):
            _fail(f"category {name} contains a non-PASS scenario")
        for item in scenarios:
            if not isinstance(item, dict) or not item.get("evidence_ref"):
                _fail(f"category {name} has a scenario without evidence_ref")

    missing_categories = REQUIRED_CATEGORIES - seen
    if missing_categories:
        _fail(f"missing evidence categories: {sorted(missing_categories)}")

    attestation = payload.get("environment_attestation")
    if not isinstance(attestation, dict):
        _fail("environment_attestation is required")
    for key in ("target_base_url", "python_base_url", "image_digest", "sbom_sha256", "provider_config_hash"):
        if not attestation.get(key):
            _fail(f"environment_attestation.{key} is required")
    _check_url("target_base_url", str(attestation["target_base_url"]), require_https=require_live)
    _check_url("python_base_url", str(attestation["python_base_url"]), require_https=require_live)
    if not re.fullmatch(r"sha256:[0-9a-f]{64}", str(attestation["image_digest"])):
        _fail("image_digest must be an immutable sha256 digest")
    if not re.fullmatch(r"[0-9a-f]{64}", str(attestation["sbom_sha256"])):
        _fail("sbom_sha256 must be a SHA-256 digest")
    if not re.fullmatch(r"[0-9a-f]{64}", str(attestation["provider_config_hash"])):
        _fail("provider_config_hash must be a SHA-256 digest")

    if require_live and os.getenv("ALLOW_LIVE_PROVIDER_VERIFY", "false").lower() != "true":
        _fail("live validation requires ALLOW_LIVE_PROVIDER_VERIFY=true")

    return {
        "status": "PASS",
        "schema": payload["schema"],
        "run_id": payload["run_id"],
        "git_commit": payload["git_commit"],
        "categories": sorted(seen),
        "bundle_sha256": hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest(),
        "live_validation": require_live,
    }


def plan() -> dict:
    return {
        "schema": "tayari.staging-evidence.v1",
        "mutates_external_state": False,
        "live_calls_by_default": False,
        "required_categories": sorted(REQUIRED_CATEGORIES),
        "required_scenarios": {key: sorted(value) for key, value in REQUIRED_SCENARIOS.items()},
        "required_environment_attestation": [
            "target_base_url",
            "python_base_url",
            "image_digest",
            "sbom_sha256",
            "provider_config_hash",
        ],
        "promotion_rule": "unknown or missing evidence remains disabled",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", action="store_true", help="print requirements without reading a bundle")
    parser.add_argument("--bundle", type=Path, help="redacted staging evidence JSON")
    parser.add_argument("--require-live", action="store_true", help="require live-provider authorization and HTTPS endpoints")
    args = parser.parse_args()
    try:
        if args.plan:
            print(json.dumps(plan(), indent=2, sort_keys=True))
            return 0
        if not args.bundle:
            _fail("--bundle is required unless --plan is used")
        result = validate_bundle(_load(args.bundle), require_live=args.require_live)
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0
    except ValueError as exc:
        print(json.dumps({"status": "FAIL", "error": str(exc)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
