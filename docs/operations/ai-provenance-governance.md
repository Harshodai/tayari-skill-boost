# AI Provenance Governance and Operations

## Scope

This runbook governs Tayari’s AI-origin records, disclosure decisions, historical backfill, corrections, exports, and recovery. It does not replace legal advice or a customer-specific retention schedule.

## Operational states

| State | Meaning | Operator action |
|---|---|---|
| `complete` | Artifact has a resolvable origin graph, hashes, application metadata, and policy-derived disclosure. | Normal review and export. |
| `unknown` | Origin evidence is missing or contradictory. | Surface gap; do not infer human authorship; queue review/backfill. |
| `disputed` | Owner or reviewer contests the classification. | Preserve history, freeze public disclosure change until reviewed, record decision. |
| `blocked` | Provenance persistence or evaluator dependency is unavailable. | Do not claim a new disclosure is complete; restore storage/evaluator or retain an explicit unknown status. |

## Retention and deletion

Retention classes are technical controls, not legal conclusions. Product, privacy, and counsel owners must set durations for raw content, content hashes, model metadata, provenance events, disclosure projections, exports, and legal holds. Deletion workflows must distinguish content deletion from minimum audit evidence needed to explain a prior disclosure or security event.

A subject deletion or export request must include provenance records, disclosure records, correction history, and redacted evidence references while respecting approved legal holds and retention exceptions. It must never expose provider secrets, raw prompts, cookies, credentials, or unrelated tenants.

## Correction workflow

1. Verify the requesting owner and artifact scope.
2. Read the current version and disclosure envelope.
3. Record a `disputed` or `corrected` event; never edit the previous event in place.
4. Require a reviewer or owner attestation with reason and evidence source.
5. Recompute disclosure under the current policy version and retain the prior policy/evaluator result.
6. Surface the new state and correction timestamp in UI and exports.
7. Record the operator, request ID, and audit outcome.

## Provider/model outage

If model/provider metadata is unavailable, preserve the artifact only if the artifact path’s existing safety policy permits it, but set provenance metadata status to `unknown` and do not render a stronger disclosure classification. If durable provenance persistence is unavailable for a path that promises a durable artifact record, the path must return an explicit unavailable/unknown provenance state and must not claim a completed compliance record.

## Model retirement and metadata changes

Retire model records rather than deleting them. Keep provider, model identifier, version, and approval state sufficient to interpret historical events. New policy or evaluator versions create new disclosure projections; they do not rewrite historical evidence.

## Export controls

Exports are owner-scoped, logged, bounded, deterministically ordered, and labeled with schema, policy, evaluator, generation time, and completeness summary. An export containing unknown provenance is valid only if the unknown count and reasons are explicit.

## Metrics and alerts

Track the following by deployment, workflow, provider, and date:

- provenance write success/failure rate;
- unknown and disputed artifact rate;
- AI model/provider metadata completeness;
- disclosure computation latency and error rate;
- correction and export counts;
- artifacts with AI contribution but no human review;
- failed or incomplete historical backfill rows;
- provenance events rejected for idempotency or integrity conflicts.

Alert on a sudden increase in unknown classification, any cross-tenant access anomaly, any provenance write failure on a path that claims durable records, and any disclosure evaluator version mismatch.

## Backup and restore

Provenance tables are part of the system of record and must be included in PostgreSQL/Supabase backup and restore validation. After restore, verify schema version, row counts, owner scope, artifact/version foreign keys, event idempotency, disclosure policy versions, and audit access. Do not replay external browser actions or provider calls merely because provenance or queue state was restored.

## Release gates

Before enabling public disclosure claims, require:

1. RLS/grant and two-user negative tests;
2. migration parity and disposable restore evidence;
3. deterministic classification and export tests;
4. redacted log review;
5. staging LLM/provider and A2A provenance propagation;
6. counsel-approved wording/icon/accessibility review;
7. a documented historical unknown-rate baseline and owner correction process.
