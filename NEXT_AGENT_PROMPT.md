# Next-agent kickoff prompt

Copy everything below the line into a fresh Claude Code session in this repo to continue the productionization work. It's written to stand alone — the new session has no memory of the prior one.

---

You're continuing work on Tayari Skill Boost (an AI job-prep platform — Go gateway, Python AI engine, React frontend, self-hosted Supabase, browser extension). A prior session did a long, thorough pass fixing "fabrication and silent failure" bugs across the whole stack and closed out Phase 0 of a productionization program. Read these two files **in full** before doing anything else:

1. **`HANDOFF_2026-08-24.md`** (repo root) — what was done, current verified state, exact commands to run the E2E suite correctly, and two environmental traps to avoid repeating.
2. **`lessons.md`** (repo root, the last ~10 dated entries from 2026-08-24) — the detailed evidence and reasoning behind every fix, one entry per batch.

Then read **`RUTHLESS_USER_SERVING_PRODUCTIONIZATION_PROGRAM_2026-08-24.md`** (repo root) in full — it's the operating document. Section 15 ("Specialist-Guided Omission Pass") is where you pick up; Phase 0 is done.

## Your task

Work through Section 15's findings, most severe first, the same way the prior session worked: read the cited code yourself and confirm the finding is real before fixing it (don't trust the document blindly — verify), fix it minimally and correctly, add or update a test, verify the fix live where practical (not just unit tests — this repo has a real local Docker stack, use it), and log every fix as a new dated entry in `lessons.md` with root cause + reusable lesson, matching the existing entries' format and honesty standard (no fabricated "PASS" claims — every claim needs real command output behind it).

Start with the P0s:

- **DATA-006** — `backend/go/internal/api/routes_account.go`: account deletion can return `200 {"status":"deleted"}` even when the GoTrue deletion and its SQL fallback both fail. Fix so failure is never reported as success.
- **REL-002** — the staging evidence verifier (`scripts/verify_staging_evidence_bundle.py` and related) accepts synthetic/placeholder attestations as real deployment proof. Make it reject fake domains, zero-hashes, and non-production environment labels for anything claiming to be final-staging/production evidence.
- **CAP-001** — `backend/go/internal/capabilities/capabilities.go`: the always-on `workspace.task_control` capability's safety invariant ("can't reach submission when other capabilities are off") is currently a comment, not a test. Build the executable proof the document asks for.

Then the P1s (DATA-007, DATA-008, OPS-007, OPS-008, AUTO-001) and P2 (REL-003) — full detail on each is in the document's §15.2 through §15.9.

## Rules that applied to the prior session and should apply to you

- **Never commit unless the user explicitly asks.** Never push, ever, without being asked. Leave your work staged/uncommitted for review by default.
- **Rebuild Docker images after touching Go/frontend source before trusting a live test against them** — `docker compose build go-backend frontend && docker compose up -d go-backend frontend`. The containers don't hot-reload compiled/built code.
- **Run the E2E suite the way §4 of `HANDOFF_2026-08-24.md` describes**, not bare `npx playwright test` — the default config points at fake stub URLs that only work for one narrow CI job.
- **Check `lsof -i :<port>`** before concluding a flaky test result means a real bug — this repo's dev ports (8080, 8083, 8085, 8002) are easy to double-bind across a long session.
- **A missing test is a gap you say out loud**, not a thing you silently skip. If writing a proper test is disproportionate to the fix (e.g. needs a DB-mocking harness that doesn't exist yet), say so explicitly and note it as a follow-up rather than skipping silently or inventing a fake-passing test.
- **REL-001 (cutting an immutable release tag) is the user's call, not yours** — don't tag or push a release candidate unilaterally even if all gates look green.

Work through it the same way: read the actual code, verify the finding, fix minimally, test, verify live, log it. Be ruthless about finding the *real* bug, not the first plausible one — several fixes in the prior session turned out to have a second, deeper layer once the first fix removed a mask hiding it.
