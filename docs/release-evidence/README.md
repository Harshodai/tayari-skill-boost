# Release Evidence — Provider Readiness

This directory stores machine-generated provider-readiness evidence bundles
that are **required before any environment promotion** (staging → production
or pre-release → GA).

---

## Required artifact: `provider-readiness-YYYYMMDD.json`

| Field           | Value                                   |
|-----------------|-----------------------------------------|
| Generator       | `scripts/release_provider_check.sh`     |
| Source verifier | `scripts/live_provider_verify.py`       |
| Format          | JSON (schema_version=1)                 |
| Must be present | Yes — promotion is blocked without it   |

### How to generate

```bash
# Full live check (requires credentials and running services):
ALLOW_LIVE_PROVIDER_VERIFY=true \
  TARGET_BASE_URL=https://api.tayari.ai \
  PYTHON_BASE_URL=https://ai.tayari.ai \
  bash scripts/release_provider_check.sh --environment staging
```

```bash
# Offline/dry-run (CI without provider keys — expected blocked_by_policy is OK):
bash scripts/release_provider_check.sh --dry-run --environment local
```

The script exits **0** only when all REQUIRED providers pass (or when running
in dry-run mode where `blocked_by_policy` is expected). It exits **1** on any
hard failure or REQUIRED-provider degradation.

---

## Provider tiers

| Tier       | Providers                                                        | Gate behaviour                      |
|------------|------------------------------------------------------------------|-------------------------------------|
| **REQUIRED** | `go-gateway`, `python-ai`, `queue`, `supabase`                 | `blocked` or `degraded` → **FAIL**  |
| WARNING    | `llm`, `stripe`, `firecrawl`, `apify`, `gmail`, `google-*`, `observability` | `degraded` → warning, not failure  |

A WARNING provider that is `blocked_by_configuration` means the operator has
intentionally not configured that provider for this environment. The bundle
records the reason — reviewers should confirm this is deliberate before
promoting.

---

## Evidence bundle schema

```json
{
  "schema_version": 1,
  "run_id": "<uuid>",
  "environment": "staging",
  "live_execution_enabled": true,
  "generated_at": "2026-08-24T00:00:00+00:00",
  "results": [
    {
      "probe_id": "<uuid>",
      "provider": "go-gateway",
      "check": "health",
      "status": "pass",
      "duration_ms": 42,
      "side_effect": "none",
      ...
    }
  ]
}
```

Status values: `pass` · `degraded` · `blocked_by_configuration` ·
`blocked_by_policy` · `fail`

All probes are **read-only** (`side_effect: none`). No probe mutates user
data, creates billing objects, sends mail, submits an application, or starts
browser automation.

---

## Release checklist (EV-008)

Before promoting to production:

- [ ] Run `scripts/release_provider_check.sh --environment production` with
      `ALLOW_LIVE_PROVIDER_VERIFY=true` and all required credentials set.
- [ ] Confirm exit code 0.
- [ ] Commit the generated `provider-readiness-YYYYMMDD.json` file to this
      directory as part of the release artefact set.
- [ ] Record the `run_id` from the JSON in the promotion PR description.
- [ ] Ensure no REQUIRED provider shows `blocked_by_configuration` —
      resolve configuration gaps before promotion.

> **Note**: A `blocked_by_configuration` on a REQUIRED provider in the evidence
> JSON is an automatic promotion blocker. It must be resolved before the gate
> can pass.

---

## REL-003: SBOM and Provenance Evidence

Build images are produced with `--provenance=true --sbom=true` (both
`build-images.sh` and `.github/workflows/build.yml`). These flags attach SLSA
provenance and SPDX SBOM attestations to every pushed image. The gap addressed
by REL-003 is that the final evidence ledger must contain **real** SBOM hashes
and provenance results — not synthetic placeholders.

### How to generate evidence (required before production promotion)

Before any production promotion:

1. Run `bash scripts/verify_sbom_provenance.sh <image-ref>` for each deployed
   image (use the `@sha256:<digest>` form for immutability):

   ```bash
   bash scripts/verify_sbom_provenance.sh \
     ghcr.io/tayari/go-backend@sha256:<digest>
   bash scripts/verify_sbom_provenance.sh \
     ghcr.io/tayari/python-ai@sha256:<digest>
   bash scripts/verify_sbom_provenance.sh \
     ghcr.io/tayari/frontend@sha256:<digest>
   bash scripts/verify_sbom_provenance.sh \
     ghcr.io/tayari/worker@sha256:<digest>
   ```

2. Each run saves output to this directory as
   `sbom-YYYYMMDD-<short-sha>.json`.

3. Confirm `sbom_hash_sha256` in the saved JSON is non-empty and
   non-zero (the staging evidence verifier with `--mode production` rejects
   all-zero SBOM hashes per REL-002).

4. Confirm `rel003_gate` is `"passed"` in every evidence file before
   promoting the corresponding image.

### Dry-run (CI without registry access)

```bash
bash scripts/verify_sbom_provenance.sh --dry-run
```

Exits 0, prints what would be verified, and touches no external registry.

### Tool requirements

| Tool     | Role                                  | Required? |
|----------|---------------------------------------|-----------|
| `cosign` | Attestation verification (preferred)  | One of cosign/syft |
| `syft`   | Local SBOM generation (fallback)      | One of cosign/syft |
| `grype`  | Vulnerability scan (preferred)        | Recommended |
| `trivy`  | Vulnerability scan (fallback)         | Recommended |

If neither `cosign` nor `syft` is installed, the script exits 1 with:
> `SBOM verification requires syft or cosign — install one and retry`
