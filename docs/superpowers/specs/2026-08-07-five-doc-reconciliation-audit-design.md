# Five-Document Reconciliation Audit — Design

**Date:** 2026-08-07
**Status:** Approved (brainstorm 2026-08-07)
**Scope:** Verify every concrete claim across five strategy/audit documents against today's codebase, then produce a ranked still-real backlog. **No code changes in this cycle.**

## Source documents (by recency)

1. `JobTayari_Production_Readiness_and_Moat.md` (2026-07-29, in repo root) — the most grounded; B1–B7 launch blockers, M1–M4 moats.
2. `Job Tayari_ The No-Mercy 10_10 Master Plan for Unrivaled Market Dominance.md` (2026-07-05) — `browser_library.py` placeholder, `predictive_scorer.py` heuristic, `gate.py` truthfulness bypass, `llm_service.py` truncation, `strategic_analyzer.py` fallback.
3. `Job Tayari_ The 10_10 _Manus-like_ Master Plan for Autonomous Dominance.md` (2026-07-05) — `AgentOrchestrator`/`core.py`, `JobApplyAgent`/`browser_agent.py`, `AgentLiveView`, autopilot trigger wiring.
4. `Job Tayari_ The _Beyond 10_10_ Ruthless Audit – Identifying the Untouchable Moats.md` (2026-07-05) — networking/referrals/community, real-time interview copilot, predictive pathing, ethical AI. Mostly aspirational.
5. `Job Theory Platform_ Production-Ready Plan.md` (undated) — Resume Optimizer, Hermes sandbox, Interview Kanban + Gmail integration, Omni Save AI.

## Goal

A single reconciled report that, for every concrete claim across all five docs, states whether it still holds today — so the next implementation cycle builds on **verified premises**, not stale ones. Several July-5 claims are already known stale (browser_library is now a real browser-use wrapper; mock-LLM now raises `LLMNotConfiguredError`; feature flags slimmed from 27 → ~2). The report must surface these rather than re-litigate them.

## Verdict vocabulary

| Verdict | Meaning |
|---|---|
| **VERIFIED-STILL-TRUE** | Claim holds against today's code. Cite `file:line`. |
| **FIXED** | Claim was true when written; code has since addressed it. Cite the fixing file/commit. |
| **STALE** | Claim no longer applies (code moved/removed/renamed). Cite what's there now. |
| **ASPIRATIONAL** | Forward-looking recommendation, not a codebase claim. Cite the doc section. Not "verified." |
| **UNVERIFIABLE** | No locatable code and no doc-internal evidence. Do NOT silently mark STALE. |

## Evidence standard

- Every VERIFIED / FIXED / STALE row cites `file:line` (or commit) so a reviewer can re-check in seconds.
- ASPIRATIONAL rows cite the doc + section.
- Conflicts between docs (same claim, different verdicts) collapse to one row with all sources cited and a single synthesized verdict + a conflict note.

## Method — subagent fan-out (read-only)

Dispatch **parallel subagents**, one per source document. Each subagent only reads/searches the codebase — no edits, no test runs that mutate state. Each returns a list of rows:

```
{doc, source_location, claim, verdict, evidence_file:line, severity, notes}
```

- **Subagent 1** — July-29 readiness doc. Verify B1–B7 (split-brain backend, decorative multi-tenancy, no account deletion, no backups, silent mock fallback, scraping legal exposure, feature sprawl/dead tables) and M1–M4 (MCP distribution, outcome-data loop, provenance ledger, B2B2C tenant) against current code.
- **Subagent 2** — July-5 "No-Mercy" doc. Verify `browser_library.py` (placeholder?), `predictive_scorer.py` (heuristic vs ML?), `gate.py` (truthfulness skip when `original_text` absent), `llm_service.py` (hardcoded truncation, prompt-injection delim), `strategic_analyzer.py` (canned fallback), `ats_engine.py` (heuristic strength).
- **Subagent 3** — July-5 "Manus-like" doc. Verify `AgentOrchestrator`/`app/agents/core.py`, `JobApplyAgent`/`browser_agent.py`, `AgentLiveView` component, and the autopilot `/auto-pilot/start` trigger wiring against current code.
- **Subagent 4** — July-5 "Beyond 10/10" doc. Tag networking/referrals/community, real-time interview copilot, predictive pathing, ethical-AI items as ASPIRATIONAL (cite doc sections); flag any that have partial code stubs.
- **Subagent 5** — "Job Theory Production-Ready Plan". Verify Resume Optimizer (`ResumeUpload.tsx`/`normalizeGoAnalysis`/`analyze-resume` edge fn), Hermes sandbox integration, Interview Kanban (`InterviewBoard.tsx`) + Gmail integration, Omni Save AI.

I synthesize the five lists into one deduped table (claims appearing in multiple docs collapse to one row with all sources cited), resolve conflicts, and produce the ranked backlog.

## Report structure (the deliverable)

```
# Five-Document Reconciliation Audit (2026-08-07)
## Method (subagent fan-out, evidence standard)
## Summary (counts by verdict + by severity)
## Full claim table (one row per unique claim, all source docs cited)
## Ranked still-real backlog (Critical → Low)
## Recommended next spec (#1 item)
## Appendix: per-doc claim trace
```

Output path: `docs/superpowers/specs/2026-08-07-five-doc-reconciliation-audit.md` (the report itself, separate from this design doc).

## Ranked-backlog severity rubric

- **Critical** — legal exposure (GDPR Art. 17, scraping) or blocks charging money (B1 split-brain, B3 no delete, B4 no backups).
- **High** — trust/security (B5 truthfulness skip, mock-fallback paths) or blocks a revenue tier (B2 multi-tenancy).
- **Medium** — moat-enabling (M1–M4) or focus/cleanup (B7 dead surface).
- **Low** — aspirational / nice-to-have (networking, interview copilot, predictive ML).

## Ponytail guardrails

- No code changes during verification.
- Subagents read/search only.
- If a claim is ambiguous, mark UNVERIFIABLE and move on — do not over-investigate.
- Cite `file:line` for every verdict; a reviewer re-checks in seconds.
- No new dependencies, no fallbacks, no unrequested "improvements."

## Out of scope (this cycle)

- Implementing any fix. The #1 still-real blocker gets its **own** spec in the next brainstorm cycle, fed by this report's ranked backlog.
- Re-running the full eval suite. Verification is static (read/search).

## Next step after this report

Brainstorm + spec the #1 still-real Critical/High item from the ranked backlog, ponytail-style. The report's "Recommended next spec" section names it.