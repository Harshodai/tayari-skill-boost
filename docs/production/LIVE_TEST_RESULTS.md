# LIVE TEST RESULTS — 2026-09-07

Harness: Playwright Chromium headless, viewport 1280x1800, target `http://localhost:8080` (same bundle as the hosted preview). Scripts: `/tmp/browser/audit/routes.py`, `/tmp/browser/audit/verify.py`.

| Route | Result | Landing URL | H1 | Load (s) | Notes |
|---|---|---|---|---|---|
| `/` | PASS | `/` | Job search, deliberate. | ~4.0 | No HTTP errors |
| `/pricing` | PASS | `/pricing` | Pay for a visible record… | ~4.0 | |
| `/checkout` | PASS | `/checkout` | Buy submission credits | 3.6 | |
| `/privacy`, `/terms` | PASS | same | correct H1 | ~4.2 | SEO titles present |
| `/auth` | PASS | `/auth` | — | 3.8 | Email form + "OR CONTINUE WITH" Google button rendered |
| `/dashboard`, `/credits`, `/pipeline`, `/cover-letter` | PASS | `/auth` | — | ~4.0 | Correctly gated when signed out |
| `/jobs` | PASS (degraded) | `/jobs` | Smart Job Search | 4.2 | `500` on `/api/v1/health`, `/api/v1/agent/runs/active`, `/api/jobs/saved` — Go gateway absent in hosted env; UI renders without fabricating results |
| `/resume-optimizer` | FAIL → FIXED | now `/resume` | Resume Optimizer | — | Was a 404 page |
| `/career-roadmap` | FAIL → FIXED | now `/roadmap` | Career Intelligence Roadmap | — | Was a 404 page |
| `/interview-prep` | FAIL → FIXED | now `/interview/prep` (→ `/auth` when signed out) | — | — | Was a 404 page |
| `/job-search-autopilot` | FAIL → FIXED | now `/jobs/autopilot` (→ `/auth`) | — | — | Was a 404 page |
| `/nope-404` | PASS | `/nope-404` | 404 | — | Catch-all works |

## Console noise (open, non-blocking)

Every page logs repeated React warnings: *"Function components cannot be given refs"* originating at `ThemeProvider`, `TenantProvider`, `App`. Not a functional failure, but it is real console pollution that hides genuine errors. Tracked in `NEXT_STEPS.md` (P2).

## Not tested live

Authenticated end-to-end journeys (resume upload → analysis → persistence, job save → pipeline stage change, cover-letter generation, agent run lifecycle, credit debit on receipt) were **not executed** in this cycle. Status: UNKNOWN.
