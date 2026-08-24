# M6-03 Hostile Staging Validation Runbook

**Status:** Ready for execution; not executed against live staging in the current environment.  
**Scope:** Synthetic tenants and synthetic resumes only. No production URLs, credentials, customer data, or irreversible external actions.  
**Release under test:** Deploy and record one immutable release SHA before beginning.

## Safety contract

Run only against a disposable, environment-separated staging deployment. The runner must refuse an unclassified target. Keep unattended AutoPilot, browser submission, WhatsApp approvals, broad connectors, desktop control, and real external messaging disabled. Use an approved secret manager or ephemeral CI environment injection; never write secrets to `.env`, shell history, repository files, logs, screenshots, or chat.

The repository gate's plan mode is side-effect-free:

```bash
cd /path/to/tayari-skill-boost
./scripts/staging_integration_gate.sh --plan
python3 scripts/run_staging_hostile_suite.py --plan
```

Both commands should declare that they require deployed staging and do not mutate external state. Before a live run, check the target classification explicitly:

```bash
set -Eeuo pipefail
export STAGING_ENVIRONMENT=staging
export STAGING_CONFIRM=I_UNDERSTAND_STAGING_ONLY
case "${TARGET_BASE_URL:?TARGET_BASE_URL must be injected by the staging secret manager}" in
  https://*) ;;
  http://127.0.0.1:*|http://localhost:*) ;;
  *) echo "Refusing non-staging target" >&2; exit 78 ;;
esac
case "$TARGET_BASE_URL" in
  *prod*|*production*) echo "Refusing production-looking target" >&2; exit 78 ;;
esac
```

## Required environment variables

Inject these values only through the approved staging runner. The commands below deliberately do not print values.

```text
STAGING_ENVIRONMENT=staging
STAGING_CONFIRM=I_UNDERSTAND_STAGING_ONLY
TARGET_BASE_URL
PYTHON_BASE_URL
BASE_URL
DATABASE_URL
REDIS_URL
SUPABASE_URL
SUPABASE_ANON_KEY
```

The live gate also accepts `STAGING_EVIDENCE_DIR` and `RUN_HOSTILE_STAGING=true`. Provider-specific non-production variables are required only for capabilities explicitly enabled in the run. The normal launch configuration keeps the following capabilities disabled: unattended submission, browser/computer actions, WhatsApp approvals, broad connectors, and real outbound messaging.

## Preflight commands

```bash
cd /path/to/tayari-skill-boost
set -Eeuo pipefail
export STAGING_ENVIRONMENT=staging
export STAGING_CONFIRM=I_UNDERSTAND_STAGING_ONLY
export RUN_HOSTILE_STAGING=true
export STAGING_EVIDENCE_DIR="${STAGING_EVIDENCE_DIR:-$PWD/test-results/staging-live}"

# Values must already be present from the secret manager; these checks print names only.
for name in TARGET_BASE_URL PYTHON_BASE_URL BASE_URL DATABASE_URL REDIS_URL SUPABASE_URL SUPABASE_ANON_KEY; do
  test -n "${!name:-}" || { echo "missing $name" >&2; exit 78; }
done

# Confirm the checkout and deployment identity without exposing secrets.
git status --short
git rev-parse HEAD
git show -s --format='%H %s' HEAD
./scripts/staging_integration_gate.sh --plan
python3 scripts/run_staging_hostile_suite.py --plan
```

The operator should confirm that the deployed image/app digests, SBOM/provenance, migration manifest, and configuration fingerprint all correspond to the printed release SHA. If the checkout is dirty or the deployed SHA differs, stop before any test.

## Execute the full M6-03 gate

The preferred command runs provider readiness, authenticated backend integration, and hostile staging in the repository-defined order:

```bash
STAGING_ENVIRONMENT=staging \
STAGING_CONFIRM=I_UNDERSTAND_STAGING_ONLY \
TARGET_BASE_URL="$TARGET_BASE_URL" \
PYTHON_BASE_URL="$PYTHON_BASE_URL" \
BASE_URL="$BASE_URL" \
DATABASE_URL="$DATABASE_URL" \
REDIS_URL="$REDIS_URL" \
SUPABASE_URL="$SUPABASE_URL" \
SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
RUN_HOSTILE_STAGING=true \
STAGING_EVIDENCE_DIR="$STAGING_EVIDENCE_DIR" \
./scripts/staging_integration_gate.sh
```

The gate must stop before backend integration if strict provider readiness fails. Expected live evidence includes a redacted summary, provider-readiness JSON, backend integration log, and hostile-suite log under `test-results/staging-live/`. Exit `0` means the configured gate passed; exit `1` means a configured live check failed; exit `78` means target/attestation/configuration validation blocked execution.

## Important limitation of the current hostile suite

The existing `scripts/run_staging_hostile_suite.py` is a **synthetic/local contract suite**. It uses Starlette `TestClient`, local application imports, simulated Go rate-limit logic, and in-process RLS examples; its `TARGET_BASE_URL` and `PYTHON_BASE_URL` values are recorded as attestation metadata but are not used to drive all scenarios over the deployed network. It is valuable regression coverage, but it is **not sufficient by itself to close M6-03**.

A real M6-03 acceptance run must therefore include both the repository suite below and real HTTP/database/worker/observability probes from the approved staging runner. The real run must record the deployed target, two disposable authenticated users/tenants, request IDs, service logs, metrics/traces, queue/worker events, and operator observations. Do not mark M6-03 complete from the synthetic JSON alone.

## Synthetic regression command

If the staging gate has already passed provider readiness and the operator needs to rerun the repository hostile regression suite, execute it from the same approved runner:

```bash
cd /path/to/tayari-skill-boost
PYTHONPATH=backend/python \
STAGING_ENVIRONMENT=staging \
STAGING_CONFIRM=I_UNDERSTAND_STAGING_ONLY \
TARGET_BASE_URL="$TARGET_BASE_URL" \
PYTHON_BASE_URL="$PYTHON_BASE_URL" \
python3 scripts/run_staging_hostile_suite.py
```

This suite covers six categories: rate-limit/flood protection, SSRF/private-IP blocking, prompt-injection guardrails, two-tenant isolation negatives, kill-switch deadline, and account-deletion/privacy purge. Its output is synthetic regression evidence. Pair it with real deployed probes and operational evidence before production certification.

## Evidence acceptance

After execution, validate the redacted bundle and inspect all scenarios rather than relying only on the process exit code:

```bash
python3 scripts/verify_staging_evidence_bundle.py \
  --bundle "$STAGING_EVIDENCE_DIR/staging_hostile_evidence.json" \
  --require-live \
  --mode production
```

The production verifier must reject synthetic/placeholder attestations, example/localhost URLs, and non-production labels. Preserve the exact deployed SHA, image digests, SBOM/provenance references, timestamps, environment attestation, category results, scenario results, and operator identity in the release evidence store.

For the recovery portion of M6-03, use the separate restore evidence contract after creating a disposable managed restore target:

```bash
python3 scripts/verify_recovery_evidence.py --plan
python3 scripts/verify_recovery_evidence.py --evidence /secure/redacted/recovery-evidence.json
```

Do not mark M6-03 complete if the hostile suite is synthetic-only, if the bundle is missing live attestation, if any scenario is skipped without an approved scope reason, or if backup/restore/rollback evidence is absent.

## Scenario acceptance table

| Category | Required negative/positive proof | Evidence to retain |
|---|---|---|
| Flood/rate limits | Same identity exceeds public and authenticated limits; expensive handler is not entered; legitimate second tenant remains usable. | Status sequence, `Retry-After`, request IDs, metrics, and handler counter. |
| SSRF | Loopback, RFC-1918, metadata IP, IPv6 loopback, invalid schemes, redirect-to-private, and DNS-rebinding attempts are blocked; safe HTTPS URL remains allowed. | Target class, resolved address, decision, and redacted logs. |
| Prompt injection | Hostile provider/page text cannot override system policy, exfiltrate secrets, mutate unknown fields, or authorize submission. Benign text remains usable. | Guard result, matched policy, user-visible safe outcome. |
| Tenant isolation | Tenant A cannot read/mutate Tenant B profiles, resumes, jobs, applications, approvals, receipts, tasks, or logs; owner access works. | Two synthetic identities, SQL/PostgREST result, HTTP status, and RLS evidence. |
| Kill switch | Owner cancellation terminates browser/worker/queue activity within the defined deadline; foreign cancellation is denied; retry is safe. | Cancellation request/ack, elapsed time, session state, worker events. |
| Deletion/privacy | Account purge is authorized, idempotent, bounded, and covers relational rows, artifacts, runtime state, screenshots, queues, logs, and privacy ledger. | Before/after counts, purge receipt, redaction check, and failure handling. |
| Recovery/rollback | Restore into a disposable target, verify checksums and required rows, measure RPO/RTO, roll back an immutable deployment, and run post-rollback smoke. | Backup ID, restore target, timing, checksums, approval, and smoke results. |

## Stop conditions

Stop immediately if the target resolves to production, credentials are requested in an unsafe channel, the target cannot prove staging classification, a service reports false readiness, a cross-tenant read succeeds, an approval is replayable, a kill switch exceeds its deadline, a deletion purge is partial without an explicit failure, or an external action would send real data. Preserve the evidence as a failed/blocked run and keep the affected capability disabled.
