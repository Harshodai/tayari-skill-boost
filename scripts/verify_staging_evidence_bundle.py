#!/usr/bin/env python3
"""Validate a no-secrets staging evidence bundle for JobTayari promotion.

This tool does not call providers by default. It validates operator-supplied,
redacted evidence produced by real staging runs and fails closed when required
categories, scenario results, or environment attestations are missing.

Modes
-----
development (default)
    Permissive: accepts staging-hostile-verification / development environment
    labels, placeholder hashes, and example.com URLs.  Bundles marked
    ``synthetic=true`` are always accepted in this mode.

production
    Strict promotion gate: rejects synthetic/placeholder bundles, all-zero or
    all-one SHA-256 hashes, example/localhost URLs, and any non-production
    environment label.  Use this mode for real promotion checks.
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
    "rate_limit_flood_protection",
    "ssrf_private_ip_blocking",
    "prompt_injection_guardrails",
    "two_tenant_rls_isolation",
    "kill_switch_deadline_verification",
    "account_deletion_privacy_purge",
}

# Environments that are only valid in development/synthetic mode.
_SYNTHETIC_ENVIRONMENTS = {
    "staging-hostile-verification",
    "development",
    "local",
    "test",
}
# Production environments that are accepted in --mode=production.
_PRODUCTION_ENVIRONMENTS = {"staging", "final-staging", "production"}
# Sentinel hashes that signal placeholder/synthetic values (all-zero or all-one).
_PLACEHOLDER_HASH_PATTERNS = (
    re.compile(r"^0{64}$"),
    re.compile(r"^1{64}$"),
    re.compile(r"^sha256:0{64}$"),
    re.compile(r"^sha256:1{64}$"),
)
# URL substrings that betray a non-production deployment target.
_SYNTHETIC_URL_PATTERNS = (
    "example.com",
    "localhost",
    "127.0.0.1",
    "::1",
    "ci.",
    ".supabase.co",
)

REQUIRED_SCENARIOS = {
    "rate_limit_flood_protection": {
        "python_ats_score_flood_429_verification",
        "go_gateway_auth_login_flood_429_verification",
    },
    "ssrf_private_ip_blocking": {
        "probe_ipv4_loopback_explicit_port",
        "probe_ipv4_loopback_standard",
        "probe_localhost_hostname",
        "probe_aws_metadata_imds_ip",
        "probe_rfc1918_class_a_private",
        "probe_rfc1918_class_b_private",
        "probe_rfc1918_class_c_private",
        "probe_ipv6_loopback",
        "probe_unspecified_bind_address",
        "probe_broadcast_alias",
        "probe_invalid_scheme_file",
        "probe_invalid_scheme_gopher",
        "probe_public_valid_domain",
    },
    "prompt_injection_guardrails": {
        "payload_delimiter_breakout_attack",
        "payload_instruction_override_disregard_rules",
        "payload_secret_exfiltration_password_steal",
        "payload_system_prompt_leak_attempt",
        "payload_covert_credential_post_instruction",
        "payload_unicode_nfkc_escaped_injection",
        "payload_action_pattern_approval_click",
        "payload_benign_resume_text",
        "fencing_delimiter_neutralization",
        "typst_markup_injection_escaped",
    },
    "two_tenant_rls_isolation": {
        "user_a_read_user_b_profile_rls_rejected",
        "user_a_update_user_b_resume_rls_rejected",
        "tenant_a_advisor_access_tenant_b_cohorts_forbidden",
        "user_a_query_applications_no_cross_tenant_leakage",
    },
    "kill_switch_deadline_verification": {
        "foreign_candidate_kill_switch_rejected",
        "kill_switch_under_5s_deadline_verified",
    },
    "account_deletion_privacy_purge": {
        "runtime_purge_internal_token_boundary",
        "cascade_deletion_covers_all_personal_tables",
        "privacy_ledger_user_log_purged",
    },
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


def _check_not_placeholder_hash(name: str, value: str) -> None:
    """Reject sentinel hashes (all-zero or all-one) in production mode."""
    for pat in _PLACEHOLDER_HASH_PATTERNS:
        if pat.fullmatch(value):
            _fail(
                f"environment_attestation.{name} is a placeholder/synthetic hash "
                f"({value!r}); production bundles require real digest values"
            )


def _check_not_synthetic_url(name: str, value: str) -> None:
    """Reject URLs that contain markers of non-production deployments."""
    lower = value.lower()
    for marker in _SYNTHETIC_URL_PATTERNS:
        if marker in lower:
            _fail(
                f"environment_attestation.{name} ({value!r}) contains a "
                f"non-production URL marker ({marker!r}); production bundles must "
                f"reference real deployment targets"
            )


def validate_bundle(payload: dict, *, require_live: bool, production_mode: bool = False) -> dict:
    if payload.get("schema") != "tayari.staging-evidence.v1":
        _fail("unsupported evidence schema; expected tayari.staging-evidence.v1")
    if payload.get("status") != "PASS":
        _fail("evidence bundle status must be PASS")

    env = payload.get("environment", "")
    is_synthetic = bool(payload.get("synthetic"))

    if production_mode:
        # Strict gate: bundles claiming a non-production environment are rejected.
        if env not in _PRODUCTION_ENVIRONMENTS:
            _fail(
                f"production mode requires environment to be one of "
                f"{sorted(_PRODUCTION_ENVIRONMENTS)!r}; got {env!r}. "
                f"If this is a local test run, use --mode=development or add "
                f"synthetic=true to the bundle and re-run without --mode=production."
            )
        # Synthetic bundles must never pass a production promotion gate.
        if is_synthetic:
            _fail(
                "production mode rejects bundles marked synthetic=true; "
                "synthetic bundles are only valid in development mode"
            )
    else:
        # Development mode: accept staging-hostile-verification / development but
        # reject anything truly unknown.
        all_known = _PRODUCTION_ENVIRONMENTS | _SYNTHETIC_ENVIRONMENTS
        if env not in all_known:
            _fail(f"evidence bundle must identify a known environment; got {env!r}")

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
    _check_url("target_base_url", str(attestation["target_base_url"]), require_https=False)
    _check_url("python_base_url", str(attestation["python_base_url"]), require_https=False)
    if not re.fullmatch(r"sha256:[0-9a-f]{64}", str(attestation["image_digest"])):
        _fail("image_digest must be an immutable sha256 digest")
    if not re.fullmatch(r"[0-9a-f]{64}", str(attestation["sbom_sha256"])):
        _fail("sbom_sha256 must be a SHA-256 digest")
    if not re.fullmatch(r"[0-9a-f]{64}", str(attestation["provider_config_hash"])):
        _fail("provider_config_hash must be a SHA-256 digest")

    if production_mode:
        # In production mode apply the additional strict attestation checks.
        _check_not_placeholder_hash("image_digest", str(attestation["image_digest"]))
        _check_not_placeholder_hash("sbom_sha256", str(attestation["sbom_sha256"]))
        _check_not_placeholder_hash("provider_config_hash", str(attestation["provider_config_hash"]))
        _check_not_synthetic_url("target_base_url", str(attestation["target_base_url"]))
        _check_not_synthetic_url("python_base_url", str(attestation["python_base_url"]))

    if require_live and os.getenv("ALLOW_LIVE_PROVIDER_VERIFY", "false").lower() != "true":
        _fail("live validation requires ALLOW_LIVE_PROVIDER_VERIFY=true")

    return {
        "status": "PASS",
        "schema": payload["schema"],
        "run_id": payload["run_id"],
        "git_commit": payload["git_commit"],
        "environment": env,
        "synthetic": is_synthetic,
        "production_mode": production_mode,
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
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--plan", action="store_true", help="print requirements without reading a bundle")
    parser.add_argument("--bundle", type=Path, help="redacted staging evidence JSON")
    parser.add_argument("--require-live", action="store_true", help="require live-provider authorization and HTTPS endpoints")
    parser.add_argument(
        "--mode",
        choices=["development", "production"],
        default="development",
        help=(
            "Validation mode: 'development' (default) is permissive and accepts "
            "staging-hostile-verification / development environment labels, placeholder "
            "hashes, and example.com URLs. 'production' is the strict promotion gate that "
            "rejects any synthetic/placeholder attestation."
        ),
    )
    args = parser.parse_args()
    production_mode = args.mode == "production"
    try:
        if args.plan:
            print(json.dumps(plan(), indent=2, sort_keys=True))
            return 0
        if not args.bundle:
            _fail("--bundle is required unless --plan is used")
        result = validate_bundle(_load(args.bundle), require_live=args.require_live, production_mode=production_mode)
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0
    except ValueError as exc:
        print(json.dumps({"status": "FAIL", "error": str(exc)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
