# P0 Technical Release-Blocker Execution Plan

**Repository:** `Harshodai/tayari-skill-boost`  
**Source:** `TAYARI_REMEDIATION_TODOS.md`  
**P0 count:** 10 unchecked items  
**Decision rule:** A P0 is not complete because code exists. It closes only when implementation, negative proof, positive proof, evidence artifact, and independent review all pass.

## P0 inventory and dependency graph

The ten P0 items are grouped into four tracks. The core technical release gates must precede any high-risk enablement. Product/economics P0s must precede public monetization or claims, but do not replace infrastructure certification.

```text
M9-01 candidate spine ─┐
M9-03 durable lifecycle ─┼─> M9-02 live evidence ─> controlled staging GO
M7-03 trust scoring ────┘             │
M7-06 safe networking ───────────────┤
M7-08 visible truth/privacy ─────────┤
                                      ├─> independent release review
M8-01 paid funnel ─┐                  │
M8-02 margin ──────┼─> M8-03 pilot ───┤
M8-04 retention ───┘                  │
```

| TODO | P0 workstream | Direct production effect | Depends on | Primary owner |
|---|---|---|---|---|
| M9-01 | Candidate-controlled product spine | Prevents untraceable or unverifiable artifacts | Existing M1–M5 controls | Product + backend |
| M9-02 | Live evidence before high-risk enablement | Direct production GO gate | M9-01, M9-03, staging infrastructure | Release/SRE |
| M9-03 | Durable application state machine | Prevents duplicate or falsely verified actions | M2 approval/receipt controls | Backend/data |
| M7-03 | Trust-first scoring experience | Prevents opaque or overstated ATS claims | M9-01 evidence/provenance | AI + frontend |
| M7-06 | Safe networking assistance | Prevents wrong-recipient or autonomous sends | M2 approval/idempotency | Integrations/security |
| M7-08 | Visible privacy and operational truth | Required for trustworthy public launch | M9-01/M9-02 evidence | Product/security |
| M8-01 | Paid-funnel measurement | Blocks measured monetization decision | Privacy-safe event contract | Product/analytics |
| M8-02 | Contribution margin | Blocks economic scale decision | Cost instrumentation | FinOps/backend |
| M8-03 | Bounded paid pilot | Blocks pricing/profitability claim | M8-01/M8-02 | Product/finance |
| M8-04 | Repeat usage and retention | Blocks recurring-value claim | M8-01/M8-03 | Product/analytics |

## Track A — Candidate-controlled product spine

### M9-01 — Complete the candidate-controlled spine

**Objective.** Every stage from resume ingestion through tracking must retain a profile snapshot, canonical job identity, artifact hash, provenance, approval state, and explicit failure state.

**Implementation sequence.** Define one versioned envelope for a candidate workflow stage. Require `workflow_id`, `user_id`, `tenant_id`, `profile_snapshot_hash`, `job_identity`, `artifact_id`, `artifact_hash`, `provenance`, `approval_state`, `failure_state`, `created_at`, and `updated_at`. Attach it to ingestion, job discovery, fit analysis, tailoring, cover-letter generation, review package, and application tracking. Reject a transition when an upstream artifact hash or ownership scope is missing. Retain legacy response fields only as compatibility aliases.

**Tests.** Add happy-path propagation across all stages; missing profile/job/artifact rejection; cross-user access denial; source-hash mismatch; stale artifact; malformed provider result; retry idempotency; and partial-stage recovery. Verify the record is still usable in review mode when no external action is enabled.

**Evidence and exit criteria.** A synthetic end-to-end fixture contains every required envelope field at every stage, hashes reconcile, unknown/failed states remain visible, and an independent reviewer confirms that no UI label claims external submission without receipt evidence.

### M9-03 — Finish durable application lifecycle and reconciliation

**Objective.** Persist the canonical lifecycle in the database and reconcile receipts before allowing retry.

**Implementation sequence.** Add durable lifecycle state/version columns or a versioned JSON contract to the application/attempt tables. Enforce atomic `UPDATE ... WHERE lifecycle_version = expected_version` transitions. Permit only prepared → reviewed → candidate-confirmed → approved → attempted → receipt-confirmed → externally-verified, with explicit failed/withdrawn edges. Store action ID, form hash, job-origin hash, artifact versions, receipt hash, and reconciliation timestamp. Before retry, search for an existing action ID or receipt and pause on ambiguity.

**Tests.** Exercise illegal jumps, stale-version conflicts, approval replay, duplicate action ID, changed form, changed artifact, receipt arrival after worker crash, timeout with unknown outcome, safe retry, withdrawal, and cross-tenant access. Run the tests against disposable PostgreSQL, not only an in-memory helper.

**Evidence and exit criteria.** Migration applies twice, concurrent transition test permits one winner, receipt reconciliation prevents a duplicate, and a redacted database evidence bundle is attached to the exact release SHA.

## Track B — Live staging release gate

### M9-02 — Complete live evidence before high-risk enablement

**Objective.** Prove managed dependencies, tenant isolation, providers, security, recovery, observability, and authenticated performance in an isolated staging deployment.

**Implementation sequence.** Provision environment-separated staging; deploy immutable artifacts; inject secrets from the approved secret manager; verify edge/Go/Python/worker/scheduler readiness; run managed DB/Auth/Redis checks; run the real gate; run M6-03 hostile suite; execute recovery/rollback; run authenticated load; inspect evidence; and keep high-risk flags off until sign-off.

**Exact entry command.** Use [`M6-03_HOSTILE_STAGING_RUNBOOK.md`](M6-03_HOSTILE_STAGING_RUNBOOK.md) and run the following only from the approved staging runner:

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

**Evidence and exit criteria.** All required service and hostile/recovery/performance categories have live redacted evidence; no critical scenario is skipped without an approved scope decision; dashboards/page tests work; exact digests and SHA match; and release owner plus independent reviewer approve the launch scope.

## Track C — Trust, safety, and transparency

### M7-03 — Complete trust-first scoring

**Objective.** Replace an opaque single number with structural score, semantic fit, evidence strength, experience relevance, achievement quality, seniority alignment, keyword coverage, stuffing penalty, unsupported-claim status, confidence, and rationale.

**Implementation sequence.** Define a versioned score schema and source references. Show score-before-penalty, measured keyword/phrase coverage, stuffing evidence, unsupported-claim `not_evaluated` when source provenance is unavailable, confidence band, and per-dimension rationale. Prevent any score from being shown as a hiring probability or placement prediction. Surface missing inputs and stale provider evidence.

**Tests.** Use clean, repeated-keyword, copied-JD, unsupported-claim, prompt-injected, malformed, empty, multilingual, and long resumes. Assert that repetition does not inflate score, unknown claim verification is not rendered as passed, and malformed output fails safely.

**Evidence and exit criteria.** Backend schema, UI snapshot, adversarial suite, source/provenance examples, and a reviewer-approved claims matrix are attached.

### M7-06 — Complete safe networking assistance

**Objective.** Produce useful outreach drafts while requiring candidate review before every send.

**Implementation sequence.** Bind each draft to candidate, recipient, company, role, source URL, purpose, artifact version, consent, approval token, and expiry. Add server-side duplicate keys and per-recipient/channel budgets. Keep send disabled by default; require candidate review and one-use approval. Redact sensitive fields from logs and reject unverifiable contact data.

**Tests.** Wrong-recipient binding, recipient change, duplicate send, replayed approval, expired approval, rate limit, provider timeout, webhook replay, opt-out, deletion, and prompt-injection tests. Verify draft-only behavior when send provider is absent.

**Evidence and exit criteria.** All send paths are candidate-approved, one-use, rate-limited, replay-safe, and provider-acknowledged. Any optional real send uses a dedicated non-production account and explicit acceptance review.

### M7-08 — Complete visible privacy and operational truth

**Objective.** Make data handling and evidence boundaries visible in product flows.

**Implementation sequence.** Add consistent labels for verified, candidate-confirmed, illustrative, inferred, unavailable, and failed data. Show provider/source, retention, deletion, browser-session cleanup, local-LLM mode, receipt status, approval boundary, and feature availability. Ensure marketing, receipts, dashboards, and empty states consume real backend state or explicitly say unavailable.

**Tests.** Truthfulness copy crawl, missing-provider state, stale evidence, failed deletion, disabled capability, no-receipt action, and screen-reader/accessibility tests. Scan bundles and public copy for unsupported outcome claims.

**Evidence and exit criteria.** Public pages, authenticated review, privacy page, receipts, and settings agree; no claim contradicts backend state; and the privacy/security reviewer signs the evidence matrix.

## Track D — Paid-funnel and economic validation

### M8-01 — Complete paid-funnel measurement

**Objective.** Measure visitor → signup → first useful result → tailored application → paid conversion by channel and entry point without collecting sensitive content.

**Implementation sequence.** Define event names, actor hash, anonymous/session boundary, source/channel, entry point, workflow ID, timestamp, and consent/retention policy. Emit events at actual milestones only. Connect checkout/payment webhook events with idempotent payment reference and refund state. Reject raw resume, job, name, email, phone, URLs, prompts, and provider payloads from product events.

**Tests.** Event schema, duplicate emission, missing identity, sensitive property rejection, consent/retention, webhook replay, refund, anonymous-to-authenticated attribution, and deletion purge.

**Evidence and exit criteria.** Staging event counts reconcile with synthetic journey counts; payment webhook and refund states reconcile; event schema is reviewed by privacy owner.

### M8-02 — Measure contribution margin by workflow

**Objective.** Attribute variable costs to resume analysis, job search, tailoring, review, interview preparation, connectors, browser time, storage, email, payment fees, and support.

**Implementation sequence.** Add a workflow cost envelope with model/provider, input/output token counts, provider request ID, latency, storage units, browser seconds, email count, payment fee, and allocation version. Keep raw prompts/resume content out of analytics. Use provider price tables with effective date and mark unknown prices explicitly. Produce per-user, per-workflow, and cohort aggregates.

**Tests.** Provider failure still records bounded cost status; retries do not double count; unknown pricing is not zero; budget exhaustion stops work; deletion removes personal linkage while preserving approved aggregate accounting.

**Evidence and exit criteria.** A measured staging economics report reconciles usage, invoices/test provider charges, and ledger totals with an agreed tolerance.

### M8-03 — Run a bounded paid pilot

**Objective.** Test willingness to pay and actual paid workflow value without unsupported outcome claims.

**Implementation sequence.** Obtain product/legal approval for cohort, price, refund terms, eligibility, consent, support channel, and success criteria. Start with a narrow workflow package. Randomize or predefine cohort inclusion, record exposure, paid conversion, refunds, support time, and completion. Do not enable high-cost external actions as a pilot prerequisite.

**Tests and evidence.** Verify payment fulfillment idempotency, refund handling, access revocation, quota/budget behavior, data deletion, support escalation, and transparent user messaging. Report cohort size, measurement dates, price, costs, churn/refunds, and uncertainty.

### M8-04 — Prove repeat usage and retention

**Objective.** Establish recurring value through repeated applications or career tasks, not resume-upload conversion.

**Implementation sequence.** Define activation, weekly/monthly retention, second-application rate, reactivation, churn reason, useful task, and cohort windows before measurement. Link events through pseudonymous actor IDs; exclude sensitive content. Segment by entry point and paid/free cohort.

**Tests and evidence.** Reconcile event ledger against application records, deduplicate repeated events, handle deletion, and report confidence intervals/sample sizes. Do not infer causal lift from descriptive retention.

## Cross-cutting gates and sequencing

| Gate | Required before | Passing artifact |
|---|---|---|
| Clean release | Any staging run | Exact SHA, clean worktree, immutable digests, SBOM, provenance |
| Core spine | Live high-risk tests | Versioned stage envelope and end-to-end fixture |
| Durable lifecycle | Browser/submit proof | Migration, concurrent transition, receipt reconciliation evidence |
| Staging readiness | Hostile suite | DB/Auth/Redis/provider/readiness evidence |
| M6-03 hostile | Production recommendation | Live hostile/recovery/rollback bundle |
| Product trust | Public scoring/networking claims | UI/copy/evaluation/approval review |
| Economics | Pricing or acquisition scale | Margin, pilot, repeat-use reports |
| Independent review | GO decision | Signed release checklist and residual-risk register |

## Definition of done

The ten P0 items are complete only when all technical release gates are backed by real staging evidence, all high-risk actions remain disabled until their individual acceptance bundles pass, all product/economic claims include measured denominators and uncertainty, the exact release SHA is verified, and an independent reviewer approves the final launch scope. Until then, the correct status is **NO-GO** or **INTERNAL DEMO ONLY**.
