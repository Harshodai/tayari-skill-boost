# LinkedIn Terms of Service — JobTayari Policy

**Date:** 2026-08-11
**Status:** POLICY — codifies what the code already enforces. Not legal advice; JobTayari should obtain a qualified lawyer's review if this policy is ever changed.

## The policy

JobTayari does **not** automate LinkedIn actions. LinkedIn is excluded from automated submission, connection requests, profile scraping, and automated messaging. LinkedIn job postings can be saved to the pipeline and viewed manually (read-only), but they are **never** submitted via automation. The user clicks Submit on LinkedIn themselves.

## Why

LinkedIn's User Agreement §8.2 (effective 3 Nov 2025) prohibits, in plain text:

- software, scripts, bots, and browser plug-ins that scrape or copy the Services;
- unauthorized automated methods to access the Services, add contacts, or send messages;
- overlaying or otherwise modifying the Services' appearance; and
- circumventing access controls or use limits.

LinkedIn's "Prohibited software and extensions" help page names browser extensions explicitly. Enforcement is **account termination** — and it is enforced against the **user**, not against JobTayari. Any feature that automates a LinkedIn action puts *the user's* LinkedIn account at risk. That is an unacceptable cost to impose on a user, regardless of whether LinkedIn could ever reach us.

LazyApply's documented "LinkedIn ban risk" is the lived proof: users lost their accounts, and it is a recurring complaint in their reviews (audit §1.5). JobTayari will not repeat that failure mode.

## Code enforcement

The policy is not a paragraph in a doc — it is a single chokepoint in the code that fails closed:

- `backend/python/app/services/linkedin_policy.py` — `is_linkedin_url(url)` and `assert_not_linkedin_automation(url, action)`. The guard uses an **allowlist** of allowed read-only actions (`view`, `save`); it raises `LinkedInAutomationBlocked` for any action outside that set on any `linkedin.com` host or subdomain (e.g. `in.linkedin.com`). The user can still save a LinkedIn posting and prep a resume against it.
- `backend/python/app/services/automation_engine.py:516` calls `assert_not_linkedin_automation(url, "submit")` before any submit. On block, the application is marked `skipped_linkedin_policy` — not errored, not retried, not silently dropped.
- `backend/python/app/services/browser_library.py:103` calls the same guard again as defense-in-depth, so a direct browser-library caller cannot bypass the engine.
- `backend/python/app/services/ats_tiers.py` puts LinkedIn and USAJobs in the `do_not_submit` tier — the tier gate in `run_autopilot` skips them before any apply attempt, separate from and in addition to the URL guard.
- UI warning — `src/pages/AutoPilot.tsx:401-415` and `src/pages/ApplyAgent.tsx:40-131` show an inline, unmissable notice citing UA §8.2 when a LinkedIn URL is entered: *"LinkedIn submissions are not automated. LinkedIn's User Agreement §8.2 prohibits bots and enforcement is account termination. We'll save the job and prep your resume, but you submit manually."*

The code and this document are kept in sync by design: **docs follow code, not the other way around.** If the code ever changes to permit LinkedIn automation, this policy must be rewritten and re-reviewed before that change merges — it is a P0 legal-gate change.

## What IS allowed

- Saving a LinkedIn job posting to the pipeline (read-only).
- Viewing the posting manually in the user's own browser.
- Drafting a resume and cover letter tailored to a LinkedIn posting.
- The user clicking Submit on LinkedIn themselves, by hand.

None of these actions are automated by JobTayari. The boundary is: JobTayari prepares; the human submits.

## ATS portals we DO automate

LinkedIn is the exception, not the rule. JobTayari automates ATS vendor portals per an **internal JobTayari risk decision** — no vendor sanctions third-party submission (see `ats_tiers.py`'s own docstring: "No major ATS offers a sanctioned third-party submission API"). The tiers are JobTayari's risk call, not vendor approval:

- **Friendly tier (JobTayari internal risk decision — submit OK when the user approves; not a vendor sanction):** Greenhouse, Lever, Ashby, Workable, Recruitee, BambooHR, Jobvite.
- **Difficult tier** (prepare + stop at the approval gate, never auto-submit even with approval): Workday, SmartRecruiters, iCIMS, Taleo, SuccessFactors.
- **Do-not-submit tier** (skip entirely, manual-only): LinkedIn, USAJobs.

Vendors without explicit supporting provider policy remain **prepare-only** — in code, an unknown vendor resolves to `None` from `tier_for_url`/`tier_for_vendor`, and `automation_engine` treats `None` as prepare-only (`prepared_ats_difficult`), the same as the difficult tier.

See `backend/python/app/services/ats_tiers.py` for the authoritative `VENDOR_TIERS` table. The tier of a vendor is resolved from the URL before any apply attempt; `do_not_submit` short-circuits to `skipped_ats_tier`, `difficult` short-circuits to `prepared_ats_difficult` (a prepared receipt is saved but the apply call is never made).

## Sources

- LinkedIn User Agreement §8.2 (eff. 3 Nov 2025) — linkedin.com/legal/user-agreement.
- LinkedIn "Prohibited software and extensions" help page — linkedin.com/help/linkedin/answer/a1341387.
- `docs/JOB_TAYARI_RUTHLESS_AUDIT_PLAN.md` §1.5 (Legal and platform risk) and §8 Sources — the audit's source material and the directive to document this policy explicitly.
- `backend/python/app/services/linkedin_policy.py` and `backend/python/app/services/ats_tiers.py` — the code this policy codifies.