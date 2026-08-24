# Realistic User-Flow Audit

**Date:** 24 August 2026
**Scope:** Public discovery, account creation, authenticated career workflows, review controls, and programme adoption

## Interaction Coverage

The application was exercised through its local running frontend, gateway, and AI service. The public-route browser suite passed seven route checks. The authenticated API and UI suite passed thirteen checks covering registration and login, answer-bank matching, ATS detection, resume truth validation, recruiter lookup, compensation calculation, live interview-copilot generation, career-ops CRUD, landing navigation, the auth form, the signup redirect, and the authenticated answer-bank page. The complete Playwright suite then completed with **39 passing checks and 14 intentional skips**.

| User journey | Result | Evidence |
| --- | --- | --- |
| Public discovery | Pass | Home, privacy, terms, methodology, about, free scan, and legacy redirect render without server errors. |
| New candidate | Pass | A new test candidate completed registration, login, and the browser signup redirect using the platform’s password policy. |
| Candidate preparation | Pass | Resume review entry, answer bank, ATS detection, truth gate, recruiter research, and interview assistance were exercised. |
| Career decisions | Pass | Compensation calculation, opportunity portal create/list/update/delete, and application-context answer matching completed. |
| Human-review boundary | Pass | Tested flows preserve explicit candidate confirmation for the sensitive answer-bank interaction and do not automate external submission. |
| Product-story conversion | Pass | Browser checks covered the revised home, free-scan, and pricing paths. |

## Discovered Experience Issues

| Priority | Issue | User impact | Root cause | Fix direction |
| --- | --- | --- | --- | --- |
| P1 | Performance telemetry produces multiple request bursts per page | Public navigation can trigger rate-limit noise even though telemetry is nonessential | Each observed web vital sends its own beacon immediately; interaction and layout events can emit repeatedly | Collect only the latest named values and flush a single telemetry beacon when the page is hidden. |
| P1 | Tenant branding is fetched whenever an API URL exists | Public routes make branding requests even in environments that are not provisioned for tenant branding | The implementation comment says self-hosted only, but the guard checks only for an API URL | Restrict automatic branding fetches to the intended self-hosted gateway context and keep the default brand otherwise. |
| P1 | Public landing activity counters request an authenticated dashboard endpoint | First-time visitors see an unavailable activity state and the request appears as a 401 in browser audits | The social-proof component calls a user-scoped dashboard stats endpoint from a public route | Remove the user-scoped request from the public landing surface and keep the narrative/evidence section useful without account data. |

## Delivery Standard

The fixes must preserve self-hosted compatibility, avoid dummy customer proof, preserve the manual-submit boundary, and add targeted regression tests. After implementation, the complete browser suite and focused public-route checks should run again against the live local stack.

## Post-Fix Revalidation

After batching telemetry, restricting optional tenant branding to the self-hosted gateway context, and removing account-scoped activity calls from the public landing surface, the complete Playwright run completed with **39 passing checks, 14 intentional skips, and no failed tests**. The generated result marker reports `status: passed`.

The re-run did not surface the earlier repeated public `429` rate-limit noise for the performance, tenant-branding, or landing activity requests. The route-discovery audit continues to note expected `401` responses when it intentionally probes protected endpoints without a session; those responses confirm the authentication boundary rather than a broken user flow.

| Boundary | Status | Reason |
| --- | --- | --- |
| External application submission | Not exercised | The platform’s manual-submit and human-handoff policy intentionally prevents automated external job submission. |
| Payment completion | Not exercised | The local deployment reports billing as unavailable, so checkout cannot be completed. |
| Real third-party identity and mailbox connections | Not exercised | These require a user-owned provider session and personal authorization; no credentials or external actions were fabricated. |
