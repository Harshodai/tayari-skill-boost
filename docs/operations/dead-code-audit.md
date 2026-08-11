# Dead-Code Audit (Workstream K / B7)

Date: 2026-08-11
Scope: DB dead tables, dead feature flags, internal codenames.
Auditor: workstream K run of the ruthlessness audit.

## 1. Dead DB tables — verdict table

Migration: `backend/db/migrations/20260811_02_drop_dead_tables.sql`
Mirror: `supabase-local/volumes/db/init/24-20260811_drop_dead_tables.sql` (identical content, diff-verified)
Mount: added `zz-24-20260811_drop_dead_tables.sql` individual-file mount in `supabase-local/docker-compose.yml` `db:` service (pattern matched from `23-20260811_audit_tables.sql`).

Verification method: case-insensitive grep of snake_case table names + camelCase/PascalCase derivatives across `backend/go`, `backend/python`, `src/`, `integrations/`, `extension/`, `supabase/`; word-boundary strict re-grep; SQL-statement pattern grep (`FROM|INTO|UPDATE|JOIN|DROP TABLE|ALTER TABLE|REFERENCES`); `REFERENCES` grep across all migrations and init scripts.

| Table | Verdict | Evidence |
|---|---|---|
| `application_attempts` | DROP | 0 app-code refs. Go application code reads/writes the live `applications` table (`routes_mvp.go` `SELECT ... FROM applications`, `INSERT INTO applications`). Only hits: `security/baseline.json` (scanner findings artifact) + audit docs. Created in `20260620_hermes_agents.sql`. |
| `interview_messages` | DROP | 0 app-code refs. Only hits: `security/baseline.json` + audit docs. Created in `20260625_voice_interview.sql`. |
| `learning_resources` | DROP | 0 app-code refs. Only hits: `security/baseline.json` + audit docs. Created in `20260625_career_intelligence.sql`. |
| `platform_configs` | DROP | 0 app-code refs. Only hits: `security/baseline.json` + audit docs. Created in `20260620_hermes_agents.sql`. |
| `tailored_resumes` | DROP | 0 refs to the table. `TailoredResumeText` hits in `autopilot.go` / `routes_mvp.go` / `routes_review_queue.go` are a struct field + JSON key for a **column on `applications`**, not the `tailored_resumes` table (word-boundary grep `TailoredResume\b` excludes `TailoredResumeText` = 0 hits). Created in `20260620_hermes_agents.sql`. |
| `user_sessions` | DROP | 0 app-code refs. Only hits: `security/baseline.json` + audit docs. Created in `20260620_hermes_agents.sql`. |
| `voice_note_files` | DROP | 0 app-code refs. Only hits: `security/baseline.json` + audit docs. Created in `20260625_archive_integration.sql`. |

No `REFERENCES` foreign keys point at any of the 7 tables in any migration or init script. All 7 DROP statements in the migration kept as-is (the prior grep claim held under independent re-verification).

## 2. Dead feature flags

Audit: `src/config/features.ts`. For every flag, grep `features.X` / `featureFlags.X` consumers (with import-alias resolution) + string-literal usages + route gating in `src/`.

Flags removed (zero consumers anywhere in `src/`, no route, no nav-link, no string usage, no test reference):

| Flag | Consumer count | Reason |
|---|---|---|
| `skillGapRadar` | 0 | no route, no nav link, no page gating |
| `recruiterOutreach` | 0 | page `RecruiterOutreach.tsx` exists but is routed un-gated; flag read by nothing |
| `funnelAnalytics` | 0 | no route, no nav link |
| `privacyReadiness` | 0 | `/privacy` route is un-gated; flag read by nothing |
| `adaptationsPortal` | 0 | no route, no nav link |

Flags with zero direct consumers but KEPT — removing them would change runtime behavior:

| Flag | Why kept |
|---|---|
| `typstStudio` | referenced by `CONFIG.links` nav entry (`/typst-studio`); `getNavLinks()` disables unknown features — removing hides the nav item |
| `candidateAnswerBank` | referenced by `CONFIG.links` nav entry (`/answer-bank`) |
| `agentReach` | referenced by `CONFIG.links` nav entry (`/agent-reach`) |

All other 21 flags have ≥1 live `features.X` consumer (App.tsx routes, Header/Footer/AppSidebar nav, landing sections, pages).

## 3. Internal codenames

Grep: `Hermes`, `Jina`, `Kronos`, `Tayari` in `src/` and `extension/` (case-insensitive).

| Codename | Hits | Verdict |
|---|---|---|
| `Hermes` | 3, all `src/pages/Settings.tsx` (`handleOpenHermes` function name, `hermes://mcp/register` deep-link protocol, button labeled "Open in Desktop Agent") | No fix. No user-visible "Hermes" copy — button text is already plain language. `hermes://` is a protocol registry contract with the Desktop Agent; renaming breaks registration. |
| `Jina` | 3, `src/pages/AgentReachHub.tsx` ("Jina Reader", "Jina Reader (r.jina.ai)", "linkedin-scraper-mcp ▸ Jina") | No fix. Names the real external provider (Jina AI / r.jina.ai) the integration uses — factual backend description, not an internal codename. |
| `Kronos` | 0 | — |
| `Tayari` | many, `src/` + `extension/` | No fix. Brand usage only: "Job Tayari" product name, "Tayari means ready in Swahili" brand story, "Tayari Computer" feature branding, storage keys, extension message channels. |

Zero code changes resulted from the codename audit.

## 4. Files touched

- `backend/db/migrations/20260811_02_drop_dead_tables.sql` — pre-existing, verified, unchanged
- `supabase-local/volumes/db/init/24-20260811_drop_dead_tables.sql` — NEW mirror (identical content)
- `supabase-local/docker-compose.yml` — NEW `zz-24` mount for the mirror
- `src/config/features.ts` — removed 5 dead flags

## 5. Gates run

- `go test ./internal/api -run 'TestSmoke|TestRouteParity' -count=1` — PASS (exit 0):

```
ok  	tayari-backend/internal/api	0.780s
```

- `bunx tsc --noEmit -p tsconfig.app.json` — PASS (exit 0, no output).

- No Python files touched; `py_compile` not required.

Note: full `go test ./...` also run as a check (2026-08-11): PASS (exit 0) — the nil-DB panic subset previously documented as red is fixed; the green subset above remains the gate for this audit.

Volatile facts above verified 2026-08-11 (gates re-run on this date).
