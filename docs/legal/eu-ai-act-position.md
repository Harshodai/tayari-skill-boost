# EU AI Act — JobTayari Position

**Date:** 2026-08-11
**Status:** POSITION DOCUMENT — not legal advice. This codifies the policy already enforced by the codebase. JobTayari must obtain a qualified lawyer's review of this position before any B2B / employer-facing pivot.

## Scope

JobTayari is a **candidate-side** job-search tool. It does **not** screen, rank, score, or shortlist candidates for employers. It generates application materials (resumes, cover letters, outreach messages) on behalf of a single candidate, and it gives that candidate tools to track their own search. The AI acts on behalf of the *candidate*, not the employer. No employer-facing routes exist in the codebase today.

## Why candidate-side matters

Annex III of Regulation (EU) 2024/1689 lists the AI uses deemed high-risk. Item 4(a) covers "AI systems intended to be used for recruitment or to screen candidates for jobs." JobTayari does **not** do this. It helps a candidate write their own resume, draft their own outreach, and track their own applications. The high-risk obligations triggered by *screening candidates for an employer* do not attach to a tool that *helps a candidate present themselves*.

This distinction is the load-bearing one. Candidate-side assistance is the wedge; the ATS-side trust layer is the business. Any pivot across that line pulls the product into deployer territory (see Production Readiness §4 / §5, and the audit's §1.5 uncomfortable question).

## Deployer obligations (Article 50 transparency live 2 August 2026; Annex III high-risk deferred to 2 December 2027)

Two regimes, two dates — and they attach to different roles:

- **Article 50 transparency obligations** (the AI Act's transparency chapter) are live for deployers from **2 August 2026**. Article 50 also imposes **provider** duties: Article 50(1) (AI systems that interact with individuals must disclose that the individual is interacting with an AI) and Article 50(2) (providers of AI systems generating synthetic audio, image, video, **or text** content must ensure outputs are marked machine-readable and detectable as artificially generated). Whether JobTayari is the provider of its resume/cover-letter generation, chat, and agent features is **not asserted here**: provider status under Art. 3(3) must be assessed **separately for each integrated first- or third-party AI system** — the provider is the party that develops an AI system or has it developed and places it on the market or puts it into service under its own name or trademark — and that role classification requires legal confirmation. Regulation (EU) 2026/1744 adds a **separate transition for Article 50(2)**: providers of such systems **placed on the market before 2 August 2026** have until **2 December 2026** to meet the marking and detection obligations — distinct from the Annex III deferral to 2 December 2027 below. Compliance is NOT asserted until legal review confirms any exception and the applicable transparency control (e.g. an AI-output disclosure marker on generated application materials) is implemented and verified.
- **Annex III high-risk obligations** under Chapter III Sections 1–3 are **deferred to 2 December 2027** by Regulation (EU) 2026/1744 (the "delay regulation"). Annex III item 4(a) covers "AI systems intended to be used for recruitment or to screen candidates for jobs." JobTayari does **not** screen, rank, or shortlist candidates for an employer — it helps a candidate present themselves — so the Annex III high-risk obligations do not attach today. The candidate-side rationale is the load-bearing exclusion; any exception (e.g. an employer-facing feature) requires legal review before asserting continued non-applicability.

JobTayari's **deployer status is not asserted categorically**: a "deployer" is a natural or legal person using an AI system in the course of a professional or non-professional activity, **excluding personal non-professional activity** (Art. 3(4)) — an individual candidate applying for jobs with JobTayari may fall on the personal-use side of that carve-out. Whether JobTayari itself is a deployer of the AI systems it operates — first-party or third-party systems used under its authority — is a separate assessment that depends on how the tool is offered and used. JobTayari also remains a candidate-side tool with no employer-facing product, so employer-facing deployer obligations do not attach today. **Qualified counsel should confirm this role allocation before the position is relied upon.** The deferral matters anyway — high-risk obligations are postponed, not dead; the gap to 2 December 2027 is the window in which a B2B pivot is cheapest from a compliance standpoint.

**Bright line:** The moment JobTayari ships **any** employer-facing feature — candidate scoring, a recruiter dashboard, candidate ranking, automated shortlisting — it inherits deployer obligations under Reg. 2024/1689. Until that line is crossed, the high-risk Annex III obligations do not attach. This position treats that line as a hard product boundary, not a configuration toggle.

Role-specific obligations (what attaches, and to whom, once the line is crossed):

| Obligation | Attaches to | Gate |
|---|---|---|
| Conformity assessment (Annex VI/VII), technical documentation, risk management, quality management, logging, transparency to deployers | **Provider** (JobTayari, if it ever places a high-risk system on the EU market) | 2 Dec 2027 |
| Human oversight, post-market monitoring (deployer-side cooperation), transparency to candidates under Article 50 | **Deployer** (the employer customer deploying the system) | Article 50 transparency live 2 Aug 2026; the rest deferred to 2 Dec 2027 |
| DPIA | Not an AI Act deployer obligation per se — a **GDPR (Art. 35)** obligation for the **controller** (likely the employer), triggered by large-scale/high-risk processing | GDPR, not AI Act |

## Transparency duties

Provision-by-provision:

- **Article 50(2) (provider output marking):** AI-generated content (e.g. an AI-written cover letter) must be marked machine-readable/detectable when output by a provider's system. This is the **PROVIDER's** obligation — JobTayari, as the provider of an AI tool, would be responsible for marking its outputs (e.g. embedding a machine-readable disclosure in generated application materials), NOT the deployer.
- **Article 50(4) (deployer disclosure):** deployers of AI systems that generate/deepfake content must disclose that content is AI-generated — LIMITED to the stated deepfake and public-interest text scenarios. A candidate submitting AI-assisted application materials is not within that deployer scope: the candidate is an individual user, not the deployer described in Art. 50(4).
- **Implementation status:** no output-marking control exists in the codebase today. Recommended (not yet implemented): a test asserting generated cover letters carry an AI-generated disclosure marker (machine-readable metadata on the generated artifact), implementing the Art. 50(2) provider-side mechanism.

Candidate-side transparency is separate: every submission produces an immutable artifact of exactly what was sent (`submission_receipts` with the content, target, timestamp, and outcome). Receipts and the Terms of Service clause are **contractual evidence and notice** — they let the candidate prove what was sent and put the candidate on notice of the tool's AI-disclosure policy — and are **not substitutes for statutory obligations**. Within the described candidate-submission flow, Article 50(4)'s specified conditions may not be triggered: that deployer disclosure duty is limited to the stated deepfake and public-interest-text scenarios, and if the candidate's use is personal and non-professional, and the submission is not deepfake content or text published to inform the public on matters of public interest, Article 50(4) may not be triggered for the candidate. JobTayari's own role requires separate assessment. That conclusion is limited to this flow and says nothing about JobTayari's own role: whether JobTayari is a deployer of the first- or third-party AI systems it operates requires a separate assessment.

## Action items

1. **Do not ship employer-facing scoring/ranking/shortlisting** without a full Data Protection Impact Assessment and a qualified lawyer's review. This is the bright line above.
2. **Keep the candidate-side / deployer-side boundary explicit in the codebase.** It already is: no employer-facing routes exist in `backend/go/internal/api/`, and the AI engine has no candidate-scoring surface. Any new route that scores or ranks candidates must gate behind a feature flag AND a legal review — it is a P0 change, not a routine addition.
3. **Get a real lawyer to review this position** before any B2B pivot. This document is an engineering position, not legal advice; it does not substitute for counsel.
4. **Document AI-disclosure in the Terms of Service.** Add an explicit clause that application materials may be AI-assisted and that the candidate is responsible for disclosure to the recipient employer. The ToS clause is candidate notice about AI-assisted materials — it is **not** the mechanism of Article 50 compliance. Provider output marking under Art. 50(2) for generated content is the compliance mechanism, and it is not yet implemented (see Transparency duties above).
5. **Re-verify the date gate.** Deployer Article 50 transparency obligations began 2 August 2026 — already passed. Annex III high-risk Chapter III Sections 1–3 obligations begin 2 December 2027 (Reg. 2026/1744). Any future amendment, guidance note, or implementing-delegated-act from the AI Office must be re-checked before each B2B step.

## Sources

- Regulation (EU) 2024/1689 (the EU AI Act) — Annex III item 4(a) (recruitment / candidate screening as high-risk); Article 50 (transparency obligations); digital-strategy.ec.europa.eu.
- Regulation (EU) 2026/1744 — amends the application dates of the AI Act's high-risk obligations; defers Annex III Chapter III Sections 1–3 obligations to 2 December 2027.
- European Commission, AI Act guidance page on digital-strategy.ec.europa.eu — current guidance on the AI Act's application dates and high-risk obligations.
- DLA Piper, "Deployer obligations under the AI Act: implications for employers from 2 August 2026" — source for the deployer-obligations-effective-date and the candidate-vs-employer distinction.
- `docs/JOB_TAYARI_RUTHLESS_AUDIT_PLAN.md` §1.5 (Legal and platform risk) and §8 Sources — the audit's source material for this position.
- `JobTayari_Production_Readiness_and_Moat.md` §4 (positioning: candidate-side wedge, ATS-side trust layer as the possible business, and the note that any such pivot pulls the product into EU AI Act deployer territory).