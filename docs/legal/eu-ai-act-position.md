# EU AI Act — JobTayari Position

**Date:** 2026-08-11
**Status:** POSITION DOCUMENT — not legal advice. This codifies the policy already enforced by the codebase. JobTayari must obtain a qualified lawyer's review of this position before any B2B / employer-facing pivot.

## Scope

JobTayari is a **candidate-side** job-search tool. It does **not** screen, rank, score, or shortlist candidates for employers. It generates application materials (resumes, cover letters, outreach messages) on behalf of a single candidate, and it gives that candidate tools to track their own search. The AI acts on behalf of the *candidate*, not the employer. No employer-facing routes exist in the codebase today.

## Why candidate-side matters

Annex III of Regulation (EU) 2024/1689 lists the AI uses deemed high-risk. Item 4(a) covers "AI systems intended to be used for recruitment or to screen candidates for jobs." JobTayari does **not** do this. It helps a candidate write their own resume, draft their own outreach, and track their own applications. The high-risk obligations triggered by *screening candidates for an employer* do not attach to a tool that *helps a candidate present themselves*.

This distinction is the load-bearing one. Candidate-side assistance is the wedge; the ATS-side trust layer is the business. Any pivot across that line pulls the product into deployer territory (see Production Readiness §4 / §5, and the audit's §1.5 uncomfortable question).

## Deployer obligations (live 2 August 2026)

The deployer obligations under the AI Act apply to employers deploying AI for screening, ranking, or hiring decisions. As of the audit date these obligations are in force. JobTayari is **not a deployer** in this sense and has no employer-facing product.

**Bright line:** The moment JobTayari ships **any** employer-facing feature — candidate scoring, a recruiter dashboard, candidate ranking, automated shortlisting — it inherits deployer obligations under Reg. 2024/1689 (DPIA, human oversight, post-market monitoring, transparency to candidates, conformity with provider requirements). Until that line is crossed, the high-risk Annex III obligations do not attach. This position treats that line as a hard product boundary, not a configuration toggle.

## Transparency duties

The AI Act's transparency duties mean AI-generated application content should be disclosable. JobTayari's receipts already provide this: every submission produces an immutable artifact of exactly what was sent (`submission_receipts` with the content, target, timestamp, and outcome). The candidate can disclose AI assistance transparently to an employer at any time — the system never hides that AI was used, because the artifact is the proof.

This is candidate-side transparency (the candidate knows and can prove what they sent). It is distinct from, and does not satisfy, the deployer-side transparency obligations an employer would owe to a candidate under Annex III. Those do not apply to JobTayari today because JobTayari is not the deployer.

## Action items

1. **Do not ship employer-facing scoring/ranking/shortlisting** without a full Data Protection Impact Assessment and a qualified lawyer's review. This is the bright line above.
2. **Keep the candidate-side / deployer-side boundary explicit in the codebase.** It already is: no employer-facing routes exist in `backend/go/internal/api/`, and the AI engine has no candidate-scoring surface. Any new route that scores or ranks candidates must gate behind a feature flag AND a legal review — it is a P0 change, not a routine addition.
3. **Get a real lawyer to review this position** before any B2B pivot. This document is an engineering position, not legal advice; it does not substitute for counsel.
4. **Document AI-disclosure in the Terms of Service.** Add an explicit clause that application materials may be AI-assisted and that the candidate is responsible for disclosure to the recipient employer. The receipts are the mechanism; the ToS clause is the notice.
5. **Re-verify the date gate.** Deployer obligations began 2 August 2026 — already passed. Any future amendment timeline, guidance note, or implementing-delegated-act from the AI Office must be checked before each B2B step.

## Sources

- Regulation (EU) 2024/1689 (the EU AI Act) — Annex III item 4(a) (recruitment / candidate screening as high-risk); digital-strategy.ec.europa.eu.
- DLA Piper, "Deployer obligations under the AI Act: implications for employers from 2 August 2026" — source for the deployer-obligations-effective-date and the candidate-vs-employer distinction.
- `docs/JOB_TAYARI_RUTHLESS_AUDIT_PLAN.md` §1.5 (Legal and platform risk) and §8 Sources — the audit's source material for this position.
- `JobTayari_Production_Readiness_and_Moat.md` §4 (positioning: candidate-side wedge, ATS-side trust layer as the possible business, and the note that any such pivot pulls the product into EU AI Act deployer territory).