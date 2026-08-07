# V6 Design — Converge branding on "AutoPilot" (sub-project 1 of the commercial-viability program)

Date: 2026-08-07
Status: APPROVED-in-principle (user decision: "let it be AutoPilot as present")
Source: `docs/superpowers/specs/2026-08-07-five-doc-reconciliation-audit.md` V6 + Manus commercial-viability doc §6.1

## Problem
The audit found three product names in the UI: "AutoPilot" (page, most copy),
"Apply Assist" (sidebar, header, nav, landing, pet content), "Auto-Apply"
(action phrases). Three names is worse than one.

## Decision
**AutoPilot is the product name.** All user-visible "Apply Assist" instances
become "AutoPilot". The "Auto-Apply" action phrases are action verbs, not the
product name, and stay as-is. URLs (`/jobs/autopilot`) and backend/internal
identifiers are unchanged.

## Scope
- 16 files, 35 instances in `src/` (features.ts nav label, AppSidebar, Header,
  Landing/SocialProof/FeaturesSection cards, AppShell, pet content ×4,
  WelcomeTour, applyChain.ts comment, Dashboard, JobSearch, AutoPilot.tsx).
- Mechanical `Apply Assist` → `AutoPilot` replacement; sentences read
  naturally ("Launch AutoPilot", "What is AutoPilot?", "AutoPilot — title").
- No file renames, no route changes, no backend changes.

## Guard
Static readFileSync test (B1 pattern): zero "Apply Assist" in `src/`
(excluding test files), and "AutoPilot" still present.

## Acceptance
- `grep -rn "Apply Assist" src` → only test-assertion hits.
- `bun run build` green; `bun run test` at baseline (150 pass / 14 cognee);
  lint unchanged (51/1448).

## Follow-on sub-projects (own specs)
V3 verified-human badge → Moat-1 referral engine → Moat-2 interview copilot
(unfrozen) → V7 glass box UI.
