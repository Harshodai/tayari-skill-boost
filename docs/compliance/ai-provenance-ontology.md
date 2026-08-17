# Tayari AI Provenance Ontology and Machine-Readable Envelope

**Ontology version:** `ai-provenance-ontology-v1`
**Policy dependency:** `ai-provenance-v1`

## Core entities

| Entity | Purpose | Required identifiers |
|---|---|---|
| `AIApplication` | A Tayari workflow, provider adapter, A2A peer integration, or MCP integration that can produce or transform artifacts. | `application_id`, `name`, `application_type`, `version`, `owner_scope`, `approval_state` |
| `AIModel` | A model/provider descriptor used by an application. | `model_id`, `provider`, `model_identifier`, `model_version`, `modality`, `metadata_status` |
| `Artifact` | A durable logical object such as a résumé, tailored résumé package, interview preparation package, research result, or exported disclosure. | `artifact_id`, `owner_id`, `artifact_type`, `current_version_id`, `origin_classification`, `disclosure_status` |
| `ArtifactVersion` | An immutable content/version node in an artifact’s history. | `version_id`, `artifact_id`, `content_hash`, `created_at`, `parent_version_id`, `storage_ref` |
| `OriginEvent` | An append-only production, transformation, review, disclosure, export, correction, or failure event. | `event_id`, `artifact_version_id`, `event_type`, `occurred_at`, `idempotency_key`, `actor` |
| `HumanReview` | A qualifying human review, edit, approval, rejection, or dispute. | `review_id`, `artifact_version_id`, `reviewer_id`, `status`, `scope`, `reviewed_at` |
| `Disclosure` | A policy-derived and audience/channel-specific disclosure projection. | `disclosure_id`, `artifact_version_id`, `classification`, `reason_codes`, `policy_version`, `channel` |
| `Evidence` | A redacted or hashed proof reference supporting an origin or disclosure decision. | `evidence_id`, `event_id`, `kind`, `content_hash`, `storage_ref`, `redaction_state` |
| `ExternalAction` | A separate, explicitly controlled action such as browser application submission or external receipt. | `action_id`, `artifact_version_id`, `approval_id`, `status`, `external_verification_state` |

## Relationship model

```text
AIApplication --uses--> AIModel
AIApplication --produces/transforms--> ArtifactVersion
Artifact --has_current_version--> ArtifactVersion
ArtifactVersion --parent_of--> ArtifactVersion
ArtifactVersion --has--> OriginEvent
OriginEvent --references--> AIApplication / AIModel / Evidence
ArtifactVersion --reviewed_by--> HumanReview
ArtifactVersion --evaluated_into--> Disclosure
ArtifactVersion --may_require--> ExternalAction
ExternalAction --must_not_be_implied_by--> Disclosure
```

A human edit creates a new `ArtifactVersion` and a `human_edited` event. It never rewrites or removes the prior version’s AI event. A disclosure points to one authoritative version and one evaluator/policy version.

## Event envelope

The canonical event envelope is JSON-compatible and intentionally excludes raw sensitive content by default:

```json
{
  "schema": "tayari.ai-provenance.event.v1",
  "event_id": "uuid",
  "idempotency_key": "stable-retry-key",
  "tenant_id": "verified-tenant-id",
  "owner_id": "verified-owner-id",
  "artifact_id": "uuid",
  "artifact_version_id": "uuid",
  "event_type": "ai_transformed",
  "origin_actor": "ai_system",
  "producer_type": "tayari_workflow",
  "application": {
    "application_id": "resume-optimizer",
    "version": "1.0.0"
  },
  "model": {
    "provider": "provider-name-or-unknown",
    "model_identifier": "model-name-or-unknown",
    "model_version": "version-or-unknown",
    "metadata_status": "known|unknown"
  },
  "input": {
    "parent_version_id": "uuid-or-null",
    "content_hashes": ["sha256"],
    "provenance": ["stored_artifact", "human_input"]
  },
  "output": {
    "content_hash": "sha256",
    "mime_type": "application/json",
    "storage_ref": "owner-scoped-reference"
  },
  "review": {
    "status": "pending",
    "review_id": null
  },
  "trace_id": "uuid",
  "occurred_at": "2026-08-17T00:00:00Z",
  "policy_version": "ai-provenance-v1",
  "evidence_refs": ["redacted-evidence-id"],
  "failure": null
}
```

## Disclosure envelope

```json
{
  "schema": "tayari.ai-provenance.disclosure.v1",
  "artifact_id": "uuid",
  "artifact_version_id": "uuid",
  "classification": "ai_assisted",
  "user_label": "Created with AI assistance",
  "reason_codes": ["AI_CONTRIBUTION", "HUMAN_REVIEW_RECORDED"],
  "confidence": "high",
  "human_review_status": "reviewed",
  "disclosure_status": "disclosed",
  "policy_version": "ai-provenance-v1",
  "evaluator_version": "disclosure-evaluator-v1",
  "generated_at": "2026-08-17T00:00:00Z",
  "last_updated_at": "2026-08-17T00:00:00Z",
  "supporting_event_ids": ["uuid"],
  "redacted_evidence_refs": ["uuid"]
}
```

## Query contract

Every provenance query must support the following dimensions where applicable:

- verified owner/tenant;
- origin classification;
- AI application, provider, model, and model metadata completeness;
- artifact type and workflow;
- created/transformed date range;
- human review status;
- disclosure status and policy version;
- unknown/disputed reason;
- retention class and legal hold;
- pagination with deterministic ordering.

The three-year historical query is a product report, not a hard-coded legal retention rule:

```text
GET /api/v1/provenance/artifacts?origin=ai_assisted,ai_generated,ai_transformed&created_after=<date>&include_unknown=true
```

The API must return a completeness summary, not just matching artifacts. A response with unknown model/provider metadata is valid only when the record explicitly says `metadata_status=unknown` and includes a gap reason.

## Event idempotency

Origin writes must be idempotent on `(owner_id, idempotency_key)`. A retry of a provider callback, Celery task, A2A message, or human action must not duplicate an event or create a second authoritative disclosure. If the same idempotency key arrives with a different payload hash, the service must reject it as an integrity conflict and record a security/audit event.

## Security and privacy requirements

The ontology treats provenance as potentially personal data. The storage layer must apply owner-scoped RLS, least-privilege grants, deletion/export policy, encryption at rest, redacted logs, and access audit. Secret values, bearer tokens, raw prompts, raw résumé text, cookies, and page credentials are never event fields.

## Compatibility mapping to current Tayari structures

| Existing structure | Provenance extension |
|---|---|
| `AgentAuditTrail` | Map action records to append-only `OriginEvent` rows and preserve existing hashes. |
| `AgentSquadOrchestrator` | Use `run_id`, `trace_id`, résumé/JD hashes, optimizer/truth-gate events, and approval scope as provenance inputs. |
| `omnisave_source_provenance` | Map source capture origin, content hash, sync state, and timestamps to `machine_imported`/source evidence. |
| Knowledge Hub activity timeline | Add provenance/disclosure/correction events to the normalized activity feed. |
| `application_approvals` and `submission_receipts` | Link human approval and external-action evidence without equating disclosure with submission. |
| Capability registry | Gate provenance-producing integrations and disclosure views by launch scope where needed. |

## Versioning rules

Schema, controlled vocabulary, policy, evaluator, and export formats are independently versioned. A record remains interpretable after policy changes because its disclosure stores the policy/evaluator version and supporting event IDs that were used at evaluation time.
