#!/usr/bin/env python3
"""Run safe, read-only live-provider verification probes for Tayari.

The verifier is intentionally conservative:
- No probe mutates user data, creates billing objects, sends mail, changes a
  mailbox, submits an application, or starts browser automation.
- Missing credentials are reported as ``blocked_by_configuration`` rather than
  green.
- Live HTTP calls require ``--allow-live`` or ``ALLOW_LIVE_PROVIDER_VERIFY``.
- ``--require-live`` turns blocked/degraded probes into a non-zero exit for CI
  promotion gates.

The output is an evidence bundle that can be persisted by CI or a scheduled
runner. Secrets are never included in the output.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable


READ_ONLY = "none"


@dataclass
class ProbeResult:
    probe_id: str
    provider: str
    check: str
    environment: str
    started_at: str
    duration_ms: int
    status: str
    request_id: str | None = None
    data_classification: str = "synthetic"
    side_effect: str = READ_ONLY
    failure_class: str | None = None
    detail: str | None = None
    evidence: dict[str, Any] = field(default_factory=dict)


class ProbeRunner:
    def __init__(self, environment: str, allow_live: bool, timeout: float = 8.0):
        self.environment = environment
        self.allow_live = allow_live
        self.timeout = timeout
        self.results: list[ProbeResult] = []

    def run(self, provider: str, check: str, fn: Callable[[], dict[str, Any]]) -> None:
        started = datetime.now(timezone.utc)
        started_monotonic = time.monotonic()
        probe_id = str(uuid.uuid4())
        try:
            result = fn()
            status = str(result.pop("status", "pass"))
            detail = result.pop("detail", None)
            failure_class = result.pop("failure_class", None)
            request_id = result.pop("request_id", None)
            evidence = result
        except Exception as exc:  # noqa: BLE001 - probe failures are evidence
            status = "fail"
            detail = type(exc).__name__
            failure_class = "unexpected_probe_error"
            request_id = None
            evidence = {}
        self.results.append(
            ProbeResult(
                probe_id=probe_id,
                provider=provider,
                check=check,
                environment=self.environment,
                started_at=started.isoformat(),
                duration_ms=round((time.monotonic() - started_monotonic) * 1000),
                status=status,
                request_id=request_id,
                failure_class=failure_class,
                detail=detail,
                evidence=evidence,
            )
        )


def safe_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]


def get_json(url: str, headers: dict[str, str], timeout: float) -> tuple[int, dict[str, Any], str | None]:
    request = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read(512 * 1024)
            try:
                body = json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                body = {}
            request_id = response.headers.get("x-request-id") or response.headers.get("stripe-request-id")
            return response.status, body if isinstance(body, dict) else {}, request_id
    except urllib.error.HTTPError as exc:
        raw = exc.read(64 * 1024)
        try:
            body = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            body = {}
        return exc.code, body if isinstance(body, dict) else {}, exc.headers.get("x-request-id")


def blocked(detail: str, failure_class: str = "missing_configuration") -> dict[str, Any]:
    return {"status": "blocked_by_configuration", "detail": detail, "failure_class": failure_class}


def live_blocked() -> dict[str, Any]:
    return {
        "status": "blocked_by_policy",
        "detail": "live HTTP calls require --allow-live or ALLOW_LIVE_PROVIDER_VERIFY=true",
        "failure_class": "live_execution_disabled",
    }


def http_probe(runner: ProbeRunner, provider: str, check: str, url: str, headers: dict[str, str] | None = None) -> None:
    def probe() -> dict[str, Any]:
        if not runner.allow_live:
            return live_blocked()
        status, body, request_id = get_json(url, headers or {}, runner.timeout)
        result: dict[str, Any] = {
            "http_status": status,
            "response_keys": sorted(body.keys())[:40],
            "request_id": request_id,
            "url_hash": safe_hash(url),
        }
        if 200 <= status < 300:
            result["status"] = "pass"
        elif status in {429, 502, 503, 504}:
            result["status"] = "degraded"
            result["failure_class"] = "provider_or_dependency_unavailable"
        else:
            result["status"] = "fail"
            result["failure_class"] = "unexpected_http_status"
        return result

    runner.run(provider, check, probe)


def config_probe(runner: ProbeRunner, provider: str, required: list[str], detail: str) -> None:
    def probe() -> dict[str, Any]:
        missing = [name for name in required if not os.getenv(name, "").strip()]
        if missing:
            return blocked(f"{detail}; missing: {', '.join(missing)}")
        return {
            "status": "pass",
            "detail": detail,
            "configured_variables": required,
        }

    runner.run(provider, "configuration", probe)


def run(environment: str, base_url: str | None, python_base_url: str | None, allow_live: bool, timeout: float) -> list[ProbeResult]:
    runner = ProbeRunner(environment=environment, allow_live=allow_live, timeout=timeout)

    if base_url:
        root = base_url.rstrip("/")
        http_probe(runner, "go-gateway", "health", f"{root}/api/health")
        http_probe(runner, "go-gateway", "readiness", f"{root}/readyz")
    else:
        runner.run("go-gateway", "health", lambda: blocked("TARGET_BASE_URL is not configured"))
        runner.run("go-gateway", "readiness", lambda: blocked("TARGET_BASE_URL is not configured"))

    if python_base_url:
        root = python_base_url.rstrip("/")
        http_probe(runner, "python-ai", "health", f"{root}/health")
        http_probe(runner, "python-ai", "readiness", f"{root}/readyz")
    else:
        runner.run("python-ai", "health", lambda: blocked("PYTHON_BASE_URL is not configured"))
        runner.run("python-ai", "readiness", lambda: blocked("PYTHON_BASE_URL is not configured"))

    provider = os.getenv("LLM_PROVIDER", "").strip().lower()
    if provider == "openrouter":
        config_probe(runner, "llm", ["LLM_PROVIDER", "OPENROUTER_API_KEY", "OPENROUTER_MODEL"], "OpenRouter runtime configuration present")
    elif provider in {"nvidia_nim", "nvidia-nim"}:
        config_probe(runner, "llm", ["LLM_PROVIDER", "NVIDIA_NIM_API_KEY", "NVIDIA_NIM_MODEL"], "NVIDIA NIM runtime configuration present")
    elif provider == "ollama":
        config_probe(runner, "llm", ["LLM_PROVIDER", "LLM_BASE_URL", "LLM_MODEL"], "Ollama runtime configuration present")
    elif provider in {"openai", "anthropic"}:
        key = "OPENAI_API_KEY" if provider == "openai" else "ANTHROPIC_API_KEY"
        config_probe(runner, "llm", ["LLM_PROVIDER", key, "LLM_MODEL"], f"{provider} runtime configuration present")
    else:
        runner.run("llm", "configuration", lambda: blocked("LLM_PROVIDER is not an approved live provider"))

    config_probe(runner, "stripe", ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"], "Stripe credentials and webhook secret present")

    firecrawl_key = os.getenv("FIRECRAWL_API_KEY", "").strip()
    firecrawl_base = os.getenv("FIRECRAWL_API_BASE_URL", "https://api.firecrawl.dev/v1").rstrip("/")
    config_probe(runner, "firecrawl", ["FIRECRAWL_API_KEY"], "Firecrawl API key present")
    if firecrawl_key:
        # Official read-only Firecrawl v2 credit-usage endpoint; no scrape is run.
        firecrawl_usage_base = firecrawl_base[:-3] + "v2" if firecrawl_base.endswith("/v1") else firecrawl_base
        http_probe(
            runner,
            "firecrawl",
            "credit-usage-readiness",
            f"{firecrawl_usage_base}/team/credit-usage",
            headers={"Authorization": f"Bearer {firecrawl_key}"},
        )
    else:
        runner.run("firecrawl", "credit-usage-readiness", lambda: blocked("FIRECRAWL_API_KEY is not configured"))

    apify_token = os.getenv("APIFY_API_TOKEN", "").strip()
    apify_base = os.getenv("APIFY_API_BASE_URL", "https://api.apify.com/v2").rstrip("/")
    config_probe(runner, "apify", ["APIFY_API_TOKEN", "APIFY_RESEARCH_ACTOR_ID", "APIFY_ALLOWED_ACTORS"], "Apify token, actor, and allowlist present")
    if apify_token:
        # Official read-only Apify authenticated-account endpoint.
        http_probe(
            runner,
            "apify",
            "account-readiness",
            f"{apify_base}/users/me",
            headers={"Authorization": f"Bearer {apify_token}"},
        )
    else:
        runner.run("apify", "account-readiness", lambda: blocked("APIFY_API_TOKEN is not configured"))

    stripe_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
    if stripe_key:
        # Official read-only Stripe balance endpoint; no charge or mutation occurs.
        basic = base64.b64encode(f"{stripe_key}:".encode("utf-8")).decode("ascii")
        http_probe(
            runner,
            "stripe",
            "balance-readiness",
            "https://api.stripe.com/v1/balance",
            headers={"Authorization": f"Basic {basic}"},
        )
    else:
        runner.run("stripe", "balance-readiness", lambda: blocked("STRIPE_SECRET_KEY is not configured"))

    config_probe(runner, "gmail", ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GMAIL_PUBSUB_VERIFICATION_TOKEN"], "Gmail OAuth and Pub/Sub verification configuration present")
    gmail_token = os.getenv("GOOGLE_TEST_ACCESS_TOKEN", "").strip()
    if gmail_token:
        http_probe(
            runner,
            "gmail",
            "mailbox-readiness",
            "https://gmail.googleapis.com/gmail/v1/users/me/profile",
            headers={"Authorization": f"Bearer {gmail_token}"},
        )
    else:
        runner.run("gmail", "mailbox-readiness", lambda: blocked("GOOGLE_TEST_ACCESS_TOKEN is not configured"))

    config_probe(runner, "google-calendar", ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"], "Google Calendar OAuth client configuration present")
    if gmail_token:
        http_probe(
            runner,
            "google-calendar",
            "upcoming-events-readiness",
            "https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1&singleEvents=true&orderBy=startTime",
            headers={"Authorization": f"Bearer {gmail_token}"},
        )
    else:
        runner.run("google-calendar", "upcoming-events-readiness", lambda: blocked("GOOGLE_TEST_ACCESS_TOKEN is not configured"))

    config_probe(runner, "google-drive", ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"], "Google Drive OAuth client configuration present")
    if gmail_token:
        http_probe(
            runner,
            "google-drive",
            "about-user-readiness",
            "https://www.googleapis.com/drive/v3/about?fields=user",
            headers={"Authorization": f"Bearer {gmail_token}"},
        )
    else:
        runner.run("google-drive", "about-user-readiness", lambda: blocked("GOOGLE_TEST_ACCESS_TOKEN is not configured"))

    config_probe(runner, "observability", ["SENTRY_DSN", "METRICS_TOKEN"], "Sentry and protected metrics configuration present")
    if base_url and os.getenv("METRICS_TOKEN", "").strip():
        http_probe(
            runner,
            "observability",
            "metrics-readiness",
            f"{base_url.rstrip('/')}/metrics",
            headers={"X-Internal-Token": os.environ["METRICS_TOKEN"]},
        )
    else:
        runner.run("observability", "metrics-readiness", lambda: blocked("TARGET_BASE_URL and METRICS_TOKEN are required for protected metrics proof"))
    config_probe(runner, "queue", ["REDIS_URL", "DATABASE_URL"], "Queue and database runtime configuration present")

    if os.getenv("SUPABASE_URL", "").strip() and os.getenv("SUPABASE_ANON_KEY", "").strip():
        supabase_url = os.environ["SUPABASE_URL"].rstrip("/")
        http_probe(
            runner,
            "supabase",
            "auth-readiness",
            f"{supabase_url}/auth/v1/health",
            headers={"apikey": os.environ["SUPABASE_ANON_KEY"]},
        )
    else:
        runner.run("supabase", "auth-readiness", lambda: blocked("SUPABASE_URL and SUPABASE_ANON_KEY are not configured"))

    return runner.results


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--environment", default=os.getenv("VERIFY_ENVIRONMENT", "local"))
    parser.add_argument("--base-url", default=os.getenv("TARGET_BASE_URL"))
    parser.add_argument("--python-base-url", default=os.getenv("PYTHON_BASE_URL"))
    parser.add_argument("--timeout", type=float, default=float(os.getenv("VERIFY_TIMEOUT_SECONDS", "8")))
    parser.add_argument("--output", type=Path)
    parser.add_argument("--allow-live", action="store_true", default=os.getenv("ALLOW_LIVE_PROVIDER_VERIFY", "false").lower() == "true")
    parser.add_argument("--require-live", action="store_true", help="Fail if any probe is blocked or degraded")
    parser.add_argument(
        "--require-providers",
        default=os.getenv("VERIFY_REQUIRED_PROVIDERS", ""),
        help="Comma-separated providers whose blocked/degraded probes fail the run",
    )
    args = parser.parse_args()

    results = run(args.environment, args.base_url, args.python_base_url, args.allow_live, args.timeout)
    payload = {
        "schema_version": 1,
        "run_id": str(uuid.uuid4()),
        "environment": args.environment,
        "live_execution_enabled": args.allow_live,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "results": [asdict(result) for result in results],
    }
    serialized = json.dumps(payload, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(serialized, encoding="utf-8")
    print(serialized, end="")

    statuses = [result.status for result in results]
    if "fail" in statuses:
        return 1
    required_providers = {
        provider.strip().lower()
        for provider in args.require_providers.split(",")
        if provider.strip()
    }
    required_statuses = {
        result.status
        for result in results
        if result.provider.lower() in required_providers
    }
    blocked_statuses = {"blocked_by_configuration", "blocked_by_policy", "degraded"}
    if args.require_live and any(status in blocked_statuses for status in statuses):
        return 2
    if required_providers and required_statuses & blocked_statuses:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
