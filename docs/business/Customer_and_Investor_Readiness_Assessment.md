# Job Tayari Customer and Investor Readiness Assessment

**Reference date:** 2026-08-13  
**Basis:** Repository evidence and completed implementation context, including the desktop operating guide, current Docker Compose topology, Kubernetes delivery package, waitlist/lead-capture work, pricing feature flags, testing state, and product-demo handoff. No customer, revenue, retention, traffic, or operating-cost figures have been invented.

## Executive judgment

Job Tayari has a **credible product-control story**: candidate review, explicit cancellation, receipts, ref-safe browser interaction, a desktop shell, a lead-capture path, and an evidence-led product demo. Those are valuable foundations for a trust-sensitive job-search workflow. However, the business is **not yet ready to make broad production, reliability, payment, privacy, or enterprise-security commitments**.

The highest-risk gaps are not visual polish or Kubernetes syntax. They are the unresolved commercial model, missing production operating proof, incomplete customer trust materials, uncontrolled/undefined cloud egress for browser work, absence of verified unit economics, and lack of quantified product/market proof. Kubernetes can reduce delivery and operational risk only after the cloud, data, secrets, networking, observability, and release controls are selected and tested.

> **Decision:** Proceed with a **controlled, no-live-billing staging pilot** only after the local-stack acceptance test and Kubernetes staging gates pass. Do not claim general availability, enterprise readiness, pricing readiness, security certification, uptime, or scalable unit economics until the associated evidence below exists.

## Evidence status scorecard

| Readiness dimension | Current evidence | Status | Missing evidence / required close-out |
|---|---|---:|---|
| Candidate control | Review-oriented design, visible stop path, receipt concept, automation guardrails, and ref-safe form filling are implemented. | **In progress** | Run complete E2E proof against the full local stack and then staging; show approval, cancellation, receipt, and non-idempotent retry behavior. |
| Product presentation | Redesigned landing page, custom Tay identity, macOS shell, and 60-second product demo exist. | **Complete for pilot marketing** | Customer claims require a claim-review process; desktop public release still needs signing/notarization. |
| Desktop distribution | Apple Silicon DMG and ZIP build. | **Blocked** | Developer ID signing, notarization, update path, and on-device manual GUI acceptance. |
| Lead capture | Public institutional waitlist endpoint, database migration, UI integration, and Playwright regression exist. | **Complete** | Add consent language, lead routing owner, CRM/process, privacy notice link, and conversion reporting. |
| Payments and entitlements | Checkout is intentionally disabled. | **Blocked** | Reconcile one-time credit packs with backend subscription behavior; complete Stripe test-mode checkout, webhook, idempotency, ledger, refunds, invoice, and support acceptance. |
| Local full-system acceptance | Component/test suites and a waitlist browser test have passed. | **Blocked** | Docker engine must run; create isolated user and run `e2e/test_all_features_screenshots.spec.ts` before promotion. |
| Cloud deployment | Provider-neutral Kubernetes package and release controls are included in this delivery. | **In progress** | Select provider, region, managed data services, secret store, ingress/WAF, egress control, observability, and perform staging validation. |
| Availability and recovery | Health endpoints and local Compose health checks exist; new package defines probes/PDB/HPA/runbooks. | **In progress** | Measure SLOs, load limits, alert response, backup/restore drill, and actual RTO/RPO before commitments. |
| Security and privacy | Desktop bridge is narrow; new package uses restricted workload defaults and secret contract. | **In progress** | Data map, retention/deletion policy, provider-specific egress allowlisting, log redaction proof, incident program, DPA, and subprocessor list. |
| Market proof | Prior competitor/pricing research and product positioning work exist. | **In progress** | Source-dated ICP, buyer interviews, pilot proof, win/loss evidence, and repeatable channel metrics. Do not use unavailable current traffic data as a substitute. |
| Unit economics | No verified operating metrics are stated in the reviewed delivery context. | **Unknown** | Instrument worker/AI/browser/hosting costs, conversion, support cost, contribution margin, churn/retention, CAC and payback. |
| Governance and execution | Cross-stack work exists across Go, Python, React, Electron, and tests. | **In progress** | Named owners, release RACI, architecture decision records, security ownership, incident rotation, bus-factor plan, and a buyer/investor data room. |

## Customer point of view: what is strong and what is missing

A customer evaluating Job Tayari is not just buying an AI tool. They are asking whether their personal career information is safe, whether the assistant will overstep, whether they can stop it, whether a job application can be traced, whether payment is fair, and whether help is available if an application deadline is at risk. The product’s candidate-control and receipt orientation is therefore a meaningful differentiator, but it must become a complete operating promise.

| Customer moment | Existing strength | Missing or weak point | Priority action |
|---|---|---|---|
| First visit and evaluation | Strong positioning, product demo, trust-oriented candidate-control message. | No verified customer outcomes, clear policy links, or public product-limit statements. | Publish a truthful “how it works / what we do not do” page and link privacy, support, and refund policies. |
| Account setup | Auth and local environment patterns exist. | MFA/SSO posture, account recovery, role model, and enterprise access evidence are not established. | Define user/admin role model, authentication roadmap, session policy, and account-deletion/export workflow. |
| Candidate data upload | Product processes career material. | No public data map, retention schedule, deletion/export process, or confirmed log-redaction evidence. | Create data inventory and retention/deletion implementation before broad cloud pilot. |
| Automation consent | Candidate review, stop path, and receipt concepts are present. | Consent UI, retry behavior, and browser artifact retention policy need full E2E evidence. | Require clear job/action-level consent, durable approval/cancellation event record, and non-automatic replay. |
| Application outcome | Receipt-led product narrative is strong. | Need proof receipt fields are accurate, accessible, and durable through failures. | Test receipt integrity, support workflow, and candidate history access in local stack and staging. |
| Payment and refund | Pricing page and lead capture exist. | Checkout is disabled and commercial contract is inconsistent. | Do not take payment. Finalize offer/credit/entitlement/refund policy and test in Stripe test mode first. |
| Incident experience | New runbooks define an intended operating response. | No public status route, support SLA, or tested incident process. | Establish customer support owner, status communication path, severity definitions, and drill evidence. |
| Institutional procurement | Self-hosted/local story and controlled automation may be appealing. | No DPA, security overview, subprocessor list, data residency selection, or vendor-management evidence. | Build the trust package before making enterprise claims or running procurement-heavy pilots. |
| Desktop adoption | Native Apple Silicon artifact exists. | Unsigned/unnotarized macOS package creates install friction and trust risk. | Complete signing/notarization and a secure update path before public desktop distribution. |

## Investor point of view: strengths, red flags, and proof plan

An investor should see Job Tayari as a potentially differentiated **candidate-control and evidence-layer** product, not as a generic bulk-application bot. The underlying thesis becomes credible only if product trust translates into measured activation, repeat use, conversion, retention, and economically scalable workflows.

| Investor question | Current answer | Risk if not closed | Evidence required before a strong fundraising claim |
|---|---|---|---|
| Why does the product win? | Candidate review, cancellation, receipts, safer form-filling, desktop/local option, and visible agent identity differentiate the workflow. | Features may be seen as surface-level unless they move trust or outcomes. | Cohorts/experiments linking control/receipt features to activation, completion, paid conversion, retention, support burden, or referral. |
| Is demand repeatable? | Landing redesign, demo, and institutional waitlist improve top-of-funnel readiness. | Aesthetic interest is not customer demand. | ICP definition, interview log, qualified pipeline, demo-to-pilot conversion, sales-cycle time, win/loss reasons, and channel economics. |
| Does revenue model fit usage? | A conditional paid-pilot path has been assessed. | UI shows credit packs while backend checkout is subscription-oriented; this damages commercial credibility. | Final offer architecture, pricing tests, test-mode payment proof, credit ledger, refund policy, and pilot conversion funnel. |
| Are gross margins scalable? | No verified cost data is provided. | Browser/AI workflows can create high variable cost and support burden. | Per-run AI/browser/worker/hosting cost, support cost, contribution margin, sensitivity table, rate limits, and capacity plan. |
| Can it operate safely at scale? | Local Compose stack and new K8s package show a plausible architecture. | Architecture alone does not prove availability or safe automation. | Load test, queue-age/error dashboards, backup/restore drill, egress controls, worker drain evidence, and defined SLOs. |
| Is data/privacy risk managed? | Narrow desktop bridge and candidate control are positive. | Résumé/browser/job data exposure can block adoption and depress valuation. | Data map, retention, DPA, subprocessors, redaction proof, vulnerability/incident program, and external assessment roadmap. |
| Is execution de-risked? | Significant cross-stack implementation exists. | Founder/key-person concentration, implicit knowledge, and release ownership can become a diligence concern. | RACI, runbooks, architecture decision records, CI/CD evidence, hiring plan, and documented ownership of security/operations. |
| Is the desktop path viable? | ARM64 packages build and launch locally. | Unsigned/notarized distribution cannot be treated as a launch-ready channel. | Signed/notarized build, installation funnel, update mechanism, and support playbook. |

## P0 close-out plan before paid cloud launch

| Workstream | Outcome required | Evidence artifact |
|---|---|---|
| Full-system acceptance | A real isolated test account completes the product-critical journey against Docker/local services. | E2E run record, screenshots, receipt, credit/entitlement and billing-status verification. |
| Commercial reconciliation | The visible offer and backend behavior match exactly. | Pricing decision record, test-mode transaction, webhook/idempotency tests, ledger evidence, refund/support process. |
| Staging platform proof | Cloud application layer operates with actual managed dependencies and secret/egress controls. | Rendered manifests, image digests, secret-policy proof, smoke and E2E results, observability screenshots, release record. |
| Data and consent safety | Customer data and browser behavior are mapped, minimized, controlled, and auditable. | Data map, retention table, approval/cancellation/receipt tests, redaction review, browser egress policy. |
| Recovery and support | The team can communicate, rollback, restore, and support affected customers. | Incident template, on-call/RACI, restore drill, status process, support escalation. |
| Desktop trust | Public desktop distribution no longer generates an avoidable platform warning. | Developer ID signing/notarization, manual macOS test, install/update documentation. |

## P1 commercial proof plan for the next pilot cohort

The immediate goal is not broad growth. It is to create decision-quality evidence. Define the funnel and cohort metrics before marketing spend so they cannot be retrofitted after the fact.

| Metric family | Definition to lock | Why it matters |
|---|---|---|
| Qualified demand | ICP-fit lead with a recorded source, problem, use case, and consent. | Distinguishes casual curiosity from buyer demand. |
| Activation | New account that completes the defined first-value event, such as a reviewed, tailored job workflow. | Shows whether the product gets users to value. |
| Candidate control | Percentage of consequential actions explicitly reviewed/approved; cancellation success rate; receipt coverage. | Proves the differentiated trust story operates in practice. |
| Workflow quality | Completion rate, error rate, time-to-first-value, manual intervention rate, and support tickets per active user. | Connects reliability to customer experience and operating cost. |
| Commercial conversion | Trial/waitlist-to-pilot, pilot-to-paid, price/package selection, refund rate, and payment failure rate. | Validates the revenue model after it is reconciled. |
| Retention | Week-4 and month-3 active retention, workflow repeat rate, logo churn, and revenue churn. | Core investor evidence for a workflow SaaS business. |
| Unit economics | Variable AI/browser/queue/hosting cost per completed workflow and per paying account, support cost, CAC, payback, gross margin. | Determines whether scale creates value or cost exposure. |

## Material unknowns that must remain visible

The following are not failures. They are explicit diligence requests. Hiding them would be a larger risk than carrying them as an honest roadmap.

| Unknown | Owner to assign | Decision deadline |
|---|---|---|
| Legal entity, fiscal year, reporting currency, ownership, and financial baseline | Founder/finance lead | Before collecting revenue or sharing formal investor materials. |
| Cloud provider, region, data residency, managed data services, WAF, registry, secret store, and observability stack | Platform owner | Before staging deployment. |
| Browser egress model and allowlist governance | Security/platform owner | Before staging browser automation. |
| Data retention, deletion, support/export workflow, privacy notice, DPA, and subprocessors | Legal/privacy/product owner | Before broad cloud beta or enterprise lead conversion. |
| Pricing, credits, Stripe mode, ledger, refunds, invoices, and support ownership | Commercial/product/engineering owners | Before collecting any payment. |
| Customer and economic metrics | Growth/finance/product analytics owners | Before fundraising claims about traction, retention, or unit economics. |

## Decision gates

| Gate | Recommendation |
|---|---|
| Internal/local product evaluation | **Proceed.** The desktop/local stack and product demo can support controlled internal evaluation, with clear unsigned-app and Docker prerequisites. |
| Free controlled pilot | **Proceed after** Docker-backed E2E and staging infrastructure validation, provided customer data/consent boundaries are documented. |
| Paid pilot | **Conditional.** Only after pricing/checkout/entitlements/webhooks/refunds are reconciled and tested in Stripe test mode. |
| Broad self-serve launch | **Do not proceed yet.** Requires operational SLOs, customer trust materials, incident/support path, signed desktop distribution if applicable, and measured economics. |
| Enterprise sales or institutional procurement | **Do not claim readiness yet.** Requires the full trust and procurement package, data residency decision, security evidence, and named operating ownership. |
| Investor outreach | **Proceed with an honest early-stage narrative** focused on product differentiation and pilot-readiness, not on unverified scale/market/financial claims. A formal data room should expose the unknowns and close-out plan. |

## Disclosure

**Basis:** This assessment uses repository and project-delivery evidence. It treats commercial and investor metrics as unknown unless they were verified in the supplied context.  
**Time:** Snapshot as of 2026-08-13.  
**Assumptions:** Job Tayari is an early-stage private product, intends a managed-cloud path in addition to local desktop capability, and has not yet activated its real checkout.  
**Sources and confidence:** High confidence for repository implementation and stated test/build status; low confidence for market size, retention, unit economics, and customer demand because no audited/current operating dataset was provided.  
**Compliance:** This is research and analysis only, not personalized financial advice.
