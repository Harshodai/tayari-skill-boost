# Job Tayari Synthetic Ghost Users

This directory contains a **synthetic health and read-only candidate journey** for k6. It is designed to measure the service without creating users, mutating customer data, consuming production entitlements, sending emails, or submitting applications.

## Safety contract

Run this against development or staging by default. Do not provide a production token. If `SYNTHETIC_ACCESS_TOKEN` is set, the script performs only the verified read-only routes in the script and uses a short-lived staging token supplied by the operator. It never signs up a user and never calls billing, receipt creation, browser automation, external job boards, email, or destructive routes.

The script tags requests with a bounded cohort and run ID. Do not log the token or include résumés, credentials, raw job descriptions, cookies, or prompts in load-test output.

## Run locally

```bash
k6 run \
  --env BASE_URL=http://127.0.0.1:8085 \
  --env RAMP_VUS=2 \
  --env HOLD_SECONDS=30 \
  --env RAMP_SECONDS=15 \
  perf/k6/synthetic.js
```

## Run against staging

```bash
SYNTHETIC_ACCESS_TOKEN='<short-lived-staging-token>' \
BASE_URL='https://staging.example.invalid' \
RAMP_VUS=5 \
HOLD_SECONDS=120 \
RAMP_SECONDS=60 \
REQUIRE_REQUEST_ID=true \
k6 run perf/k6/synthetic.js
```

The placeholder host is intentional. Replace it only with an approved staging endpoint. Production probes require explicit approval, a rate limit, read-only credentials if needed, and a separate dashboard label.

## Signals to retain

Retain the k6 summary and the server-side correlated telemetry for each run: HTTP p50/p95/p99, error rate, checks rate, status classes, request IDs, pod/resource metrics, database/Redis health, and release/image/model identifiers. For authenticated staging runs, also retain the synthetic cohort and run ID. Never interpret synthetic success as customer traction or a guarantee of production availability.

## Planned extensions

The next safe additions are a mock job-board fixture for browser ghosts, a test-mode receipt route with idempotency assertions, and a model golden-corpus runner. Each must be isolated from production credentials and external actions before it is scheduled in Kubernetes.
