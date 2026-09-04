# OmniSaveAI TODO

This checklist captures the remaining work after the LinkedMash-inspired OmniSaveAI product-loop implementation. Complete the items in order where possible.

Design specification: [OMNISAVE_UI_SPEC.md](./OMNISAVE_UI_SPEC.md). The specification is complete; database and real-browser validation items below remain environment-dependent.

## P0 — Apply and validate the database migrations

- [ ] Apply `backend/db/migrations/20260815_01_omnisave_nlp_metadata.sql` to the target PostgreSQL/Supabase database.
- [ ] Apply `backend/db/migrations/20260815_02_omnisave_evidence_context.sql`.
- [ ] Apply `backend/db/migrations/20260815_03_omnisave_instagram_platform.sql`.
- [ ] Apply `backend/db/migrations/20260815_04_omnisave_auto_sync.sql`.
- [ ] Apply `backend/db/migrations/20260815_05_omnisave_seed_import.sql`.
- [ ] Apply `backend/db/migrations/20260815_06_omnisave_capture_provenance.sql`.
- [ ] Confirm that RLS policies prevent one candidate from reading another candidate’s sources, highlights, context links, sync runs, seed jobs, and provenance records.
- [ ] Run a disposable-database smoke test covering source insert, duplicate import, evidence creation, context linking, seed hydration, export, and source deletion.

## P0 — Verify the automatic capture flow in a real browser

- [ ] Reload the browser extension after installing the latest `extension/manifest.json` and `extension/background.js`.
- [ ] Confirm automatic capture is disabled by default for a new user.
- [ ] Open an authenticated LinkedIn saved-posts page and verify that only visible saved cards are collected.
- [ ] Verify that Medium reading-list, Substack home-feed, and Instagram saved-activity pages are the only additional supported capture scopes.
- [ ] Confirm arbitrary publication pages and unrelated tabs are ignored.
- [ ] Run “Sync open saved pages” and verify the sync-run receipt in the OmniSaveAI workspace.
- [ ] Enable automatic capture for one platform and verify the configured alarm interval, pause control, retry behavior, and duplicate suppression.
- [ ] Test a blocked or unreadable URL and confirm it becomes a visible failed/blocked item instead of silently disappearing.

## P0 — Complete full-history seed import validation

- [ ] Obtain a representative LinkedIn saved-items CSV with URL, title, author, and saved-date columns.
- [ ] Upload it through the new “Bring in your existing LinkedIn library” card.
- [ ] Verify that duplicate URLs are removed before creating the job.
- [ ] Verify bounded hydration batches, progress percentages, imported/skipped/failed counts, and “Hydrate next batch.”
- [ ] Retry a failed item and confirm that a successful retry does not create a duplicate `saved_sources` row.
- [ ] Confirm that source provenance records `seed_csv` as the capture origin.

## P1 — Finish the career-intelligence loop

- [x] Add role/company/skill suggestions from the candidate’s existing applications so users do not need to type every context label manually.
- [ ] Add interview-board-specific suggestions as a follow-up.
- [ ] Link evidence cards directly to an application, interview session, flashcard deck, or practice session instead of only storing free-form context labels.
- [ ] Add a “Prepare this application” entry point from the interview board that opens `/omnisave` with the role/company filters prefilled.
- [ ] Add a “Practice these questions” action to the Interview Brief that sends selected evidence-derived questions to the AI mock interview or Clash of Code workflow.
- [ ] Add an explicit “evidence gap” model so the Interview Brief can distinguish missing source coverage from missing candidate examples.
- [x] Add freshness scoring based on `last_seen_at`, `sync_status`, and source age.

## P1 — Improve portability and connections

- [ ] Add export tests for JSON, Markdown, and CSV, including sources with zero highlights and zero context links.
- [ ] Add optional Markdown front matter containing role, company, skill, capture origin, and last-seen timestamps.
- [ ] Add an import path for OmniSaveAI’s own JSON/Markdown/CSV exports with schema validation and preview-before-write.
- [ ] Add user-visible export history and downloadable run receipts.
- [ ] Define any external integrations as explicit read-only connectors first; do not add write, posting, application submission, or scheduling actions without a separate confirmation flow.

## P1 — Harden the read-only agent surface

- [ ] Document `/api/v1/agent/omnisave/library` and `/api/v1/agent/omnisave/brief` in the API reference.
- [ ] Add contract tests proving the agent routes require authentication and never return another user’s records.
- [ ] Add pagination and a maximum response-size guard for agent library search.
- [ ] Add rate limiting and request logging with query redaction.
- [ ] If exposing the routes to an external connector, issue scoped read-only credentials and keep all mutation routes excluded.

## P2 — Product polish and observability

- [x] Add a first-run onboarding state explaining what automatic capture reads, what it never reads, and how to pause it.
- [x] Add platform-level health indicators: last successful capture, last failure, pending items, and last error.
- [x] Add an owner-scoped activity timeline for captures, evidence-card edits, context links, and sync runs; durable export/deletion events remain a follow-up schema task.
- [ ] Add empty, loading, offline, and migration-required states to the seed importer and Interview Brief card.
- [ ] Repeat the browser visual review at `http://127.0.0.1:8081/omnisave` after the frontend server and extension are running.
- [ ] Re-run the verification suite after every migration or route change:
  - `pnpm test --run`
  - `pnpm build`
  - `pnpm exec tsc --noEmit`
  - touched-file ESLint
  - focused Python tests
  - `go test ./internal/api`
  - extension `node --check` and manifest validation
  - `git diff --check`

## Current known caveats

- The code-level implementation and verification suite pass, but the new migrations have not been applied to the target PostgreSQL/Supabase environment.
- Final visual browser verification remains pending because the connected browser session currently reports no receiving end; reload/reconnect the extension and browser before checking the workspace.
- The backend test run still emits unrelated existing deprecation warnings from PyPDF2, Pydantic V1-style configuration/validators, and FastAPI’s deprecated `regex` argument.
- Automatic capture remains intentionally consented and scoped to visible content on explicitly supported pages. It does not enumerate private third-party saved lists server-side.
