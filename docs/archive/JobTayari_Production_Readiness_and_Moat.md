# JobTayari — Commercial Launch Readiness & Defensibility Report

**Date:** 29 July 2026
**Scope:** hosted, multi-tenant SaaS product (NOT self-hosted distribution)
**Method:** full read-only codebase audit (frontend, Go gateway, Python AI engine, DB migrations, edge functions, CI) + market/legal web research

---

## 0. Executive verdict

Two hard truths, stated plainly.

**1. You do not have one product — you have two half-products in one repo.**
A Supabase-native app (what `tayari-skill-boost.lovable.app` actually loads) and a Go+Python+Postgres stack (`backend/go`, `backend/python`) that implement *overlapping* features. The deployed frontend has no `VITE_API_URL` and no dev/host proxy for `/api`, so every page importing `@/api` (31 files, including Dashboard, JobSearch, Pipeline, CoverLetter, OneShotPipeline, KnowledgeHub) is calling a backend that is not reachable from the hosted build. This is the single biggest launch blocker and it is architectural, not cosmetic.

**2. As currently specified, the product is replaceable in weeks.**
Resume tailoring, ATS scoring and cover letters are now commodity LLM wrappers — competitors' own marketing concedes it ("Teal is a ChatGPT wrapper. So is Rezi. So is Kickresume's AI writer" — joblabs.ai, 2026). The market has compressed to a $13–40/mo tracker+AI tier (Teal $13/wk, Huntr ~$40/mo, Simplify+, Careerflow) and a $18–59 apply-volume tier (LazyApply, PitchHired, Sonara), with new clones (ApplyArc, JobMentis, Stealth Apply) launching monthly. Your 27 feature flags are **not** a moat; they are surface area you must maintain.

The defensible version of this business exists — it is described in §4 — but it is not "more AI features."

---

## 1. READY TO DEPLOY

| Area | Evidence |
|---|---|
| **Stripe billing** | `backend/go/internal/api/routes_billing.go` — real checkout session, billing portal, webhook with signature verification (`billing.VerifyStripeSignature`), subscription state persisted by `user_id`. Frontend token bug already fixed. |
| **Auth (Supabase path)** | Email/password + Google OAuth configured, HIBP breach checking live, password strength meter, k-anonymity SHA-1 client-side hashing, rate-limited login. |
| **API rate limiting** | `internal/api/middleware.go:73-182` — real per-client token bucket with exponential penalty backoff after 5 strikes. |
| **Observability** | Sentry wired in all three runtimes (`src/main.tsx`, `cmd/server/main.go:29-41`, `app/main.py:41-48`), env-gated. `RouteErrorBoundary` captures frontend crashes. |
| **CI** | `.github/workflows/ci.yml` — Go build + `-race` tests + 80% coverage gate; Python ruff + pytest + 80% gate; extension tsc/eslint; frontend build + test. Genuinely enforced. |
| **MCP server** | 4 OAuth-protected tools live and deployed; real differentiator (see §4). |
| **Security posture** | CORS allowlisting, payload limits (413), IP throttling, extension `externally_connectable` locked, no token-in-URL, LaTeX PII flags. |
| **Design system / UI shell** | AppShell, mobile tab bar, responsive Smart Search master-detail, command palette, welcome tour. |

**Verdict: this layer is genuinely shippable.**

---

## 2. NOT READY — launch blockers (must fix before charging money)

### B1 — Split-brain backend *(CRITICAL)*
Supabase edge functions (`analyze-resume`, `generate-resume-pdf`, `check-rate-limit`) duplicate Go/Python functionality. Committed `.env` configures only Supabase. Result: data written in one store never reaches the other; hosted pages calling `/api/...` 404 or silently degrade.
**Fix:** pick ONE authoritative backend for the hosted product. Recommendation: **Supabase + edge functions for hosted SaaS**; keep Go/Python as the self-host/enterprise SKU. Then delete or hard-gate every `@/api` call path in the hosted build.

### B2 — Multi-tenancy is decorative *(CRITICAL)*
`tenants`/`memberships` tables and `tenantMiddleware` exist, but `tenant_id` appears in **only 5 places in the entire Go API layer**, all in advisor/cohort routes. Every other handler filters by `user_id` alone. You cannot sell a B2B2C/agency tier on this.
**Fix:** either enforce tenant scoping in every query path (+ RLS on Supabase side), or drop "multi-tenant" from marketing and treat `tenants` as branding-only.

### B3 — GDPR: no account deletion, unverified export *(CRITICAL, legal)*
`Settings.tsx:552-568` — "Delete Account" is a `disabled` button with `title="Coming soon"`. No backend delete route exists anywhere. "Export Your Data" wiring unconfirmed. You are holding resumes and employment history — this is Art. 17 exposure from day one in the EU/UK.
**Fix:** real cascade-delete endpoint + verified JSON/ZIP export + 30-day retention policy documented in Privacy.

### B4 — No backups / DR *(CRITICAL)*
Zero backup, retention, or restore configuration in the repo for the hosted path. `scripts/backup.sh` targets the self-hosted Postgres.
**Fix:** enable managed PITR, document RPO/RTO, run one live restore drill before launch.

### B5 — Silent AI fallback serves fabricated output *(HIGH, trust + legal)*
`strategic_analyzer.py` falls back to `_fallback_analysis()` on any exception; `/health` reports `active_engine: mock`. The only disclosure is a passive `DemoModeBanner`. A paying user can receive invented career analysis presented as real.
**Fix:** hard-fail premium actions when the engine is mock; never bill a credit for a fallback response.

### B6 — Scraping legal exposure *(HIGH, legal)*
Hermes sets an honest User-Agent but has **no robots.txt check and no outbound backoff**. hiQ v. LinkedIn resolved on remand in LinkedIn's favour — LinkedIn may enforce its User Agreement against scraping (news.linkedin.com, 2022), and enforcement escalated through 2025-26 (Bloomberg Law). Auto-apply tools also carry documented user-account ban risk (LazyApply reviews, 2026).
**Fix:** licensed/official feeds only for the hosted product (Adzuna, Greenhouse/Lever public boards, USAJobs, employer career-page RSS). Keep aggressive scraping in the self-host SKU where the user, not you, is the operator.

### B7 — Feature sprawl / dead surface *(HIGH, product)*
27 flags; `interviewPrep`, `interviewAI`, `voiceCoach` built but off in both envs. 7+ DB tables with zero code references (`application_attempts`, `interview_messages`, `learning_resources`, `platform_configs`, `tailored_resumes`, `user_sessions`, `voice_note_files`). Internal codenames leaked to users.
**Fix:** ship 5 features, delete or archive the rest. Every dead route is a support ticket and a QA cost.

---

## 3. PARTIAL — fix in first 60 days

| Item | Gap |
|---|---|
| Typst PDF | Confirm `typst` binary in prod image; today it silently degrades to fallback format. |
| Stripe webhooks | No visible idempotency/replay dedupe on event ID — verify `billing.ProcessStripeWebhook`. |
| `USE_SUPABASE` / `VITE_USE_SELF_HOSTED` | Defaults to local JWT; must be pinned explicitly per environment or auth diverges between frontend and gateway. |
| ToS / Privacy | Pages exist with real content but have not had legal review; must add AI-disclosure, sub-processor list, retention schedule. |
| Sentry DSNs | Env-gated → silently disabled if unset. Confirm populated in the live environment. |
| Test coverage | `bun run test` runs only `ResumeGraph*` specs. Frontend coverage is effectively unmeasured. |
| Pricing page | No enforced entitlement mapping between Stripe plan and feature gates in the frontend. |

---

## 4. Uniqueness — how this becomes hard to copy

### What is NOT a moat (stop investing here)
- Resume tailoring / cover letters / ATS keyword scoring — free ChatGPT prompt, conceded by competitors.
- Number of features — clones ship the same checklist monthly.
- "AI-powered" anything — table stakes.
- Auto-apply volume — a shared arms race against LinkedIn detection that the platform can end unilaterally; also the highest ban-risk, lowest-trust segment.
- Compliance (LL144, EU AI Act) — those target **employer** screening tools; a job-seeker tool is out of scope, so it earns you nothing defensively.

### The four moats actually available to you

**M1 — Agent-native distribution (you already have a head start).**
You have a deployed, OAuth-protected MCP server. Almost no competitor in this category does. As ChatGPT/Claude/Cursor become where people *start* the job search, being the callable career backend — "Claude, tailor my resume for this role and add it to my pipeline" — is a distribution position, not a feature. **Double down: expand to 12–15 tools, get listed in the ChatGPT and Claude connector directories, and make MCP the headline of the product, not a footnote.**

**M2 — Closed-loop outcome data.**
No vendor in this market publishes verified interview-to-offer conversion tied to specific resume edits. If you instrument every automation run → application → recruiter reply → interview → offer, and let users self-report outcomes, in 12–18 months you own a dataset nobody can buy. That dataset powers honest claims ("this edit pattern lifted callback rate 22% across 4,100 applications") and is the only asset here that compounds.

**M3 — The provenance / trust layer.**
Your privacy architecture is real (local LLM support, PII flags, self-host mode). Turn it into a visible product: a per-run **"what left your machine"** ledger — every byte sent, to which model, retained for how long, deletable in one click. Enterprise outplacement and university career centers *cannot buy this* from Teal or LazyApply, and it converts the self-host code you already wrote into a hosted-tier selling point rather than dead weight.

**M4 — B2B2C distribution, not D2C SEO.**
Every competitor fights on comparison-SEO — the least defensible channel that exists. The channels with evidence of working: outplacement firms and university career centers (JobWinner.ai sells white-label to exactly this; Streeme's traction is 2 paying outplacement clients + 7 alumni-network partnerships). These buyers need multi-tenancy, cohort dashboards, SSO/SAML, and a DPA — which is precisely why **B2 (multi-tenancy) is a revenue blocker, not just a hygiene item.** You already have `AdvisorDashboard.tsx` and a cohort schema; finish it and you have a product Teal doesn't sell.

### Recommended positioning
> **JobTayari — the career operating system your AI assistant can drive.**
> Not another resume tool. A private, agent-callable career backend with a verifiable record of what worked, sold to individuals and to the institutions that place them.

Drop "Autopilot"/blind auto-apply as the headline. It is the most commoditized, most legally exposed, lowest-trust part of your surface — and it actively undermines M3.

---

## 5. Sequenced plan to launch

**Phase 0 — Unblock (2–3 weeks).** Pick one backend (B1). Kill or gate every unreachable `@/api` page. Ship delete-account + data export (B3). Enable PITR + one restore drill (B4). Hard-fail mock AI on paid actions (B5).

**Phase 1 — Legal & trust (2 weeks).** Replace scraped feeds with licensed/official job sources (B6). Legal review of ToS/Privacy + AI disclosure + sub-processor list. Ship the "what left your machine" ledger (M3).

**Phase 2 — Focus (2 weeks).** Cut to 5 core surfaces: Smart Search, Resume Studio, Apply Assist, Pipeline, Interview Prep. Delete dead flags, dead routes, dead tables (B7). Wire Stripe entitlements to feature gates.

**Phase 3 — Moat (6–8 weeks).** Enforce tenant scoping + cohort dashboards + SSO for the institutional tier (B2/M4). Expand MCP to 12–15 tools and pursue connector-directory listings (M1). Instrument the outcome loop end-to-end (M2).

**Do not launch paid before Phase 0 and Phase 1 are complete.** Everything after that is growth work.

---

### Sources
tealhq.com/pricing · noxjobs.com (Teal/Huntr/Careerflow, 2026) · joblabs.ai/resume/chatgpt-vs-teal · joblabs.ai/resume/chatgpt-vs-rezi · help.simplify.jobs · applyarc.com · jobmentis.com · pitchhired.com · scale.jobs (LazyApply ban risk, 2026) · interviewcoder.co (Final Round AI) · developer.greenhouse.io (Candidate Ingestion partner API) · hire.lever.co/developer/partner · news.linkedin.com (hiQ remand, 2022) · Bloomberg Law (LinkedIn anti-scraping, 2025-26) · nyc.gov/DCWP (LL144) · euaiactnyc.com (Annex III timeline) · jobwinner.ai/career-platform/outplacement-services · loyal.vc/portfolio/streeme
