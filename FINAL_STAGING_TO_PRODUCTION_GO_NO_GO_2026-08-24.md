# Tayari — Final Staging-to-Production Go/No-Go Command Document

**Version:** 1.0 — 24 August 2026
**Purpose:** This is the single operating document for deciding which Tayari features may be enabled during final staging, which must remain restricted, and what evidence is required before a sincere public-production launch.

## 1. Decision Standard

Tayari is a broad career-operations codebase, not a single resume tool. It includes public information pages, identity/account flows, resume and job workflows, AI-generated materials, job discovery, candidate review queues, analytics, knowledge and career-planning tools, communication drafting, social/content capture, browser-extension surfaces, automation engines, and computer-control experiments. A feature being routed, implemented, or feature-flagged **does not mean it is ready for real users**.

> **The release rule is feature-specific, evidence-gated activation.** No feature is promoted because it “works on localhost,” has a polished screen, or is enabled in `features.ts`. A feature advances only when it meets its own data, security, truthfulness, side-effect, observability, and rollback requirements.

This document permits a narrow staging launch followed by deliberate rings of expansion. It prevents the dangerous alternative: enabling all existing pages and hoping real users discover the safe subset.

## 2. Global Red Gates — Apply to Every Feature

A feature cannot enter any external-user staging ring until every applicable gate below passes. A missing artifact is a failure. A failing red gate is a **no-go**, not a future ticket.

| Gate | Required evidence | Absolute no-go trigger |
|---|---|---|
| **Immutable release identity** | Committed release SHA/tag, reviewed change list, locked dependency files, deploy artifact/image digests | Deploying an uncommitted workstation state or an unverifiable branch |
| **Build and test health** | Green frontend tests/build/typecheck; Go tests/vet; Python tests; E2E relevant to enabled ring | Any failing/skipped required job or unreviewed test change |
| **Database authorization** | Verified backup; applied RLS hardening migration; `scripts/check_public_table_rls.sh` pass; non-destructive anonymous denial probes | Any cross-account access or unexpected 2xx response for sensitive REST tables |
| **Secrets and logging** | Staging-only secrets; redacted config review; console/log/telemetry scrub test | Resume/JD/content/token/credential appears in console, logs, analytics, or error tracking |
| **Environment isolation** | Separate staging database, object store/prefix, provider keys/quota, Auth/OAuth origins, billing test mode | Staging points at production data, live billing, live messaging, or employer-account credentials |
| **Truthful AI behavior** | Controlled provider outage test, prompt-injection test, unsupported-fact test, schema-validation sample | Fabricated output on failure, hidden AI error, invented candidate fact, or unsafe prompt-following |
| **User control** | Explicit preflight, approval/rejection, cancellation, visible run state, feature kill switch | Automated external action without separately recorded user authorization |
| **Operational readiness** | Staging alerts, dashboards, runbooks, named on-call, rollback rehearsal, 24-hour soak | No way to detect user harm or disable/roll back the feature promptly |
| **Legal/product truthfulness** | UI/copy accurately describes current capability and limitations | “Auto-apply,” “submitted,” “verified,” or “secure” claims that the current system cannot prove |

## 3. Existing Capability Inventory and Activation Classification

### Activation labels

| Label | Meaning |
|---|---|
| **A — Candidate staging now** | Can enter the controlled real-user pilot once all global red gates pass. No external side effect beyond the product’s own staging data. |
| **B — Limited staging after feature proof** | May be tested by staff/trusted users only after feature-specific tests and evidence are attached. |
| **C — Internal evaluation only** | Valuable code exists, but it is not authorized for external staging users. Keep route/flag hidden. |
| **D — Disabled / explicitly blocked** | Must remain off until a separate release proposal proves the required controls. |
| **E — Public/static only** | May be public in staging, subject to ordinary quality, security, legal-copy, and analytics checks. |

### 3.1 Public information, identity, and account surfaces

| Feature / route family | Codebase status | Activation | Required final-staging evidence before expansion |
|---|---|---:|---|
| Landing, methodology, about, FAQ, contact, terms, privacy (`/`, `/landing`, `/methodology`, `/about`, `/faq`, `/contact`, `/terms`, `/privacy`) | Public routes; no candidate action required | **E** | Content/claim review, mobile/browser smoke, accessibility scan, contact-spam protections, analytics consent review |
| Blog and blog posts (`/blog`, `/blog/:slug`) | Feature flag enabled in production; public content surface | **E** | Published-only access verified; author/editor role test; XSS/content-sanitization test; no draft data through PostgREST |
| Pricing | Feature flag enabled; billing backend exists | **E** for pricing information only | Every claim/price reflects actual supported scope; no live charge path unless Stripe production test suite, webhook verification, refund/support policy, and finance approval exist |
| Authentication, onboarding, profile, password reset, OAuth callback | Core account pathways; Supabase Auth/self-hosted options | **A** | Sign-up/in/out/reset tests; session expiry; email delivery sandbox; brute-force/rate-limit test; cross-account isolation; deletion/export path |
| API keys (`/api-keys`) | Sensitive account surface and API key routes | **B** | Create/list/revoke/rotate only for own user; no key bodies in logs; one-time display; audit record; no RLS bypass; key misuse/rate-limit test |
| Settings, privacy diagnostics, downloads | Account/diagnostic support surfaces | **A** for standard settings; **B** for privacy diagnostics | Own-account access test; deletion/export accuracy; no claimed diagnosis beyond evidence; secure downloadable-file authorization |
| Admin analytics, advisor dashboard, agent panel | Direct routes exist and expose operational/cross-user concepts | **C** | Formal role model, RBAC tests, audit logging, least privilege, data-minimization review, and internal-owner approval before any external use |

### 3.2 Resume, document, and evidence-backed material workflows

| Feature / route family | Codebase status | Activation | Required final-staging evidence before expansion |
|---|---|---:|---|
| Resume upload and pasted resume (`/resume`) | PDF/DOCX validation with 5 MB limit; text extraction; direct create/upload and analysis workflow | **A**, after privacy gate | Remove current client-side extracted-resume console logging; prove console/Sentry/log/analytics scrubbing; file validation/malware handling; extraction review; deletion; cross-account access denial |
| Resume results and optimization | AI analysis and recommendation flow | **A** for a five-person pilot | Provider outage is honest; unsupported claim appears as gap/unknown; prompt-injection inputs do not alter system behavior; output schema/latency/cost bounds; user can review without auto-overwrite |
| Free ATS scan (`/free-scan`) | Public free-text workflow; rate-limited through Go/Python | **A**, but capped | Two-client canonical-IP rate-limit canary after deployment; abuse and payload-size test; no raw resume/JD logging; explicit privacy notice; provider failure handling; anonymous cost cap |
| Resume templates, Typst studio, resume PDF/download | Generated/document export paths | **B** | Test output rendering on sample files; no template claims of “ATS guaranteed”; secure object authorization; PII-free logs; versioned generator/renderer; deletion/export proof |
| Resume graph, skill-gap radar, knowledge hub | Derived data, knowledge-graph and skill/career insight surfaces | **B** | Provenance displayed; stale/inferred data labeled; tenant/user isolation; source and deletion propagation; avoid presenting inferred skills as fact |
| Candidate Answer Bank and Agent Questions | User-owned reusable response/answer data | **B** | Owner-only access; versioning; deletion; unverified/generated answer labels; no automatic reuse in external applications without review |
| Verification / provenance / privacy-readiness | Candidate evidence and verification claims | **B** | Define what is verified, by whom, against which source and expiry; no misleading badge; tamper/audit test; independent review of user-facing wording |

### 3.3 Jobs, pipeline, applications, and opportunity intelligence

| Feature / route family | Codebase status | Activation | Required final-staging evidence before expansion |
|---|---|---:|---|
| Job search and job detail (`/jobs`, `/job-search`) | Core enabled feature; Hermes multi-board discovery architecture documented | **A** for controlled pilot | Source provenance, freshness timestamp, deduplication, query timeout/error state, user-scoped saved jobs, provider quota/circuit-breaker behavior, no unlicensed scrape claim |
| Public job-link import | `/api/v1/job-descriptions/import`; Python importer validates public URL, disallows redirects, bounds fetch/size/content type | **A** for allowed domains | SSRF negative suite: private/localhost/metadata-style, redirect, paywall/login, oversized/non-text and slow target; only public HTTPS allowlisted employer/ATS domains in initial pilot; show/edit imported text before analysis |
| Saved jobs, pipeline, applications, application board | Core candidate tracking surfaces | **A** | Candidate A/B isolation; create/update/delete; concurrency/duplicate submission; no status claimed as “submitted” without evidence; export/deletion compatibility |
| Review queue | Explicit approve/reject controls linked to preparation flow | **A**, internal-state only | Approval/rejection owner-scoped and auditable; replay/expiry test; prove approval changes only internal state; no email/application/browser/third-party side effect |
| Application analytics, outcomes, funnel analytics | Candidate performance and outcomes data | **B** | Metric definitions, data completeness/staleness, own-data isolation, date/timezone validation, no unsupported career prediction claims |
| Company Radar, career intelligence, predictive/route insights | Research/recommendation and potentially external data-provider outputs | **B** | Provider licensing, source dates/links, rate/cost limits, factual-source samples, clear confidence/freshness labels, no investment/legal/employment guarantee claims |
| LinkedIn import | Direct route; invokes an external platform context | **C** | Written platform-policy review, explicit user consent, no credential capture, no automated LinkedIn actions, robust failure state, data minimization, manual staging test in a controlled account only |
| Omnisave / content capture | Route and browser-extension capture surfaces exist | **C** | Source-platform policy review, user-trigger-only capture, granular permission disclosure, data minimization, no background extraction, deletion, and manifest/security review |

### 3.4 Candidate preparation, career growth, and communication

| Feature / route family | Codebase status | Activation | Required final-staging evidence before expansion |
|---|---|---:|---|
| Cover letter | Production flag enabled; generated application material | **A** in pilot | Candidate review gate; no invented claims; source-aware drafting; provider-failure clarity; copy/export privacy check |
| Communication hub | Production flag enabled; messaging templates/communication aid | **B** | Draft-only boundary; recipient/source review; no external send capability; harassment/spam policy; user approval audit |
| Recruiter outreach, networking, referral drafts | Direct routes and referral feature flag exist | **B** | Draft-only; no recipient or employer contact without explicit user action outside Tayari; consent for contact data; anti-spam rate limits; content safety tests |
| Career roadmap and career ops | Production flags enabled; planning and operational dashboard surfaces | **B** | Recommendation source/provenance, transparent assumptions, no false certainty; own-user data isolation; usability test with real participants |
| Negotiation Copilot | Production flag enabled; salary/negotiation assistance | **B** | Up-to-date data-source disclosure, regional/role caveats, no legal/financial guarantee framing, user-feedback review, source freshness and bias checks |
| Portfolio generator | Production flag enabled; generated public-facing career artifact | **B** | Explicit publishing choice; preview before publish; secrets/PII scan; image/content license check; generated-site ownership and deletion; no automatic public deployment |
| Interview board, experiences, coding practice, interview prep | Mix of active direct routes and feature-disabled interview/coaching flags | **B** for static practice/tracking; **D** for AI/voice coaching until enabled | Interview content moderation, user progress isolation, no false assessment claims; AI/voice requires consent, recording retention, biometric/voice policy, model quality and accessibility evidence |
| Voice coach | Feature flag disabled | **D** | Separate audio/voice privacy, consent, storage, deletion, latency, accessibility, bias, and misuse review before staging users |

### 3.5 Automation, agents, browser, extension, and background systems

| Feature / route family | Codebase status | Activation | Required final-staging evidence before expansion |
|---|---|---:|---|
| AutoPilot (`/jobs/autopilot`) | Existing UI starts a run with `auto_apply: false`; uses resume, query/location/max jobs/tailoring; review queue exists | **B**, trusted-user only | UI, gateway, and backend all assert `auto_apply=false`; max five jobs/run; one active run/user; cost/queue limit; cancellation; candidate preflight; no external side effect; review approval proves internal-only state change |
| One-Shot Pipeline | Feature flag enabled; agentic orchestration surface | **C** until its exact action contract is proven | Explicit plan preview, per-step approval, run/event audit, cancellation, idempotency, side-effect inventory, cost caps, no hidden external calls |
| Task Workspace / Tay (`/tay`) | Production flag enabled; task-control UI and automation provider context | **B** only as task planning/review | Every task action classified read/draft/external; approval before external; event log; resume safety and handoff behavior; permissions test |
| Automation Workspace (`/automations`) | Feature flag disabled; backend approval routes and automation engine/catalog exist | **D** | Separate feature launch: tenant/user authorization, capability gates, run state machine, approval expiry/replay protection, scheduler controls, kill switch, external-integrator threat model |
| Apply Agent (`/apply-agent`) | Preview-only after audit; frontend/edge function schema conflict with canonical agent-run data model | **D** | One gateway-backed data contract; durable run/step schema; full integration tests; truthful state UI; review-only action; no submission; migration and rollback proof |
| Browser automation agent | Python browser-use/Playwright and gateway capability routes exist; current documentation mentions autonomous form submission | **D** | Separate red-team release: user-session boundaries, source-platform policy, explicit per-site consent, reliable stop/takeover, screenshot/credential protection, action receipts, no submit by default, legal review |
| Computer Control Room | Feature flag production false/preview true | **D** | Isolated runtime, short-lived credentials, OS/session hardening, screen/clipboard/privacy controls, human takeover, audit trail, destructive-action prevention, incident/kill switch rehearsal |
| Desktop Agent | Feature flag production false/preview true and desktop deep-link integration | **D** | Signed builds, code-signing/notarization, local permission model, secure IPC, update mechanism, data lifecycle, device loss/offboarding and takeover test |
| Browser extension | Feature flag enabled; Manifest V3 with active tab, scripting, tabs, notifications, side panel, identity, native messaging, job-site and content-capture host permissions | **C** for staff-only; not candidate staging yet | Chrome Web Store/security review; narrow host permissions; user-triggered capture; no credential/form value collection; CSP/content-script review; extension/app auth binding; policy review for LinkedIn/Indeed/social sites; uninstall/data deletion and abuse tests |
| Gmail, Google Calendar, Google Drive | Feature flags disabled; integration route modules exist | **D** | OAuth verification, minimal scopes, token encryption/rotation/revocation, calendar/email side-effect approval, provider policy review, audit trail, disconnect/deletion test |
| JobTheory MCP / external connectors | Integration code/docs present | **C** | Connector authentication/authorization, outbound allowlist, tool permission model, data-sharing disclosure, failure/timeout/cost caps, vendor review |
| Celery, Redis, scheduler, Hermes scrapers | Queue/workers and job-scraping architecture exist | **B** internally, **C** where third-party actions occur | Queue isolation, idempotency, retry/dead-letter policy, provider quota, circuit breakers, worker health/alerting, task replay safety, job-source licensing and cancellation |

### 3.6 Platform, integration, and operational capabilities

| Capability | Current status | Activation | Final evidence required |
|---|---|---:|---|
| Self-hosted Supabase (Postgres/Auth/PostgREST/Storage/Realtime/Kong/Studio) | Implemented; critical RLS issue remediated in source/local validation | **A** after deployment gate | Backup/restore, migration application, RLS/grant gate, service-role secret protection, exposed-admin-port review, auth/storage policies, patch cadence |
| Go API gateway | Implemented, full unit/vet tests passed during audit | **A** | Staging deployment health, trusted-proxy config, error scrubbing, rate-limit canary, route allowlist/documentation, 5xx alerting |
| Python AI engine | Implemented with model/provider abstraction and guarded routes | **A** for bounded AI workflows | Internal-only network/token, provider budget/circuit breaker, PII log scrub, structured output/timeout/retry test, prompt-injection and outage checks |
| Redis/Celery workers | Implemented async execution | **B** | Worker isolation, retry/idempotency, queue depth/latency alerts, cancellation, data cleanup, poison-message behavior |
| Billing | Backend route presence and pricing UI | **C** internal/test mode only | Separate finance/reconciliation, webhook signature, entitlement, refund/tax/support, idempotency, test-mode rehearsal; no production payment launch in this release |
| Notifications/push/WhatsApp approval delivery | Routes and approval delivery patterns exist | **C** | Phone/email ownership, opt-in/opt-out, templating policy, delivery failures, no sensitive content in notification, per-channel approval and audit |
| Social/outcomes/moderation | Routes/modules exist | **C** | Community policy, moderation queue, abuse reporting, privacy model, visibility defaults, retention/deletion, admin RBAC |

## 4. Mandatory Feature-Activation Sequence

Do not activate every enabled flag in one staging deployment. The required sequence is designed to find data/security failures before agentic or external features multiply blast radius.

| Ring | Eligible scope | Participant cohort | Minimum evidence before advancing | Expansion blocker |
|---|---|---|---|---|
| **0 — Platform rehearsal** | Infrastructure, RLS, backup/restore, auth, health/readiness, disabled flags verified | Engineering only | All global red gates; migration passed; deny probes pass; rollback rehearsal | Any RLS, credential, secret/logging, or health failure |
| **1 — Safe public and account staging** | Public pages, auth/onboarding, account/profile, blog, pricing information | Staff + synthetic accounts | Accessibility pass, account isolation, rate limits, analytics consent, error/alert test | Cross-user access, bad password-reset/session path, misleading pricing/capability claim |
| **2 — Controlled candidate pilot** | Resume upload/paste, job-link import, free scan, job search/save/pipeline, cover letter, review queue | Up to five informed participants | Consent, PII scrub, real-resume and real-public-link scripts, no-fabrication test, deletion evidence | Any raw PII leak, AI fabrication, missing consent/deletion, SSRF regression, false success |
| **3 — Bounded preparation automation** | AutoPilot preparation only; task workspace planning/review; internal document outputs | Same five trusted participants, one run each | `auto_apply=false` proven at every tier; five-job cap; per-run consent/preflight; cancellation; review queue external-side-effect proof; 24-hour soak | Any employer/email/browser/billing effect, absent audit, shared/incorrect rate limit, queue/cost runaway |
| **4 — Specialist feature pilots** | Knowledge/career insights, portfolio preview, answer bank, analytics, outreach/referral drafts, company radar | Opt-in pilot subgroup | Feature-specific provenance, source/freshness, draft-only and privacy tests | Unsupported claim, stale/unattributed data, hidden publishing/send action |
| **5 — Internal advanced evaluation** | Extension, linked content import, One-Shot, connector/MCP, batch scraping, internal analytics/admin | Staff only | Separate threat model and explicit capability checklist per feature | Any request to expose these features to candidates without completed evidence |
| **6 — Explicitly blocked** | Browser automation, computer control, desktop agent, Apply Agent, Workspace Automation, Gmail/Calendar/Drive, voice/AI coaching, real billing | None | Separate launch proposal; all D-gate requirements complete | No exceptions through direct routes, preview links, support intervention, or flag override |

## 5. Final Staging Campaign — What Must Actually Be Tested

### 5.1 Ring 0: Platform rehearsal

1. Create an immutable release tag and deploy only its artifacts into a separate staging environment.
2. Verify new staging secrets, allowed origins, reverse-proxy CIDRs, private Python AI network, provider quota, object storage, and error-tracking environment label.
3. Take a backup, apply `20260824_02_public_data_access_hardening.sql` as `supabase_admin`, then run `scripts/check_public_table_rls.sh`.
4. Run non-destructive anonymous REST denial probes for `api_keys`, `applications`, `saved_sources`, and `password_reset_tokens`. Expected result: denial, never data.
5. Rehearse a controlled restore into a disposable database and a feature-flag/route kill switch.
6. Confirm the production-like build hides/redirects Apply Agent and keeps all D features off.

### 5.2 Ring 1: Account and public-surface test

Use synthetic accounts first. Test registration, login, logout, password reset, session expiry, protected-route redirect, profile update, account deletion/export, and owner-only access. Exercise all public static pages on desktop/mobile. Verify legal/capability claims are not ahead of enabled feature scope.

### 5.3 Ring 2: Real-resume and real-job-link pilot

Before a real participant uploads a resume, remove the current client `console.log` of extracted resume content from `src/pages/ResumeUpload.tsx` and prove its absence in browser console, server logs, analytics, and error tracking. The participant must see a versioned staging consent notice, a truthful AI disclaimer, retention/deletion method, and explicit statement that no job application will be submitted externally.

Test PDF/DOCX and pasted resumes, review text extraction, paste/import a public allowlisted job URL, edit imported job description, run analysis, include an intentionally unsupported requirement, inspect whether Tayari says “unknown/gap” rather than inventing facts, and test a provider failure. Record IDs/statuses/latency—not raw resume or job-content bodies. Rehearse account/data deletion.

### 5.4 Ring 3: Candidate-initiated preparation run

Enable only the existing AutoPilot preparation path. Require a visible preflight summary with selected resume, query, location, maximum five jobs, expected provider usage, `auto_apply=false`, and a statement that the run cannot submit an application or contact an employer. The user presses Start; the system records a run ID and audit event; the user can cancel; results enter review. Approve and reject a prepared item and prove, through gateway/worker/integration logs and network observation, that approval only changes Tayari’s internal state.

No feature may claim a run was “submitted” unless an independently verifiable external submission receipt exists. In this campaign, no external submission is authorized, so “submitted” must never appear.

### 5.5 Rings 4–6: Do not compress evidence

Specialist, extension, connector, browser, desktop, and communication features must each receive their own test plan after the core candidate pilot succeeds. Passing Ring 2 does not make data-intensive/agentic features safe. The goal is gradual proof, not feature-count maximization.

## 6. Feature-Specific Go/No-Go Questions

Before enabling any feature for a broader cohort, answer all of these in writing with links to evidence:

| Question | Required answer for GO |
|---|---|
| Who can invoke it? | A precisely defined authenticated/public role; unauthenticated behavior is intentionally denied or rate-limited. |
| What user data does it read/write? | Explicit inventory, owner/tenant policy, retention/deletion behavior, and logging/telemetry treatment. |
| What third-party data/service does it call? | Provider, scope, data shared, contract/policy basis, quota/cost cap, outage behavior, and revocation path. |
| What real-world side effect can occur? | None, or a clearly separated user-reviewed/approved action with proof, audit trail, and cancellation. |
| How can it fail? | Truthful visible error, no fabricated result, no partial unsafe state, retry/rollback behavior defined. |
| How can it be disabled? | Feature flag/route/API/worker kill switch with target disable time under 10 minutes. |
| How is user harm detected? | Alerts, request/run ID, audit record, dashboard, human owner, and response runbook. |
| How is quality measured? | Sampled evaluation, false-positive/fabrication review, latency/cost/error target, and minimum pass threshold. |

A feature that cannot answer these questions is internal code, not a production feature.

## 7. Production Promotion Criteria After Final Staging

The product becomes a credible candidate for a narrow public production launch only after all conditions below are simultaneously true.

| Production condition | Required proof |
|---|---|
| Final staging rings 0–3 pass | Signed evidence ledger with no unresolved red gates and 24-hour soak for each enabled core workflow |
| Real-user pilot is safe | Five informed participants completed core flows; no PII leakage, cross-account access, fabricated material, unauthorized action, or unhandled data-deletion request |
| Operations are real | On-call rotation, paging/alerts, dashboards, backup/restore owner, incident runbook, feature kill switches, and postmortem process tested |
| Deployment is repeatable | Versioned migration runner/schema ledger, CI artifact promotion, environment configuration review, no manual tribal-knowledge deployment step |
| Core quality is acceptable | Baseline quality/error metrics stated, ongoing sampling active, user feedback triage staffed, remaining lint/a11y/dependency remediation owned with dates |
| Scope is truthful | Public navigation/copy shows only launched capabilities; blocked features cannot be reached through direct URLs or hidden flags; pricing reflects real service |
| Legal/privacy review is complete | Privacy policy, consent, data-subject deletion/export, vendor/process register, platform-policy reviews, and support escalation are ready for actual users |

**A production launch must be narrow.** The recommended first production scope is public information, authentication, resume upload/paste, public job-link import, free ATS scan with a hard quota, job search/save/pipeline, cover-letter drafting, and candidate review queue. AutoPilot may follow only after the bounded staging preparation run proves no external effect. The remaining advanced features remain progressively gated.

## 8. Consolidated Evidence Ledger

Every row needs an executor, timestamp, artifact link/file, result, approver, and retest record. Blank means no-go.

| Category | Mandatory item | Ring | Result | Approver |
|---|---|---:|---|---|
| Platform | Immutable SHA, image digests, review/change list | 0 |  |  |
| Security | Full CI, dependency/security gate, secret/log scrub | 0 |  |  |
| Data | Backup/restore, RLS migration, RLS release gate, negative REST probes | 0 |  |  |
| Network | TLS/origin/proxy/internal-AI validation | 0 |  |  |
| Auth | Synthetic sign-up/reset/session/tenant-isolation test | 1 |  |  |
| Public UI | Accessibility/mobile/static claim review | 1 |  |  |
| Resume | Remove console PII log, file/paste test, parsing review, deletion | 2 |  |  |
| Job import | Public allowed URL and SSRF/redirect/oversize negative suite | 2 |  |  |
| AI | Unsupported-fact, injection, outage, schema, latency/cost tests | 2 |  |  |
| Candidate data | Cross-account test across resume/JD/analysis/jobs/runs | 2 |  |  |
| Review queue | Approve/reject ownership, expiry/replay, no external-side-effect proof | 2–3 |  |  |
| Free scan | Two-client rate-limit canary, abuse/cost cap, privacy disclosure | 2 |  |  |
| AutoPilot | `auto_apply=false` at UI/gateway/backend, five-job cap, cancellation, kill switch | 3 |  |  |
| Queue/workers | Idempotency, retries, cancellation, health/latency alerting | 3 |  |  |
| Specialist features | Per-feature evidence checklist above | 4–5 |  |  |
| Blocked features | Direct URL/feature flag/API cannot bypass D classification | 0–6 |  |  |
| Observability | Alert, synthetic error, PII scrub, dashboard, 24-hour soak | all |  |  |
| Rollback | Feature kill switch, prior artifact redeploy, restore rehearsal | all |  |  |

## 9. Final Decision Wording

The release approver may declare **GO — controlled final staging** only after signing:

> “For release SHA `________`, I have reviewed the completed evidence ledger. Every red gate required for the enabled rings passed in the isolated staging environment. Current public claims match current enabled capabilities. Real candidate data is isolated, scrubbbed from telemetry, deletable, and inaccessible across users. AI failures are honest and unsupported facts are not invented. No enabled automation creates an external side effect without explicit user approval, and the core AutoPilot path is proved `auto_apply=false`. We can detect, disable, and roll back the enabled scope. All advanced features outside the authorized ring remain technically and visibly unavailable.”

The decision alternatives are only **GO**, **NO-GO**, or **HOLD FOR EVIDENCE**. “The feature is already in the codebase” is never a fourth option.

## 10. Linked Operating Documents

This document supersedes no safety requirement; it consolidates and should be used with:

- `PRODUCTION_READINESS_AUDIT_2026-08-24.md` — audit findings and implemented hardening.
- `STAGING_LAUNCH_COMMAND_PLAN_2026-08-24.md` — deployment ordering, RLS migration, observability, and rollback procedure.
- `REAL_USER_STAGING_PROTOCOL_2026-08-24.md` — consent, real-resume/job-link, and bounded automation user-test protocol.
- `backend/db/migrations/20260824_02_public_data_access_hardening.sql` and `scripts/check_public_table_rls.sh` — mandatory database authorization release controls.
