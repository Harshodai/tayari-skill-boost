#!/usr/bin/env python3
"""Validate staging configuration for optional Firecrawl and Apify research.

This script reports only variable names and configuration state. It never prints
secret values. Disabled providers are valid; enabled providers must be complete
and must use the approved hosted endpoint.
"""
from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass
from urllib.parse import urlparse


@dataclass(frozen=True)
class Check:
    provider: str
    status: str
    detail: str


def present(name: str) -> bool:
    return bool(os.getenv(name, "").strip())


def exact_https_url(name: str, expected: str) -> bool:
    raw = os.getenv(name, "").strip().rstrip("/")
    parsed = urlparse(raw)
    return raw == expected and parsed.scheme == "https" and not parsed.username and not parsed.password


def provider_enabled(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


def validate_firecrawl() -> Check:
    if not provider_enabled("CAPABILITY_WORKSPACE_EXTERNAL_RESEARCH"):
        return Check("firecrawl", "disabled", "CAPABILITY_WORKSPACE_EXTERNAL_RESEARCH is not enabled")
    missing = [name for name in ("FIRECRAWL_API_KEY",) if not present(name)]
    if missing:
        return Check("firecrawl", "fail", f"missing required variables: {', '.join(missing)}")
    if not exact_https_url("FIRECRAWL_API_BASE_URL", "https://api.firecrawl.dev/v1"):
        return Check("firecrawl", "fail", "FIRECRAWL_API_BASE_URL must equal the approved HTTPS endpoint")
    return Check("firecrawl", "pass", "enabled with approved endpoint and key present")


def validate_apify() -> Check:
    if not provider_enabled("CAPABILITY_WORKSPACE_EXTERNAL_RESEARCH"):
        return Check("apify", "disabled", "CAPABILITY_WORKSPACE_EXTERNAL_RESEARCH is not enabled")
    missing = [name for name in ("APIFY_API_TOKEN", "APIFY_RESEARCH_ACTOR_ID", "APIFY_ALLOWED_ACTORS") if not present(name)]
    if missing:
        return Check("apify", "fail", f"missing required variables: {', '.join(missing)}")
    if not exact_https_url("APIFY_API_BASE_URL", "https://api.apify.com/v2"):
        return Check("apify", "fail", "APIFY_API_BASE_URL must equal the approved HTTPS endpoint")
    actor = os.getenv("APIFY_RESEARCH_ACTOR_ID", "").strip()
    actors = {value.strip() for value in os.getenv("APIFY_ALLOWED_ACTORS", "").split(",") if value.strip()}
    if actor not in actors:
        return Check("apify", "fail", "APIFY_RESEARCH_ACTOR_ID is not present in APIFY_ALLOWED_ACTORS")
    return Check("apify", "pass", "enabled with approved endpoint, key, and allowlisted Actor")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--provider", choices=("firecrawl", "apify", "all"), default="all")
    parser.add_argument("--require-enabled", action="store_true")
    args = parser.parse_args()
    checks = []
    if args.provider in {"firecrawl", "all"}:
        checks.append(validate_firecrawl())
    if args.provider in {"apify", "all"}:
        checks.append(validate_apify())
    for check in checks:
        print(f"{check.provider}: {check.status} — {check.detail}")
    if any(check.status == "fail" for check in checks):
        return 1
    if args.require_enabled and any(check.status == "disabled" for check in checks):
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
