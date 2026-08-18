# JobTayari Agent-Ready Research Brief

## Research objective

Determine whether JobTayari’s implemented and planned capabilities are technically real, operationally reliable, safe for multi-tenant use, standards-aligned, and differentiated against current job-search and computer-use products. The research must produce evidence that can change a launch decision, not marketing copy.

## Source hierarchy

Use sources in this order:

1. Repository code, migrations, tests, release contracts, deployment manifests, and immutable Git commits.
2. Official provider documentation, security documentation, API references, pricing/terms, and status pages.
3. Official standards and government/regulatory sources, including NIST, OWASP, ISO summaries, European Commission material, and relevant data-protection authority guidance.
4. Maintained open-source repositories with active releases, tests, issue history, license, and security posture.
5. Academic papers, benchmark datasets, conference talks, and first-hand technical demonstrations.
6. Independent product reviews and practitioner reports.
7. Search snippets, social posts, and vendor marketing pages only as discovery leads, never as sole proof.

## Questions that must be answered

### Product reality

Which JobTayari routes return real provider-backed results, which return deterministic local results, which are explicit fixtures, and which fail closed? Identify every UI claim that can be reached through a manually entered URL even when navigation flags are disabled. Confirm that each result exposes an evidence class, provenance state, freshness state, and external-verification state.

### Candidate outcomes

Does the system improve candidate-controlled outcomes rather than merely generate text? Define a reproducible evaluation corpus for parsing, ATS assistance, tailoring, interview preparation, job ranking, and application handoff. Measure unsupported claims, source-grounding errors, duplicated/stale jobs, review burden, latency, cost, and externally verified outcomes.

### Computer use

Compare Tayari Computer with OpenSandbox, Manus Browser Operator, browser-use, BrowserGym, WebArena-style tasks, ST-WebAgentBench, OS-Harm, and current first-party computer-use systems. Research goal-hijack, tool misuse, identity/privilege abuse, visual prompt injection, hidden DOM/PDF/email instructions, redirect/iframe behavior, stop/revoke semantics, and isolation/teardown evidence. Do not claim parity without trajectory-level evidence.

### Integrations

For Firecrawl, Apify, A2A, MCP, Gmail, messaging, and Stripe, verify current API capabilities, webhook/callback support, least-privilege scope, quotas, billing behavior, data retention, deletion semantics, rate limits, terms, and outage behavior from primary sources. Map every provider to a configuration state, live-verification test, receipt, rollback, and kill switch.

### Security and privacy

Map JobTayari against NIST AI RMF/AI 600-1, OWASP GenAI LLM Top 10 2026, OWASP Top 10 for Agentic Applications 2026, ISO/IEC 42001, OWASP ASVS, software supply-chain guidance, and applicable privacy/transparency rules. Confirm controls for prompt injection, insecure output handling, supply chain, sensitive disclosure, excessive agency, overreliance, tenant isolation, log redaction, retention, deletion, backup restore, and incident response.

### Operations

Verify SLOs, queue behavior, cancellation, worker restart, Redis outage, database outage, backup/restore, rollout/rollback, immutable image/SBOM attestations, provider outage, budget enforcement, rate limits, and on-call procedures. No readiness claim should rely on a guided demo or a mocked dependency.

## Required research output

Every research result must include:

| Field | Requirement |
|---|---|
| Claim | One precise, falsifiable statement. |
| Source | URL, title, publisher/owner, retrieval date, and source class. |
| Evidence | Exact quoted or summarized passage, code path, API response, benchmark result, or observed behavior. |
| Confidence | `verified`, `strongly supported`, `partially supported`, `unverified`, or `contradicted`. |
| JobTayari implication | Enabled, staged-only, disabled, or implementation required. |
| Reproduction | Exact command, test, environment, or URL needed to reproduce. |
| Freshness | Date and version/commit/provider release where applicable. |
| Risk | Security, privacy, reliability, legal/compliance, product, or operational risk. |

## Research prohibitions

Do not claim to have watched a video when only its title, description, or metadata was retrieved. Do not call a vendor’s marketing statement an independent benchmark. Do not call a unit test a live integration test. Do not call credentials present a provider verification. Do not download and execute untrusted code. Do not add live credentials to the repository or evidence files.

## Deliverables

The future agent should produce a Markdown report, an append-only evidence log, a provider evidence matrix, a standards control map, a benchmark comparison table, a prioritized implementation backlog, and a list of unresolved blockers. If visualizations are useful, save them as image files and reference them from the report. The final report must include a References section with numbered links.
