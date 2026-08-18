# JobTayari Standards Evidence Baseline

## Sources reviewed

| Source | Verified finding | Repository implication |
|---|---|---|
| [NIST AI RMF Generative AI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence) | NIST describes AI RMF 600-1 as a cross-sector profile for generative AI risk management across the AI lifecycle, with trustworthiness considerations for design, development, use, and evaluation. | Every enabled JobTayari capability needs lifecycle ownership, intended-use boundaries, measurement evidence, and management/rollback controls rather than only implementation code. |
| [OWASP GenAI/LLM Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/) | The archived OWASP page identifies prompt injection, insecure output handling, supply-chain vulnerabilities, sensitive-information disclosure, excessive agency, and overreliance as core risks; it points to the 2026 active project. | Tayari Computer and external-provider tools require explicit tool allowlists, output validation, tenant-bound credentials, human approval boundaries, provenance, and adversarial tests. |
| [OWASP Top 10 for Agentic Applications 2026](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/) | OWASP describes a peer-reviewed agentic-security framework for systems that plan, act, and make decisions across complex workflows. | JobTayari must evaluate goal hijack, tool misuse, identity/privilege abuse, excessive agency, unsafe delegation, and recovery—not only request/response correctness. |
| [ISO/IEC 42001:2023](https://www.iso.org/standard/42001) | ISO describes 42001 as an AI management-system standard requiring organizations to establish, implement, maintain, and continually improve an AI management system, with risk/opportunity management, traceability, transparency, and reliability. | The repository needs a living AI-system inventory, risk register, owner/approval records, evidence retention, change control, incident handling, and continual-review cadence. |

## Standards-aligned controls to implement

| Control family | Required evidence |
|---|---|
| Govern | Capability owner, intended use, excluded use, risk tier, approval authority, evidence expiry, incident owner, and rollback owner for every AI/provider capability. |
| Map | Data-flow and trust-boundary map for candidate data, provider data, browser state, credentials, artifacts, logs, queues, and backups. |
| Measure | Reproducible quality, safety, tenant-isolation, provenance, latency, cost, and recovery measurements with versioned datasets and environment fingerprints. |
| Manage | Capability gates, kill switches, expiry, rollback, human handoff, incident procedures, provider revocation, and post-incident review. |
| Agent security | Prompt/goal-hijack corpus, tool misuse tests, identity/privilege tests, output validation, action policy, stop/revoke verification, and trajectory-level scoring. |
| Supply chain | Immutable image digests, SBOM, dependency lockfiles, provenance attestations, vulnerability scan, provider version pinning, and release manifest. |
| Transparency | Machine-readable artifact origin, model/provider metadata status, AI-assisted/generated labels, candidate review state, and externally verified outcome state. |
| Privacy | Purpose limitation, minimization, tenant isolation, sensitive-field policy, retention/expiry, deletion/export reconciliation, logs redaction, and backup deletion evidence. |

## Limits of this evidence

These sources establish control expectations; they do not certify JobTayari. Certification, legal compliance, or production readiness still require deployment-specific evidence, independent review, and—where applicable—formal assessment by qualified professionals.
