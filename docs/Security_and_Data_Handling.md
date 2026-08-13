# Job Tayari Security and Data-Handling Standard

## Purpose

Job Tayari assists candidates with sensitive career-search workflows. The system may process résumés, candidate profiles, job descriptions, application answers, account credentials or delegated sessions, browser artifacts, approval decisions, cancellation events, and submission receipts. The product’s review-oriented design requires the operating model to protect not only confidentiality, but also candidate control and the integrity of recorded actions.

This document is an engineering and operating standard. It is not a privacy notice, Data Processing Agreement, legal opinion, security certification, or claim of SOC 2 compliance. The customer-facing legal and trust package must be reviewed by qualified legal, security, and business owners before publication.

## Data classes and controls

| Data class | Examples | Minimum technical control | Customer-facing requirement |
|---|---|---|---|
| Account and authentication | Email, identity-provider tokens, sessions, role assignment | TLS, least privilege, secret-store integration, session controls, no credentials in logs. | Explain account security, access, and account deletion path. |
| Candidate career data | Résumés, work history, skills, preferences, uploaded documents | Encryption in transit and at rest, tenant-scoped access, retention/deletion policy, audit access. | Explain purpose, storage/retention, export, deletion, and support contact. |
| Job/application content | Job descriptions, tailored materials, answers, approval status | Candidate approval boundary, immutable/auditable state transitions, controlled worker access. | State that the candidate reviews consequential actions and can stop work. |
| Browser/session material | Cookies, page artifacts, request context, screenshots where enabled | Dedicated worker isolation, egress policy, ephemeral volumes, strict log redaction, explicit retention rules. | Obtain clear consent and disclose scope/limits before browser-assisted actions. |
| Receipts and audit events | Timestamp, target job, action state, cancellation/approval evidence | Durable storage, restricted access, tamper-evident event design where feasible, retention schedule. | Provide accessible receipt/history view and correction/support process. |
| Billing and payment | Customer plan/credits, webhooks, payment identifiers | Stripe secret isolation, idempotent webhooks, entitlement ledger, no card data stored by Job Tayari. | Do not enable until offer, checkout, refund, and invoice behaviors match public pricing. |
| Telemetry and support data | Errors, logs, traces, support tickets | Data minimization, structured redaction, retention limits, access review. | Disclose support and analytics subprocessors where legally required. |

## Baseline safeguards

The Kubernetes package implements a foundation of non-root containers, dropped capabilities, disabled privilege escalation, read-only root filesystems where compatible, separate service accounts, secret references rather than inline values, ingress deny-by-default policy, resource limits, health gates, and immutable deployment artifacts. It does not by itself prove that all data flows are compliant or adequately controlled.

The following safeguards remain mandatory launch work:

| Priority | Safeguard | Completion evidence |
|---|---|---|
| P0 | Create a full data-flow diagram and retention schedule. | Approved diagram names every datastore, queue, log sink, AI provider, browser artifact, and subprocessor. |
| P0 | Enforce provider-specific default-deny egress with only private data services and approved external endpoints allowed. | Tested policy in staging with DNS, database, Redis, object storage, identity, AI-provider, and browser flows. |
| P0 | Verify redaction for auth tokens, résumé text, application answers, job content, and browser data across logs, tracing, errors, and CI. | Review sample and automated redaction checks. |
| P0 | Complete explicit approval, cancellation, receipt, and non-idempotent retry rules. | E2E test and support procedure show candidate control is preserved in failures. |
| P0 | Reconcile billing before accepting money. | Stripe test-mode transaction, entitlement, webhook, invoice/refund, and UI consistency evidence. |
| P1 | Establish incident response, security-owner rotation, vulnerability intake/patching targets, and customer communication process. | Approved runbook, contacts, tabletop exercise or recorded drill. |
| P1 | Publish privacy/security/subprocessor/retention material appropriate to the target market. | Legal/security review and version-controlled publication. |
| P1 | Establish customer export and deletion workflows, including backup-handling expectations. | Tested support/in-product process with completion record. |
| P2 | Define enterprise controls roadmap: SSO/SAML, MFA policy, audit-log export, data-residency options, and procurement questionnaire response. | Prioritized roadmap tied to ICP and pilots. |

## Browser automation-specific operational rules

1. Browser-enabled workers must run separately from the gateway and generic API workloads. They must have finite concurrency and a distinct drain procedure.
2. Outbound browser destinations must be controlled through a provider-specific egress policy or an inspected egress gateway. The generic Kubernetes base cannot safely whitelist third-party job-site destinations without a target-region/network decision.
3. A failed browser workflow must never cause automatic external replay unless idempotency is proved. Candidate approval state, cancellation state, receipt state, and the external action outcome must be reviewed first.
4. Screenshots, HTML, browser logs, and any session artifacts require a documented retention owner and redaction policy. They should not be inserted into broad telemetry streams.
5. The customer experience must make clear what the system will prepare, what the candidate must review, what will be sent externally, and how the candidate can stop the run.

## Customer trust package required before enterprise launch

The following materials form the minimum evidence set for security-conscious customers. They should contain only verified commitments and reviewed legal language.

| Artifact | Purpose | Current disposition |
|---|---|---|
| Security overview | Explain architecture, access controls, encryption, monitoring, and responsible disclosure. | To create and review. |
| Privacy notice and retention schedule | Explain candidate-data purpose, retention, rights, and contact path. | To create and review. |
| DPA and subprocessor list | Support institutional procurement and data-processing transparency. | To create with counsel. |
| Incident-response and status communication policy | Define customer update expectations during material incidents. | Runbook exists; customer policy still required. |
| Data export/deletion procedure | Operationalize customer rights and support obligations. | To build and test. |
| Product control guide | Explain candidate review, cancellation, receipts, and limitations. | Can build from existing product controls; requires customer documentation. |
| Desktop release guide | Explain signed/notarized installation and local-service requirements. | Blocked until Developer ID signing and notarization. |
