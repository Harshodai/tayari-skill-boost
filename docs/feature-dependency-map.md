# Feature / Dependency Map

Generated 2026-09-10 against baseline commit `55d8ea6`. Read-only mapping task (one live bug fixed in-place, see note at bottom).

Scope: every `apiFetch`/`apiFetchResponse` call in `src/api/*.ts` (non-test), cross-referenced against Go route registrations in `backend/go/internal/api/routes_*.go` + `router.go` + `middleware_rate_limit.go`, and against Python routes in `backend/python/app/**`. Paths are normalized (`${...}` / `{...}` -> `{}`) before comparison. Go route-parity convention (both `/api/...` and `/api/v1/...`) is assumed and spot-checked, not exhaustively re-verified per row.

**Status legend**: OK = frontend path matches a registered Go route. MISSING_GO = no matching Go route found (404 risk). Where noted, MISSING_GO entries are dead/unused code (never imported by any page/component) rather than live bugs — checked individually, not assumed.


## resume

| Frontend call | Path | Go match | Status | Note |
|---|---|---|---|---|
| `src/api/client.ts:93` | `/v1/privacy/ledger` | `/api/v1/privacy/ledger` | OK |  |
| `src/api/resumes.ts:20` | `/v1/resumes` | `/api/v1/resumes` | OK |  |
| `src/api/resumes.ts:27` | `/v1/resumes` | `/api/v1/resumes` | OK |  |
| `src/api/resumes.ts:31` | `/v1/resumes/${id}` | `/api/v1/resumes/{id}` | OK |  |
| `src/api/resumes.ts:38` | `/v1/resumes/${id}` | `/api/v1/resumes/{id}` | OK |  |
| `src/api/resumes.ts:45` | `/v1/resumes/${id}` | `/api/v1/resumes/{id}` | OK |  |
| `src/api/resumes.ts:55` | `/v1/resumes/upload` | `/api/v1/resumes/upload` | OK |  |
| `src/api/resumes.ts:64` | `/v1/analyze` | `/api/v1/analyze` | OK |  |
| `src/api/resumes.ts:80` | `/v1/job-descriptions/import` | `/api/v1/job-descriptions/import` | OK |  |
| `src/api/resumes.ts:87` | `/v1/analyze/history` | `/api/v1/analyze/history` | OK |  |
| `src/api/resumes.ts:91` | `/v1/analyze/${id}` | `-` | MISSING_GO — dead code | No Go route for `/v1/analyze/{id}`. `getAnalysis` export has zero callers anywhere in src/. |
| `src/api/resumes.ts:106` | `/v1/resumes/${id}/optimize` | `/api/v1/resumes/{id}/optimize` | OK |  |
| `src/api/resumes.ts:128` | `/v1/resumes/${id}/ats-deep` | `/api/v1/resumes/{id}/ats-deep` | OK |  |
| `src/api/resumes.ts:187` | `/v1/resumes/generate-pdf` | `/api/v1/resumes/generate-pdf` | OK |  |
| `src/api/resumes.ts:194` | `/v1/resumes/${id}/export` | `/api/v1/resumes/{id}/export` | OK |  |
| `src/api/resumes.ts:203` | `/v1/ats/simulate` | `-` | MISSING_GO — dead code | No Go route for `/v1/ats/simulate`. `simulateAtsParsing` export is never imported outside its own module/tests; the live ATS simulator UI (AtsParserSimulator.tsx) uses the pure client-side `src/lib/ats-simulator/parser.ts` version instead. |
| `src/api/resumes.ts:210` | `/v1/guardrails/truth-check` | `/api/v1/guardrails/truth-check` | OK |  |
| `src/api/resumes.ts:238` | `/v1/resumes/${resumeId}/variants` | `/api/v1/resumes/{id}/variants` | OK |  |
| `src/api/resumes.ts:245` | `/v1/resumes/${resumeId}/variants` | `/api/v1/resumes/{id}/variants` | OK |  |
| `src/api/resumes.ts:261` | `/v1/analytics/bandit-stats` | `/api/v1/analytics/bandit-stats` | OK |  |

## jobs & job search

| Frontend call | Path | Go match | Status | Note |
|---|---|---|---|---|
| `src/api/jobs.ts:6` | `/v1/job-descriptions` | `/api/v1/job-descriptions` | OK |  |
| `src/api/jobs.ts:13` | `/v1/job-descriptions` | `/api/v1/job-descriptions` | OK |  |
| `src/api/jobs.ts:17` | `/v1/job-descriptions/${id}` | `/api/v1/job-descriptions/{id}` | OK |  |
| `src/api/jobs.ts:24` | `/v1/job-descriptions/${id}` | `/api/v1/job-descriptions/{id}` | OK |  |
| `src/api/jobs.ts:31` | `/v1/job-descriptions/${id}` | `/api/v1/job-descriptions/{id}` | OK |  |
| `src/api/jobs.ts:124` | `/jobs/search` | `/api/jobs/search` | OK |  |
| `src/api/jobs.ts:131` | `/jobs/agent-search` | `/api/jobs/agent-search` | OK |  |
| `src/api/jobs.ts:138` | `/jobs/save` | `/api/jobs/save` | OK |  |
| `src/api/jobs.ts:146` | `/jobs/saved${query}` | `-` | OK |  |
| `src/api/jobs.ts:150` | `/jobs/saved/${id}` | `/api/jobs/saved/{id}` | OK |  |
| `src/api/jobs.ts:183` | `/v1/preferences/feedback` | `/api/v1/preferences/feedback` | OK |  |
| `src/api/jobs.ts:191` | `/v1/preferences/feedback${query}` | `-` | OK |  |
| `src/api/jobs.ts:255` | `/v1/ats/detect` | `/api/v1/ats/detect` | OK |  |
| `src/api/jobs.ts:268` | `/v1/recruiter/lookup` | `/api/v1/recruiter/lookup` | OK |  |

## applications / autopilot

| Frontend call | Path | Go match | Status | Note |
|---|---|---|---|---|
| `src/api/autopilot.ts:5` | `/autopilot/start` | `/api/autopilot/start` | OK |  |
| `src/api/autopilot.ts:12` | `/autopilot/runs` | `/api/autopilot/runs` | OK |  |
| `src/api/autopilot.ts:16` | `/autopilot/runs/${id}` | `/api/autopilot/runs/{id}` | OK |  |
| `src/api/autopilot.ts:20` | `/applications` | `/api/applications` | OK |  |
| `src/api/autopilot.ts:28` | `/applications${query}` | `-` | MISSING_GO |  |
| `src/api/autopilot.ts:32` | `/applications/${id}` | `/api/applications/{id}` | OK |  |
| `src/api/autopilot.ts:36` | `/applications/${id}/stage` | `/api/applications/{id}/stage` | OK |  |
| `src/api/autopilot.ts:43` | `/applications/${id}` | `/api/applications/{id}` | OK |  |
| `src/api/autopilot.ts:49` | `/applications/${id}/resume-docx` | `-` | MISSING_GO — CRITICAL, unfixed | No Go route for `/applications/{id}/resume-docx` anywhere; live caller AutoPilot.tsx:546. Needs a real route/handler decision, not a path rename. |
| `src/api/autopilot.ts:55` | `/autopilot/schedules` | `/api/autopilot/schedules` | OK |  |
| `src/api/autopilot.ts:62` | `/autopilot/schedules` | `/api/autopilot/schedules` | OK |  |
| `src/api/autopilot.ts:66` | `/autopilot/schedules/${id}` | `/api/autopilot/schedules/{id}` | OK |  |
| `src/api/autopilot.ts:73` | `/autopilot/schedules/${id}` | `/api/autopilot/schedules/{id}` | OK |  |
| `src/api/autopilot.ts:79` | `/applications/${id}/notes` | `/api/applications/{id}/notes` | OK |  |
| `src/api/autopilot.ts:86` | `/applications/${id}/notes/${noteId}` | `/api/applications/{id}/notes/{nid}` | OK |  |
| `src/api/autopilot.ts:92` | `/applications/${id}/interview-questions` | `/api/applications/{id}/interview-questions` | OK |  |
| `src/api/autopilot.ts:98` | `/applications/parse-email` | `/api/applications/parse-email` | OK |  |
| `src/api/autopilot.ts:107` | `/applications/${id}/voice` | `/api/applications/{id}/voice` | OK |  |
| `src/api/autopilot.ts:188` | `/v1/one-shot/execute` | `/api/v1/one-shot/execute` | OK |  |
| `src/api/autopilot.ts:216` | `/v1/approvals` | `/api/v1/approvals` | OK |  |
| `src/api/autopilot.ts:223` | `/v1/approvals/${approvalId}` | `/api/v1/approvals/{approval_id}` | OK |  |

## cover letters

| Frontend call | Path | Go match | Status | Note |
|---|---|---|---|---|
| `src/api/coverLetters.ts:24` | `/v1/cover-letters` | `/api/v1/cover-letters` | OK |  |
| `src/api/coverLetters.ts:28` | `/v1/cover-letters/${id}` | `/api/v1/cover-letters/{id}` | OK |  |
| `src/api/coverLetters.ts:32` | `/v1/cover-letters` | `/api/v1/cover-letters` | OK |  |
| `src/api/coverLetters.ts:39` | `/v1/cover-letters/${id}` | `/api/v1/cover-letters/{id}` | OK |  |

## interview / communication / ai

| Frontend call | Path | Go match | Status | Note |
|---|---|---|---|---|
| `src/api/agent.ts:33` | `/v1/ai/agent/runtime` | `/api/v1/ai/agent/runtime` | OK |  |
| `src/api/ai.ts:33` | `/v1/cover-letter/generate` | `/api/v1/cover-letter/generate` | OK |  |
| `src/api/ai.ts:53` | `/v1/communication/suggestions` | `/api/v1/communication/suggestions` | OK |  |
| `src/api/ai.ts:75` | `/v1/communication/generate` | `/api/v1/communication/generate` | OK |  |
| `src/api/ai.ts:85` | `/v1/communications/${commId}/response` | `/api/v1/communications/{commId}/response` | OK |  |
| `src/api/ai.ts:100` | `/v1/communication/stats` | `/api/v1/communication/stats` | OK |  |
| `src/api/ai.ts:127` | `/v1/interview/prep` | `/api/v1/interview/prep` | OK |  |
| `src/api/ai.ts:142` | `/v1/resumes/${resumeId}/knowledge-graph` | `/api/v1/resumes/{id}/knowledge-graph` | OK |  |
| `src/api/ai.ts:364` | `/v1/interview/copilot/stream` | `/api/v1/interview/copilot/stream` | OK |  |

## omnisave / knowledge hub / saves

| Frontend call | Path | Go match | Status | Note |
|---|---|---|---|---|
| `src/api/dashboard.ts:365` | `/saves${query}` | `-` | OK |  |
| `src/api/dashboard.ts:369` | `/saves` | `/api/saves` | OK |  |
| `src/api/dashboard.ts:376` | `/saves/${id}` | `/api/saves/{id}` | OK |  |
| `src/api/ai.ts:294` | `/v1/saves` | `/api/v1/saves` | OK |  |
| `src/api/ai.ts:300` | `/v1/saves/import` | `/api/v1/saves/import` | OK |  |
| `src/api/ai.ts:307` | `/v1/saves/${encodeURIComponent(sourceId)}` | `/api/v1/saves/{id}` | OK |  |
| `src/api/ai.ts:314` | `/v1/saves/sync` | `/api/v1/saves/sync` | OK |  |
| `src/api/ai.ts:344` | `/v1/knowledge-hub/query` | `/api/v1/knowledge-hub/query` | OK |  |
| `src/api/ai.ts:498` | `/v1/saves/${encodeURIComponent(sourceId)}/highlights/${encodeURIComponent(highlightId)}` | `/api/v1/saves/{source_id}/highlights/{highlight_id}` | OK |  |
| `src/api/ai.ts:526` | `/v1/context/graph${suffix}` | `-` | MISSING_GO |  |
| `src/api/ai.ts:587` | `/v1/saves/capture/runs` | `/api/v1/saves/capture/runs` | OK |  |
| `src/api/ai.ts:595` | `/v1/saves/capture/runs?limit=${Math.max(1, Math.min(limit, 100))}` | `/api/v1/saves/capture/runs` | OK |  |
| `src/api/ai.ts:600` | `/v1/saves/capture/runs/${encodeURIComponent(runId)}` | `/api/v1/saves/capture/runs/{run_id}` | OK |  |
| `src/api/ai.ts:605` | `/v1/saves/capture/runs/${encodeURIComponent(runId)}/checkpoint` | `/api/v1/saves/capture/runs/{run_id}/checkpoint` | OK |  |
| `src/api/ai.ts:613` | `/v1/saves/capture/runs/${encodeURIComponent(runId)}/cancel` | `/api/v1/saves/capture/runs/{run_id}/cancel` | OK |  |
| `src/api/ai.ts:654` | `/v1/saves/sync/settings` | `/api/v1/saves/sync/settings` | OK |  |
| `src/api/ai.ts:663` | `/v1/saves/sync/settings` | `/api/v1/saves/sync/settings` | OK |  |
| `src/api/ai.ts:671` | `/v1/saves/sync/runs?limit=${Math.max(1, Math.min(limit, 100))}` | `/api/v1/saves/sync/runs` | OK |  |
| `src/api/ai.ts:684` | `/v1/saves/activity?limit=${Math.max(1, Math.min(limit, 100))}` | `/api/v1/saves/activity` | OK |  |
| `src/api/ai.ts:689` | `/v1/saves/export` | `/api/v1/saves/export` | OK |  |
| `src/api/ai.ts:712` | `/v1/saves/import/seed` | `/api/v1/saves/import/seed` | OK |  |
| `src/api/ai.ts:720` | `/v1/saves/import/jobs?limit=${Math.max(1, Math.min(limit, 100))}` | `/api/v1/saves/import/jobs` | OK |  |
| `src/api/ai.ts:725` | `/v1/saves/import/jobs/${encodeURIComponent(jobId)}/hydrate?limit=${Math.max(1, Math.min(limit, 100))}` | `/api/v1/saves/import/jobs/{job_id}/hydrate` | OK |  |
| `src/api/ai.ts:750` | `/v1/brief${query.toString() ? ` | `-` | MISSING_GO |  |
| `src/api/ai.ts:758` | `/v1/agent/omnisave/library?${params.toString()}` | `/api/v1/agent/omnisave/library` | OK |  |
| `src/api/ai.ts:767` | `/v1/agent/omnisave/brief${query.toString() ? ` | `-` | MISSING_GO |  |

## career-ops / career-intelligence

| Frontend call | Path | Go match | Status | Note |
|---|---|---|---|---|
| `src/api/jobs.ts:234` | `/v1/career-intelligence/skills-gap` | `/api/v1/career-intelligence/skills-gap` | OK |  |
| `src/api/jobs.ts:241` | `/v1/career-intelligence/learning-path` | `/api/v1/career-intelligence/learning-path` | OK |  |
| `src/api/jobs.ts:248` | `/v1/career-intelligence/salary-benchmark` | `/api/v1/career-intelligence/salary-benchmark` | OK |  |
| `src/api/dashboard.ts:215` | `/v1/career-ops/portals` | `/api/v1/career-ops/portals` | OK |  |
| `src/api/dashboard.ts:219` | `/v1/career-ops/portals` | `/api/v1/career-ops/portals` | OK |  |
| `src/api/dashboard.ts:226` | `/v1/career-ops/portals/${portalId}` | `/api/v1/career-ops/portals/{portal_id}` | OK |  |
| `src/api/dashboard.ts:233` | `/v1/career-ops/portals/${portalId}` | `/api/v1/career-ops/portals/{portal_id}` | OK |  |
| `src/api/dashboard.ts:271` | `/v1/career-ops/scan` | `/api/v1/career-ops/scan` | OK |  |
| `src/api/dashboard.ts:278` | `/v1/career-ops/patterns` | `/api/v1/career-ops/patterns` | OK |  |
| `src/api/dashboard.ts:282` | `/v1/career-ops/followups` | `/api/v1/career-ops/followups` | OK |  |
| `src/api/dashboard.ts:286` | `/v1/career-ops/followups/${applicationId}/action` | `-` | MISSING_GO (now fixed) | Fixed in this session: path had `${applicationId}` where Go/Python expect a static path + `application_id` body field. |
| `src/api/dashboard.ts:296` | `/v1/career-ops/story-bank` | `/api/v1/career-ops/story-bank` | OK |  |
| `src/api/dashboard.ts:300` | `/v1/career-ops/story-bank` | `/api/v1/career-ops/story-bank` | OK |  |
| `src/api/dashboard.ts:307` | `/v1/career-ops/story-bank/${index}` | `/api/v1/career-ops/story-bank/{index}` | OK |  |
| `src/api/dashboard.ts:313` | `/v1/career-ops/stats` | `/api/v1/career-ops/stats` | OK |  |

## browser automation

| Frontend call | Path | Go match | Status | Note |
|---|---|---|---|---|
| `src/api/browser.ts:15` | `/v1/browser/automation/cancel` | `/api/v1/browser/automation/cancel` | OK |  |
| `src/api/browser.ts:103` | `/v1/browser/automation/stream` | `/api/v1/browser/automation/stream` | OK |  |
| `src/api/browser.ts:162` | `/v1/computer/run/${encodeURIComponent(normalizedRunId)}` | `/api/v1/computer/run/{runId}` | OK |  |

## account / settings / profile

| Frontend call | Path | Go match | Status | Note |
|---|---|---|---|---|
| `src/api/account.ts:15` | `/v1/me` | `/api/v1/me` | OK |  |
| `src/api/account.ts:24` | `/v1/user/data` | `/api/v1/user/data` | OK |  |
| `src/api/account.ts:58` | `/v1/profile` | `/api/v1/profile` | OK |  |
| `src/api/account.ts:62` | `/v1/profile` | `/api/v1/profile` | OK |  |
| `src/api/account.ts:69` | `/v1/account/password` | `/api/v1/account/password` | OK |  |
| `src/api/account.ts:78` | `/v1/me/export` | `/api/v1/me/export` | OK |  |
| `src/api/dashboard.ts:7` | `/v1/profile` | `/api/v1/profile` | OK |  |
| `src/api/dashboard.ts:11` | `/v1/profile` | `/api/v1/profile` | OK |  |
| `src/api/dashboard.ts:18` | `/dashboard/stats` | `/api/dashboard/stats` | OK |  |
| `src/api/dashboard.ts:48` | `/v1/conversations` | `/api/v1/conversations` | OK |  |
| `src/api/dashboard.ts:57` | `/v1/conversations` | `/api/v1/conversations` | OK |  |
| `src/api/dashboard.ts:64` | `/v1/conversations/${id}` | `/api/v1/conversations/{convId}` | OK |  |
| `src/api/dashboard.ts:71` | `/v1/conversations/${id}/messages` | `/api/v1/conversations/{convId}/messages` | OK |  |
| `src/api/dashboard.ts:81` | `/v1/conversations/${id}` | `/api/v1/conversations/{convId}` | OK |  |
| `src/api/dashboard.ts:88` | `/v1/conversations/${id}` | `/api/v1/conversations/{convId}` | OK |  |
| `src/api/dashboard.ts:94` | `/v1/preferences` | `/api/v1/preferences` | OK |  |
| `src/api/dashboard.ts:98` | `/v1/preferences/refresh` | `/api/v1/preferences/refresh` | OK |  |
| `src/api/dashboard.ts:116` | `/v1/preferences/controls?limit=${Math.max(1, Math.min(limit, 200))}` | `/api/v1/preferences/controls` | OK |  |
| `src/api/dashboard.ts:124` | `/v1/preferences/controls/${encodeURIComponent(controlId)}` | `/api/v1/preferences/controls/{controlId}` | OK |  |
| `src/api/dashboard.ts:132` | `/v1/preferences/controls/${encodeURIComponent(controlId)}` | `/api/v1/preferences/controls/{controlId}` | OK |  |
| `src/api/dashboard.ts:152` | `/v1/preparation/outcomes` | `/api/v1/preparation/outcomes` | OK |  |
| `src/api/dashboard.ts:160` | `/v1/preparation/outcomes?limit=${Math.max(1, Math.min(limit, 200))}` | `/api/v1/preparation/outcomes` | OK |  |
| `src/api/dashboard.ts:179` | `/v1/chain/${encodeURIComponent(userId)}` | `/api/v1/chain/{userId}` | OK |  |
| `src/api/dashboard.ts:317` | `/v1/career/next-actions` | `/api/v1/career/next-actions` | OK |  |
| `src/api/dashboard.ts:333` | `/v1/profile/import-pdf` | `/api/v1/profile/import-pdf` | OK |  |
| `src/api/dashboard.ts:391` | `/gmail/status` | `/api/gmail/status` | OK |  |
| `src/api/dashboard.ts:395` | `/gmail/login` | `/api/gmail/login` | OK |  |
| `src/api/dashboard.ts:406` | `/gmail/sync` | `/api/gmail/sync` | OK |  |
| `src/api/dashboard.ts:414` | `/gmail/disconnect` | `/api/gmail/disconnect` | OK |  |
| `src/api/dashboard.ts:428` | `/google/calendar/status` | `/api/google/calendar/status` | OK |  |
| `src/api/dashboard.ts:432` | `/google/calendar/login` | `/api/google/calendar/login` | OK |  |
| `src/api/dashboard.ts:436` | `/google/calendar/sync` | `/api/google/calendar/sync` | OK |  |
| `src/api/dashboard.ts:440` | `/google/calendar/disconnect` | `/api/google/calendar/disconnect` | OK |  |
| `src/api/dashboard.ts:444` | `/google/drive/status` | `/api/google/drive/status` | OK |  |
| `src/api/dashboard.ts:448` | `/google/drive/login` | `/api/google/drive/login` | OK |  |
| `src/api/dashboard.ts:452` | `/google/drive/sync` | `/api/google/drive/sync` | OK |  |
| `src/api/dashboard.ts:456` | `/google/drive/disconnect` | `/api/google/drive/disconnect` | OK |  |
| `src/api/dashboard.ts:460` | `/api-keys` | `/api/api-keys` | OK |  |
| `src/api/dashboard.ts:464` | `/api-keys` | `/api/api-keys` | OK |  |
| `src/api/dashboard.ts:471` | `/api-keys/${id}` | `/api/api-keys/{id}` | OK |  |
| `src/api/dashboard.ts:477` | `/api-keys/usage/${id}` | `/api/api-keys/usage/{id}` | OK |  |
| `src/api/dashboard.ts:529` | `/v1/notification-preferences/whatsapp/link` | `/api/v1/notification-preferences/whatsapp/link` | OK |  |
| `src/api/dashboard.ts:536` | `/v1/notification-preferences/whatsapp/confirm` | `/api/v1/notification-preferences/whatsapp/confirm` | OK |  |
| `src/api/dashboard.ts:543` | `/v1/automations` | `/api/v1/automations` | OK |  |
| `src/api/dashboard.ts:556` | `/v1/automations` | `/api/v1/automations` | OK |  |
| `src/api/dashboard.ts:560` | `/v1/automations/${encodeURIComponent(automationId)}/runs` | `/api/v1/automations/{automationID}/runs` | OK |  |
| `src/api/dashboard.ts:574` | `/v1/automation-runs/${encodeURIComponent(runId)}` | `/api/v1/automation-runs/{runID}` | OK |  |
| `src/api/dashboard.ts:577` | `/v1/automation-runs/${encodeURIComponent(runId)}/events` | `/api/v1/automation-runs/{runID}/events` | OK |  |
| `src/api/dashboard.ts:580` | `/v1/approvals` | `/api/v1/approvals` | OK |  |
| `src/api/dashboard.ts:584` | `/v1/approvals/${encodeURIComponent(id)}/${decision}` | `-` | MISSING_GO |  |
| `src/api/dashboard.ts:588` | `/v1/notification-preferences` | `/api/v1/notification-preferences` | OK |  |
| `src/api/dashboard.ts:592` | `/v1/notification-preferences` | `/api/v1/notification-preferences` | OK |  |
| `src/api/dashboard.ts:596` | `/v1/approvals/${encodeURIComponent(id)}/notify` | `/api/v1/approvals/{approvalID}/notify` | OK |  |

## social / feed

| Frontend call | Path | Go match | Status | Note |
|---|---|---|---|---|
| `src/api/social.ts:37` | `/v1/feed/interview-questions${query}` | `-` | MISSING_GO |  |
| `src/api/social.ts:41` | `/v1/interview-questions` | `/api/v1/interview-questions` | OK |  |
| `src/api/social.ts:48` | `/v1/interview-questions/${id}/upvote` | `/api/v1/interview-questions/{id}/upvote` | OK |  |

## tasks / hermes

| Frontend call | Path | Go match | Status | Note |
|---|---|---|---|---|
| `src/api/tasks.ts:17` | `/v1/tasks` | `/api/v1/tasks` | OK |  |
| `src/api/tasks.ts:18` | `/v1/tasks` | `/api/v1/tasks` | OK |  |
| `src/api/tasks.ts:19` | `/v1/tasks/${encodeURIComponent(id)}` | `/api/v1/tasks/{taskID}` | OK |  |
| `src/api/tasks.ts:20` | `/v1/tasks/${encodeURIComponent(id)}/events` | `/api/v1/tasks/{taskID}/events` | OK |  |
| `src/api/tasks.ts:21` | `/v1/tasks/${encodeURIComponent(id)}/plan` | `/api/v1/tasks/{taskID}/plan` | OK |  |
| `src/api/tasks.ts:22` | `/v1/tasks/${encodeURIComponent(id)}/plan` | `/api/v1/tasks/{taskID}/plan` | OK |  |
| `src/api/tasks.ts:23` | `/v1/tasks/${encodeURIComponent(id)}/artifacts` | `/api/v1/tasks/{taskID}/artifacts` | OK |  |
| `src/api/tasks.ts:24` | `/v1/tasks/${encodeURIComponent(id)}/plan/approve` | `/api/v1/tasks/{taskID}/plan/approve` | OK |  |
| `src/api/tasks.ts:25` | `/v1/tasks/${encodeURIComponent(id)}/plan/reject` | `/api/v1/tasks/{taskID}/plan/reject` | OK |  |
| `src/api/tasks.ts:26` | `/v1/tasks/${encodeURIComponent(id)}/pause` | `/api/v1/tasks/{taskID}/pause` | OK |  |
| `src/api/tasks.ts:27` | `/v1/tasks/${encodeURIComponent(id)}/resume` | `/api/v1/tasks/{taskID}/resume` | OK |  |
| `src/api/tasks.ts:28` | `/v1/tasks/${encodeURIComponent(id)}/takeover` | `/api/v1/tasks/{taskID}/takeover` | OK |  |
| `src/api/tasks.ts:29` | `/v1/tasks/${encodeURIComponent(id)}/stop` | `/api/v1/tasks/{taskID}/stop` | OK |  |
| `src/api/tasks.ts:30` | `/v1/tasks/${encodeURIComponent(id)}/actions` | `/api/v1/tasks/{taskID}/actions` | OK |  |
| `src/api/tasks.ts:31` | `/v1/tasks/${encodeURIComponent(id)}/actions` | `/api/v1/tasks/{taskID}/actions` | OK |  |
| `src/api/tasks.ts:32` | `/v1/tasks/${encodeURIComponent(taskId)}/actions/${encodeURIComponent(actionId)}/approve` | `/api/v1/tasks/{taskID}/actions/{actionID}/approve` | OK |  |
| `src/api/tasks.ts:33` | `/v1/tasks/${encodeURIComponent(taskId)}/actions/${encodeURIComponent(actionId)}/deny` | `/api/v1/tasks/{taskID}/actions/{actionID}/deny` | OK |  |

## provenance / verification / referral / misc

| Frontend call | Path | Go match | Status | Note |
|---|---|---|---|---|
| `src/api/watches.ts:18` | `/v1/watches` | `/api/v1/watches` | OK |  |
| `src/api/watches.ts:27` | `/v1/watches` | `/api/v1/watches` | OK |  |
| `src/api/watches.ts:43` | `/v1/watches/${encodeURIComponent(String(id))}` | `/api/v1/watches/{id}` | OK |  |
| `src/api/watches.ts:50` | `/v1/watches/${encodeURIComponent(String(id))}` | `/api/v1/watches/{id}` | OK |  |
| `src/api/referral.ts:36` | `/v1/referral/draft` | `/api/v1/referral/draft` | OK |  |
| `src/api/credits.ts:121` | `/v1/billing/create-checkout-session` | `/api/v1/billing/create-checkout-session` | OK |  |
| `src/api/provenance.ts:96` | `/v1/provenance/artifacts/${encodeURIComponent(artifactId)}` | `/api/v1/provenance/artifacts/{artifactId}` | OK |  |
| `src/api/provenance.ts:103` | `/v1/provenance/artifacts/${encodeURIComponent(artifactId)}/disclosure` | `/api/v1/provenance/artifacts/{artifactId}/disclosure` | OK |  |
| `src/api/verification.ts:15` | `/v1/verification/submit` | `/api/v1/verification/submit` | OK |  |
| `src/api/verification.ts:22` | `/v1/verification/status` | `/api/v1/verification/status` | OK |  |
| `src/api/auth.ts:12` | `/v1/auth/rate-limit` | `/api/v1/auth/rate-limit` | OK |  |

## Go -> Python proxy check (spot check, not exhaustive)

Sampled Go handlers that call `s.AI.PostJSON`/`GetJSON`/`PostJSONWithHeaders` against `/api/v1/...` targets, confirmed present in `backend/python/app/main.py` router includes and their `app/api/*_routes.py` prefixes:

| Go proxy target | Python route file | Status |
|---|---|---|
| `/api/v1/career-ops/*` | `app/api/career_ops_routes.py` (`prefix="/api/v1/career-ops"`) | OK |
| `/api/v1/resumes/analyze-text` | resume analysis routes | OK |
| `/api/v1/referral/draft` | referral routes | OK |
| `/api/v1/verification/submit` | verification routes | OK |
| `/api/v1/interview/copilot-hint`, `/api/v1/interview/copilot/stream` | interview routes | OK |
| `/api/v1/saves/*`, `/api/v1/context/graph`, `/api/v1/agent/omnisave/*` (all via `prefix+"..."` string concatenation in `routes_omnisave.go`) | omnisave/knowledge-hub routes | OK (not exhaustively verified per sub-path — concatenated at runtime, not statically greppable) |

No Go->Python proxy call was found targeting a Python path that doesn't exist, in the sample checked. A full exhaustive proxy audit (every `s.AI.*` call site vs. every `@router.*` in `backend/python/app/`) was not completed given the size of the surface (hundreds of call sites) — treat this section as a spot check, not a guarantee.

## Orphaned / backend-only routes (no frontend caller found in `src/`)

A full enumeration of all ~380 unique Go route paths against all `src/` callers was not completed exhaustively. The three candidates originally flagged here have since been resolved:

- `/api/v1/public/analyze-text` (`routes_app.go`) — **false positive.** Called from `src/pages/ResumeScore.tsx:317`, `FreeAtsScan.tsx:66`, and `JobMatch.tsx:280` as `/v1/public/analyze-text` — the earlier grep pass missed the un-prefixed form these callers actually use. Live and reachable.
- `/api/v1/linkedin/analyze` (`routes_mvp.go`) — **false positive.** Called from `src/pages/LinkedInImport.tsx:29` as `/linkedin/analyze`. Live and reachable.
- `/api/automation-runs/{runID}/approvals` (`routes_automations.go`, `handleCreateAutomationApproval`) — **confirmed genuinely backend-only, not a bug.** No `src/` caller exists; the web UI creates/decides approvals through a different, already-used pair (`GET /v1/approvals`, `POST /v1/approvals/{id}/{decision}` — see `src/api/dashboard.ts:587-609`, `ReviewQueue.tsx`, `AgentPanel.tsx`). This route reads a client-supplied JSON body and is gated behind `capabilities.WorkspaceApprovals`, matching the shape of an API meant for the Desktop Agent / MCP integration (Settings → Integrations → "Desktop Agent Integration", a personal-access-token-authenticated API client, not the web UI) to register its own approval requests programmatically. Intentional, not dead code.

## Critical findings (live broken links)

1. **FIXED in this session**: `src/api/dashboard.ts:286` (`actionCareerOpsFollowup`, called live from `src/pages/CareerOpsDashboard.tsx:231`) sent the application id as a URL path segment (`/v1/career-ops/followups/${applicationId}/action`); neither the Go route (`backend/go/internal/api/routes_career_ops.go:26-27`, static path) nor the Python route (`backend/python/app/api/career_ops_routes.py:155-156`, `FollowupActionRequest.application_id` body field) has an id in the path. Every "mark followed up" click 404'd. Fixed to POST the static path with `application_id` in the JSON body. Verified with `npx tsc --noEmit` (no new errors). Not rebuilt/redeployed — no running stack in this session.

2. **NOT fixed — real feature gap**: `src/api/autopilot.ts:49` (`downloadApplicationResume`, called live from `src/pages/AutoPilot.tsx:546`) calls `GET /applications/${id}/resume-docx`. No matching Go route exists anywhere in `backend/go/internal/api/`, and Python has no id-keyed docx-export route either (only a generic `POST /api/v1/export/docx` taking raw resume text). This needs a route/handler implementation decision (what "the application's resume" resolves to server-side), not a mechanical rename — left unfixed per task scope.

3. Two additional MISSING_GO frontend calls were found (`simulateAtsParsing` -> `/v1/ats/simulate`, `getAnalysis` -> `/v1/analyze/{id}`, both in `src/api/resumes.ts`) but both are dead code with zero callers anywhere in `src/` — not live bugs, listed in the table above for completeness.
