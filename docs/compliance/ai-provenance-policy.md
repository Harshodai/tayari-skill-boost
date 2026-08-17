# Tayari AI Provenance and Disclosure Policy

**Status:** Technical implementation policy — counsel review required before external compliance claims
**Policy version:** `ai-provenance-v1`
**Owner:** Tayari product, engineering, privacy, and compliance owners

## Purpose

Tayari shall preserve machine-readable provenance for artifacts produced, transformed, imported, reviewed, disclosed, or exported through its AI-powered workflows. The system must answer what an artifact is, who owns it, when it was created, what system or model produced or transformed it, what human review occurred, what version and hash are authoritative, what disclosure state applies, and what evidence supports that state.

This policy treats disclosure as a **retrieval and records problem** before it is a presentation problem. A label, icon, watermark, or natural-language notice is not itself a complete record. It is a projection of durable provenance and policy evaluation.

The policy is intended to support technical readiness for the EU AI Act transparency and record-keeping context, including Article 50-related work, but it does not certify legal compliance. Counsel must approve applicability, role classification, employment-domain implications, retention, wording, iconography, accessibility, data-subject rights, and cross-border processing before production claims.

## Non-negotiable principles

1. **No silent authorship inference.** Missing AI records do not imply human authorship. Historical gaps are classified as `unknown` unless reliable evidence or a documented human attestation supports a narrower state.
2. **No provenance erasure.** A human edit creates a new version and human-review event; it does not delete prior AI origin.
3. **No unsupported disclosure.** The platform must not display “human-created,” “AI-assisted,” or “AI-generated” unless the decision is derived from recorded origin events and the active policy version.
4. **No fabricated provider metadata.** Unknown model/provider/version fields remain unknown and are visible in completeness reporting.
5. **Hashes over sensitive text.** Provenance records store content and input hashes by default. Raw prompts, résumé text, secrets, and provider payloads are not copied into audit metadata.
6. **Owner-scoped access.** Provenance, corrections, exports, and disclosure decisions are subject to verified identity, tenant ownership, RLS, least-privilege grants, and audit logging.
7. **Human-control boundary remains intact.** Provenance labels do not imply truthful content, external submission, receipt verification, or permission for autonomous action.
8. **Versioned decisions.** Every disclosure result and export identifies the policy and evaluator version that produced it.

## Controlled vocabulary

### Primary origin classification

| Value | Meaning | Minimum evidence |
|---|---|---|
| `human_only` | Artifact was created and materially edited by humans without recorded AI generation or transformation. | Human-origin event or attestation and no conflicting AI event. |
| `ai_assisted` | AI contributed suggestions, analysis, drafting, ranking, or transformation, and a human materially reviewed or edited the resulting artifact. | AI origin event plus human review/edit event. |
| `ai_generated` | AI produced the substantive artifact or material content with no recorded material human authorship before publication/export. | AI origin event with output hash and producing application. |
| `ai_transformed` | An existing artifact was materially rewritten, translated, summarized, reformatted, or otherwise transformed by AI. | Parent version plus AI transformation event and output hash. |
| `machine_imported` | Artifact was imported from a machine/provider/system without Tayari generating its substantive content. | Source/provider import event and source hash. |
| `unknown` | Evidence is incomplete, contradictory, or unavailable. | Gap record and reason code. |
| `disputed` | Owner or reviewer disputes the computed classification. | Dispute event, actor, reason, and review status. |

The user-facing minimum label set may map these values to **Human-created**, **Created with AI assistance**, **Created entirely by AI**, **Imported from an external system**, **Unknown provenance**, and **Under review**. The underlying finer-grained values must remain queryable.

### Origin actors and producers

| Vocabulary | Allowed initial values |
|---|---|
| `origin_actor` | `human`, `ai_system`, `external_provider`, `system_import`, `unknown` |
| `producer_type` | `human_user`, `tayari_workflow`, `llm_provider`, `a2a_peer`, `mcp_server`, `firecrawl`, `apify`, `browser_capture`, `file_import`, `unknown` |
| `human_review_status` | `not_required`, `pending`, `reviewed`, `approved`, `rejected`, `disputed`, `unknown` |
| `disclosure_status` | `not_evaluated`, `not_required`, `required_pending`, `disclosed`, `corrected`, `withdrawn`, `blocked`, `unknown` |
| `confidence` | `high`, `medium`, `low`, `unknown` |
| `input_provenance` | `human_input`, `stored_artifact`, `external_public_source`, `provider_output`, `a2a_message`, `mcp_result`, `unknown` |
| `sensitivity` | `public`, `internal`, `personal`, `sensitive_personal`, `secret` |
| `retention_class` | `short_lived`, `operational`, `audit`, `legal_hold`, `delete_on_request`, `unknown` |
| `jurisdiction_scope` | `global`, `eu`, `eea`, `non_eu`, `unknown` |

New vocabulary values require a policy-versioned migration and a compatibility decision for disclosure evaluators and exports.

## Origin-event requirements

Every artifact version that enters a supported Tayari workflow must have at least one origin event. An event is append-only and includes:

- owner/tenant identity and verified actor type;
- artifact and version identifiers;
- event type and controlled vocabulary value;
- workflow/application identifier;
- model/provider/peer identifier when applicable;
- input and output hashes, never raw sensitive payloads by default;
- timestamp, correlation ID, trace ID, and idempotency key;
- human review/approval state where applicable;
- policy/evaluator version where a classification or disclosure was computed;
- redacted evidence references and failure reason if the event did not complete.

Supported event types are `human_created`, `human_edited`, `ai_invoked`, `ai_generated`, `ai_transformed`, `machine_imported`, `a2a_received`, `mcp_received`, `provider_retrieved`, `human_reviewed`, `approved`, `rejected`, `disclosure_computed`, `disclosure_presented`, `exported`, `corrected`, `disputed`, `failed`, and `deleted_or_redacted`.

## Derived disclosure policy

The disclosure evaluator must derive a classification from the ordered origin event graph. The initial deterministic rules are:

1. Any unresolved `disputed` event yields `disputed`.
2. A material AI generation with no subsequent material human authorship yields `ai_generated`.
3. A material AI transformation of a parent artifact yields `ai_transformed`; the user-facing label may be `Created with AI assistance` or `Created entirely by AI` depending on whether a qualifying human review/edit event exists.
4. AI contribution plus qualifying human review/edit yields `ai_assisted`.
5. External system import without Tayari generation yields `machine_imported`.
6. A verified human-origin chain with no conflicting AI or machine event yields `human_only`.
7. Missing, contradictory, or unverifiable evidence yields `unknown`.

The evaluator must emit reason codes, supporting event IDs, and a confidence value. Callers may request recomputation but may not submit an arbitrary classification as authoritative.

## Historical records

Historical backfill must be conservative. It may use durable workflow logs, model/provider receipts, content hashes, user attestations, and existing audit trails. It must never classify a record as human-created merely because a historical AI record is absent. Every backfilled value includes evidence source, confidence, operator/job ID, and policy version.

## Legal and governance review checkpoints

Before external disclosure or production claims, named owners must review:

| Topic | Required decision |
|---|---|
| Applicability | Which Tayari features and customer roles fall within relevant EU AI Act transparency provisions. |
| Role classification | Provider, deployer, importer, distributor, or other role for each workflow and integrated provider. |
| Employment domain | Whether candidate matching, résumé optimization, interview preparation, or application assistance triggers additional employment/high-risk analysis. |
| Content scope | Which text, images, audio, video, documents, and metadata require notices or marking. |
| Retention | Retention and deletion periods for provenance, raw content, hashes, prompts, exports, and evidence. |
| Transparency language | Approved user-facing wording and translations. |
| Iconography and accessibility | Approved icon, alt text, accessible equivalent, placement, and contrast requirements. |
| Data rights | Access, correction, deletion, export, objection, and dispute handling. |
| Provider terms | Model/provider logging, training use, residency, subprocessors, and contractual evidence. |
| Incident response | Correction, provenance corruption, model retirement, disclosure failure, and regulator/customer request procedures. |

## Non-claims

Tayari must not claim that an artifact is authentic, truthful, legally compliant, human-created, or externally submitted merely because it has a provenance record or AI label. A provenance record establishes a declared production history; it does not establish factual correctness or legal sufficiency.

## References

1. [Regulation (EU) 2024/1689 — EUR-Lex](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng)
2. [European Commission — Transparency obligations under Article 50](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act)
3. [European Commission — Guidelines on transparency obligations](https://digital-strategy.ec.europa.eu/en/policies/guidelines-ai-transparency-obligations)
4. [European Commission — Code of Practice on Transparency of AI-generated Content](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content)
