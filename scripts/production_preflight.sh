#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_SHA="${RELEASE_SHA:-$(git -C "$ROOT_DIR" rev-parse HEAD)}"
OUT_DIR="${RELEASE_EVIDENCE_DIR:-$ROOT_DIR/.release-evidence/$RELEASE_SHA}"
mkdir -p "$OUT_DIR"

if [[ ! "$RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "RELEASE_SHA must be a full 40-character Git SHA" >&2
  exit 2
fi

if [[ "$(git -C "$ROOT_DIR" status --porcelain)" != "" ]]; then
  echo "Working tree must be clean before release preflight" >&2
  git -C "$ROOT_DIR" status --short >&2
  exit 3
fi

if [[ "${AUTONOMOUS_SUBMIT_ENABLED:-false}" != "false" ]]; then
  echo "AUTONOMOUS_SUBMIT_ENABLED must remain false" >&2
  exit 4
fi

{
  printf 'release_sha=%s\n' "$RELEASE_SHA"
  printf 'branch=%s\n' "$(git -C "$ROOT_DIR" branch --show-current)"
  printf 'origin_main=%s\n' "$(git -C "$ROOT_DIR" rev-parse origin/main 2>/dev/null || echo unavailable)"
  printf 'generated_at_utc=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'working_tree=clean\n'
  printf 'autonomous_submit_enabled=false\n'
} > "$OUT_DIR/release-identity.txt"

cat > "$OUT_DIR/evidence-index-template.md" <<EOF
# Release Evidence Index

- Release SHA: $RELEASE_SHA
- Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)
- Images and immutable digests: PENDING
- SBOM/provenance/attestation: PENDING

## Gate records

| Gate | Result | Evidence file | Owner | Notes |
|---|---|---|---|---|
| PROD-001 cloud canary | PENDING |  |  | Requires approved staging account and domain |
| PROD-002 managed dependencies | PENDING |  |  | Requires isolated staging secrets |
| PROD-003 providers | PENDING |  |  | Read-only/test mode only |
| PROD-004 observability/paging | PENDING |  |  | Requires protected destination and page receiver |
| PROD-005 backup/PITR | PENDING |  |  | Requires distinct restore target and RPO/RTO |
| PROD-007 capacity | PENDING |  |  | Requires authenticated disposable staging |
| PROD-012 Stripe test mode | PENDING |  |  | Never use production instruments |
| PROD-015 supply chain | PENDING |  |  | Requires digest, SBOM, attestation, deployment record |

This template is not evidence. Replace `PENDING` only after the exact gate procedure has run and artifacts have passed redaction review.
EOF

printf 'Local preflight identity written to %s\n' "$OUT_DIR"
printf 'This command does not deploy, contact providers, create accounts, or assert cloud readiness.\n'
