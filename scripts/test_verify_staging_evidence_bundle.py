"""Tests for verify_staging_evidence_bundle.py

Covers:
- REL-002 fix: synthetic/placeholder attestations are rejected in production mode
- Development mode remains permissive for bundles marked synthetic=true
- Each individual rejection reason is tested explicitly
"""
from __future__ import annotations

import sys
import os

import pytest

sys.path.insert(0, os.path.dirname(__file__))

from verify_staging_evidence_bundle import validate_bundle, _SYNTHETIC_ENVIRONMENTS


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_minimal_category(name: str) -> dict:
    """Return a minimal passing category entry for the given name."""
    from verify_staging_evidence_bundle import REQUIRED_SCENARIOS
    scenarios = [
        {"name": scenario, "status": "PASS", "evidence_ref": scenario}
        for scenario in REQUIRED_SCENARIOS[name]
    ]
    return {"name": name, "status": "PASS", "scenarios": scenarios}


def _all_categories() -> list:
    from verify_staging_evidence_bundle import REQUIRED_CATEGORIES
    return [_make_minimal_category(cat) for cat in sorted(REQUIRED_CATEGORIES)]


# A realistic-looking SHA-256 hash (not all-zero or all-one).
_REAL_HASH = "a3f1e7c2d4b9083e5f2c1a6d7890bcef1234567890abcdef1234567890abcdef"
_REAL_IMAGE_DIGEST = f"sha256:{_REAL_HASH}"
_REAL_GIT_COMMIT = "deadbeef" * 5  # 40 hex chars


def _synthetic_bundle() -> dict:
    """Return a bundle that looks like it came from run_staging_hostile_suite.py:
    all-zero image hash, all-one sbom hash, example.com URLs, dev environment.
    """
    return {
        "schema": "tayari.staging-evidence.v1",
        "run_id": "00000000-0000-0000-0000-000000000001",
        "generated_at": "2026-08-24T00:00:00+00:00",
        "environment": "staging-hostile-verification",
        "synthetic": True,
        "status": "PASS",
        "git_commit": _REAL_GIT_COMMIT,
        "operator_attestation": "Automated staging hostile suite executed in local test mode.",
        "categories": _all_categories(),
        "environment_attestation": {
            "target_base_url": "http://tayari-staging.example.com",
            "python_base_url": "http://tayari-staging-python.example.com",
            "image_digest": "sha256:" + "0" * 64,
            "sbom_sha256": "1" * 64,
            "provider_config_hash": "2" * 64,
        },
    }


def _production_bundle() -> dict:
    """Return a bundle that looks like a real production/staging deployment."""
    return {
        "schema": "tayari.staging-evidence.v1",
        "run_id": "11111111-1111-1111-1111-111111111111",
        "generated_at": "2026-08-24T00:00:00+00:00",
        "environment": "staging",
        "status": "PASS",
        "git_commit": _REAL_GIT_COMMIT,
        "operator_attestation": "Real staging run on 2026-08-24.",
        "categories": _all_categories(),
        "environment_attestation": {
            "target_base_url": "https://staging.jobtayari.com",
            "python_base_url": "https://staging-api.jobtayari.com",
            "image_digest": _REAL_IMAGE_DIGEST,
            "sbom_sha256": _REAL_HASH,
            "provider_config_hash": _REAL_HASH,
        },
    }


# ---------------------------------------------------------------------------
# Test 1: Synthetic bundle FAILS in production mode
# ---------------------------------------------------------------------------

class TestProductionModeRejectsSyntheticBundle:
    """A genuine-looking synthetic bundle (from the hostile suite) must fail in
    production mode for all three rejection reasons combined."""

    def test_synthetic_bundle_fails_in_production_mode(self):
        bundle = _synthetic_bundle()
        with pytest.raises(ValueError, match="production mode requires environment"):
            validate_bundle(bundle, require_live=False, production_mode=True)

    def test_synthetic_bundle_with_production_env_still_rejected_if_synthetic_true(self):
        """Even if environment is 'staging', marking synthetic=true must be rejected."""
        bundle = _production_bundle()
        bundle["synthetic"] = True
        with pytest.raises(ValueError, match="synthetic=true"):
            validate_bundle(bundle, require_live=False, production_mode=True)


# ---------------------------------------------------------------------------
# Test 2: Synthetic bundle PASSES in development mode
# ---------------------------------------------------------------------------

class TestDevelopmentModeAcceptsSyntheticBundle:
    """The same synthetic bundle must pass validation in development mode when
    it is marked synthetic=true."""

    def test_synthetic_bundle_passes_in_development_mode(self):
        bundle = _synthetic_bundle()
        result = validate_bundle(bundle, require_live=False, production_mode=False)
        assert result["status"] == "PASS"
        assert result["synthetic"] is True
        assert result["production_mode"] is False

    def test_staging_hostile_verification_env_passes_dev_mode(self):
        bundle = _synthetic_bundle()
        result = validate_bundle(bundle, require_live=False, production_mode=False)
        assert result["status"] == "PASS"


# ---------------------------------------------------------------------------
# Test 3: Properly formed production bundle PASSES in production mode
# ---------------------------------------------------------------------------

class TestProductionModeAcceptsRealBundle:
    def test_real_bundle_passes_production_mode(self):
        bundle = _production_bundle()
        result = validate_bundle(bundle, require_live=False, production_mode=True)
        assert result["status"] == "PASS"
        assert result["production_mode"] is True
        assert result["synthetic"] is False

    def test_real_bundle_passes_development_mode(self):
        bundle = _production_bundle()
        result = validate_bundle(bundle, require_live=False, production_mode=False)
        assert result["status"] == "PASS"


# ---------------------------------------------------------------------------
# Test 4: Individual rejection reasons in production mode
# ---------------------------------------------------------------------------

class TestProductionModeIndividualRejections:
    """Each rejection reason must fire independently and clearly."""

    def test_rejects_development_environment_label(self):
        bundle = _production_bundle()
        bundle["environment"] = "development"
        with pytest.raises(ValueError, match="production mode requires environment"):
            validate_bundle(bundle, require_live=False, production_mode=True)

    def test_rejects_staging_hostile_verification_environment_label(self):
        bundle = _production_bundle()
        bundle["environment"] = "staging-hostile-verification"
        with pytest.raises(ValueError, match="production mode requires environment"):
            validate_bundle(bundle, require_live=False, production_mode=True)

    def test_rejects_local_environment_label(self):
        bundle = _production_bundle()
        bundle["environment"] = "local"
        with pytest.raises(ValueError, match="production mode requires environment"):
            validate_bundle(bundle, require_live=False, production_mode=True)

    def test_rejects_test_environment_label(self):
        bundle = _production_bundle()
        bundle["environment"] = "test"
        with pytest.raises(ValueError, match="production mode requires environment"):
            validate_bundle(bundle, require_live=False, production_mode=True)

    def test_rejects_all_zero_image_digest(self):
        bundle = _production_bundle()
        bundle["environment_attestation"]["image_digest"] = "sha256:" + "0" * 64
        with pytest.raises(ValueError, match="placeholder/synthetic hash"):
            validate_bundle(bundle, require_live=False, production_mode=True)

    def test_rejects_all_one_sbom_sha256(self):
        bundle = _production_bundle()
        bundle["environment_attestation"]["sbom_sha256"] = "1" * 64
        with pytest.raises(ValueError, match="placeholder/synthetic hash"):
            validate_bundle(bundle, require_live=False, production_mode=True)

    def test_rejects_all_zero_provider_config_hash(self):
        bundle = _production_bundle()
        bundle["environment_attestation"]["provider_config_hash"] = "0" * 64
        with pytest.raises(ValueError, match="placeholder/synthetic hash"):
            validate_bundle(bundle, require_live=False, production_mode=True)

    def test_rejects_example_com_in_target_url(self):
        bundle = _production_bundle()
        bundle["environment_attestation"]["target_base_url"] = "https://tayari-staging.example.com"
        with pytest.raises(ValueError, match="non-production URL marker"):
            validate_bundle(bundle, require_live=False, production_mode=True)

    def test_rejects_example_com_in_python_url(self):
        bundle = _production_bundle()
        bundle["environment_attestation"]["python_base_url"] = "https://tayari-staging-python.example.com"
        with pytest.raises(ValueError, match="non-production URL marker"):
            validate_bundle(bundle, require_live=False, production_mode=True)

    def test_rejects_localhost_url_in_production_mode(self):
        # localhost is caught by _check_url (private/local endpoint) in all modes.
        bundle = _production_bundle()
        bundle["environment_attestation"]["target_base_url"] = "http://localhost:8080"
        with pytest.raises(ValueError, match="local/private|non-production URL marker"):
            validate_bundle(bundle, require_live=False, production_mode=True)

    def test_rejects_ci_subdomain_url_in_production_mode(self):
        bundle = _production_bundle()
        bundle["environment_attestation"]["target_base_url"] = "https://ci.jobtayari.com"
        with pytest.raises(ValueError, match="non-production URL marker"):
            validate_bundle(bundle, require_live=False, production_mode=True)

    def test_rejects_supabase_co_url_in_production_mode(self):
        bundle = _production_bundle()
        bundle["environment_attestation"]["python_base_url"] = "https://xyzxyz.supabase.co/functions/v1"
        with pytest.raises(ValueError, match="non-production URL marker"):
            validate_bundle(bundle, require_live=False, production_mode=True)

    def test_two_repeated_chars_not_treated_as_placeholder(self):
        """'2' * 64 (used for provider_config_hash in the runner) is NOT
        an all-zero or all-one sentinel and must be accepted in production mode."""
        bundle = _production_bundle()
        bundle["environment_attestation"]["provider_config_hash"] = "2" * 64
        # Should pass — only 0×64 and 1×64 are sentinels
        result = validate_bundle(bundle, require_live=False, production_mode=True)
        assert result["status"] == "PASS"


# ---------------------------------------------------------------------------
# Test 5: Development mode does NOT apply strict production checks
# ---------------------------------------------------------------------------

class TestDevelopmentModePermissive:
    def test_dev_mode_accepts_zero_hash(self):
        bundle = _synthetic_bundle()
        # Zero hashes and example.com URLs are fine in dev mode
        result = validate_bundle(bundle, require_live=False, production_mode=False)
        assert result["status"] == "PASS"

    def test_dev_mode_accepts_one_hash(self):
        bundle = _synthetic_bundle()
        bundle["environment_attestation"]["sbom_sha256"] = "1" * 64
        result = validate_bundle(bundle, require_live=False, production_mode=False)
        assert result["status"] == "PASS"

    def test_dev_mode_accepts_example_com_url(self):
        bundle = _synthetic_bundle()
        bundle["environment_attestation"]["target_base_url"] = "http://tayari-staging.example.com"
        result = validate_bundle(bundle, require_live=False, production_mode=False)
        assert result["status"] == "PASS"
