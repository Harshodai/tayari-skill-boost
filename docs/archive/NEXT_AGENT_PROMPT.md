# Next-agent kickoff prompt

Copy everything below the line into a fresh Claude Code session in this repo to continue the work. It's written to stand alone — the new session has no memory of the prior ones.

---

You're continuing work on Tayari Skill Boost (an AI job-prep platform — Go gateway, Python AI engine, React frontend, self-hosted Supabase, browser extension). Two prior sessions (2026-08-24 and 2026-08-25) did long, thorough passes: fixed "fabrication and silent failure" bugs across the whole stack, closed Section 15 of the productionization program, then closed the remaining public-beta S0 release gates with real live evidence (endpoint inventory, hostile-staging suite, backup/restore drill, rollback/promotion drill) and found+fixed three more real bugs along the way, including one that meant the release image literally could not build. The release-gate decision is now **`PUBLIC BETA GO` (technical readiness) — see `TAYARI_RELEASE_GATE.md`**, up from `INTERNAL DEMO ONLY`. Read these files **in full** before doing anything else:

1. **`HANDOFF_2026-08-24.md`** (repo root) — §1-8 cover 2026-08-24 (fabrication sweep, E2E suite fixes, two environmental traps to avoid repeating); **§9 covers 2026-08-25 and is the most recent state** — read it first if you're short on time.
2. **`TAYARI_RELEASE_GATE.md`** (repo root) — the current, authoritative release decision and evidence table. Don't trust any older summary of "what's blocking" over this file.
3. **`lessons.md`** (repo root, dated entries from 2026-08-24 and 2026-08-25) — the detailed command-level evidence and reasoning behind every fix. Don't re-derive something that's already here.

`RUTHLESS_USER_SERVING_PRODUCTIONIZATION_PROGRAM_2026-08-24.md` and `TAYARI_REMEDIATION_TODOS.md`'s Section 15 are now **fully closed** (commit `88c5c85`) — do not re-open or redo that work. Verify with `git show --stat 88c5c85` and the corresponding `lessons.md` entries before assuming otherwise.

## Current baseline (verify yourself, don't trust this blindly)

```bash
(cd backend/go && go build ./... && go vet ./... && go test ./...)   # expect: 280 passed
(cd backend/python && JWT_SECRET="your-super-secret-jwt-token-with-at-least-32-characters-long" \
  AI_INTERNAL_TOKEN="<REDACTED_AI_INTERNAL_TOKEN>" \
  .venv/bin/python -m pytest app/ tests/ -q)                        # expect: 951 passed, 4 skipped
```

`git log --oneline -1` should show `44fc3cf` or later, already on `origin/main`.

## What's actually left (in priority order)

1. **Provision real production infrastructure.** This is the real next step and it needs the operator (human), not more code archaeology — an AWS account, a real domain, a real image registry, TLS. A draft `deploy/aws/.env` exists locally (gitignored, mode 600, **not in git** — check with the operator before assuming it's still there) with 4 real generated secrets and explicit `FILL-ME-IN` markers for everything that needs a real decision. Once those are filled, run `scripts/build-images.sh` against a real registry, then `deploy/aws/provision.sh` + `deploy/aws/deploy.sh`. Do not provision real cloud infra or spend real money unilaterally — confirm with the user at each hard-to-reverse step.
2. **Kill-switch live timing.** `AutonomousBrowser` capability stays correctly disabled by default; M2-07's unit/contract proof already satisfies the S0 gate, so this is optional polish, not a blocker. Only pursue it if explicitly asked, and don't force the safety flag on without discussing it first.
3. **Apple signing/notarization** — only relevant if macOS desktop distribution is wanted. Needs the operator's own Apple Developer credentials; you cannot and should not handle credentials directly. Separately scoped from the web beta per `TAYARI_RELEASE_GATE.md`'s own risk table.
4. **M7/M8/M9** (`TAYARI_REMEDIATION_TODOS.md`) — competitive positioning, paid-pilot profitability, feature-maturity roadmap. Real business/product execution over weeks — not something to fabricate progress on in one session. If asked to work on these, scope honestly: most items need real users, real time-series data, or real business decisions, not code.

## Rules that applied to prior sessions and should apply to you

- **Never commit or push unless the user explicitly asks.** Leave work staged/uncommitted for review by default.
- **Rebuild Docker images after touching Go/frontend source before trusting a live test against them** — `docker compose build <service> && docker compose up -d <service>`. Containers don't hot-reload compiled/built code.
- **Run the E2E suite the way §4 of `HANDOFF_2026-08-24.md` describes**, not bare `npx playwright test` — the default config points at fake stub URLs.
- **Use the project's `.venv/bin/python`, not system `python3`**, for any script involving `app.*` imports — a stale system Python literally caused a false "0 routes discovered" result in this repo before (see `lessons.md`, 2026-08-25).
- **Check `lsof -i :<port>`** before concluding a flaky test result means a real bug.
- **A missing test is a gap you say out loud**, not a thing you silently skip.
- **Never fabricate a "PASS" claim.** Every result in `lessons.md` and `TAYARI_RELEASE_GATE.md` has real command output behind it — including cases where the first restore/build attempt genuinely failed and had to be redone properly (see `lessons.md`'s backup-restore and rollback entries). If something can't be verified live, say so explicitly rather than asserting it.
- **Real infrastructure/credential/money decisions are the operator's call, not yours** — this applies to cloud provisioning, image registry pushes to a real (non-local) registry, Apple signing, and cutting an immutable release tag alike.

Work the same way the prior sessions did: read the actual code, verify a finding is real before fixing it, fix minimally, test, verify live where practical, log it in `lessons.md` with root cause + reusable lesson. Be ruthless about finding the *real* bug, not the first plausible one — several fixes across both prior sessions turned out to have a second, deeper layer once the first fix removed a mask that was hiding it.
