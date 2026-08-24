# Tayari Real-User Staging Protocol

**Applies to:** real candidate resumes, real public job-post URLs, authenticated user accounts, and user-initiated AutoPilot/approval interactions.  
**Decision rule:** No real participant may be invited until every red item in this protocol is closed with recorded evidence.  
**Scope rule:** This protocol tests what is actually supported by the current codebase. It does **not** authorize automated employer submissions, real payments, production messaging, browser/computer control, or the preview-only Apply Agent.

## 1. Current Interaction Surface: What Can Be Tested Honestly

| Interaction | Current implementation evidence | Staging status | Non-negotiable boundary |
|---|---|---|---|
| Resume upload | `ResumeUpload` accepts PDF/DOCX only, with a 5 MB client validation limit. It extracts text, uploads or creates a resume record, then analyzes it against a job description. | **Allowed after privacy gate.** | Use only the participant’s own resume; no shared resume library, recruiter uploads, or staff handling outside the designated support channel. |
| Pasted resume | User may paste resume text and create a text resume record. | **Allowed after privacy gate.** | Same consent, retention, access, and deletion controls as file upload. |
| Pasted job description | User may paste a job description, review it, and request analysis. | **Allowed.** | The user must verify the text is public or they are authorized to use it. |
| Public job-post import | The UI calls the job-description import path, then explicitly tells the user to review and edit imported content before analysis. The Python importer uses public-URL validation, pinned resolution, no redirects, content-type checks, byte limits, and timeouts. | **Allowed in a small pilot.** | Only public employer/ATS URLs; never internal URLs, intranet URLs, shared/private documents, paywalled pages, or URL shorteners. |
| Resume/JD analysis | The app persists a resume and JD, calls analysis, and shows results. | **Allowed after no-fabrication and privacy tests.** | Results are advisory. Users must not be told they have an interview match, ATS certification, or employer approval. |
| AutoPilot start | Current UI requires an existing resume and starts with `auto_apply: false`; it uses query, location, max-jobs, and tailor-per-job inputs. | **Allowed only as a supervised preparation workflow.** | It may discover, draft, queue, and prepare. It must not submit a real employer application. |
| Review queue approval/rejection | Current UI exposes explicit approve/reject controls. The AutoPilot UI describes approved applications as moved to saved jobs. | **Allowed only after external-side-effect proof.** | Approval must not cause external form submission, email, payment, employer contact, or third-party account action. |
| Automation workspace / approval delivery | Durable automation and Workspace approvals exist in backend routes, but their product feature flag is disabled for production. | **Not in real-user staging unless separately approved.** | Do not silently enable a disabled feature to “see what happens.” It requires a dedicated design, threat model, and staging plan. |
| Browser/computer control | The product flags computer control as preview/staging-only; gateway capability tests exist. | **Excluded from this protocol.** | Never use a participant’s employer, LinkedIn, email, or browser session during this staging cycle. |
| Apply Agent | The route is preview-only because its UI/edge-function data contract does not match the canonical durable-agent schema. | **Excluded.** | Do not override the production feature gate or provide direct links to participants. |

## 2. Red Gates Before Any Real Resume Is Accepted

### 2.1 Remove and prove removal of client-side resume logging

The current upload screen logs the first 200 characters of extracted resume text in `src/pages/ResumeUpload.tsx`. This is a **red gate**. Browser consoles, session recordings, support screenshots, shared devices, and third-party debugging tools can expose that data.

Before participant one:

1. Remove every client `console.log`, `console.debug`, error payload, analytics event, and telemetry breadcrumb that can contain resume text, job-description text, file content, access tokens, or generated application answers.
2. Add a regression test or static guard that fails if the real-resume upload path logs extracted content.
3. Build the staging artifact and manually upload a synthetic resume while browser developer tools, error tracking, network inspector, and server logs are monitored.
4. Record evidence that none contains the synthetic resume body, first 200 characters, file content, or personally identifying fields.

**Fail the launch** if any resume, JD, email, phone number, address, credential, or raw generated answer appears in console output, analytics, server logs, error tracking, or a support-exportable trace.

### 2.2 Participant consent and expectation contract

Every participant must explicitly see and accept a staging notice before uploading a real resume. The notice must state, in plain language, that the environment is a controlled pre-production test; that real resume and job-post data will be processed; where data is stored; who can access it; the planned retention period; how to delete the data; that AI suggestions may be wrong; and that Tayari will not submit an employer application, send a message, charge money, or take an external action without a separate explicit user action.

Consent must be versioned, timestamped, associated with the staging account, and exportable. Do not rely on a Slack/WhatsApp message or verbal agreement. The first participant cohort should be no more than **five informed internal testers or trusted adult design partners**, each using their own account and their own resume.

### 2.3 Data minimization and deletion proof

Use a staging-only database and object storage prefix. Do not copy participant resumes, job descriptions, output packets, or browser-session materials into issue trackers, chat, analytics, local desktops, screenshots, or test fixtures. Give each participant a one-click account deletion/export path or a named support owner who can perform deletion within one business day.

Before inviting users, perform a deletion rehearsal with synthetic data. Verify that the resume file, parsed text, job description, analysis record, generated output, related saved jobs, and derived automation records are deleted or clearly documented under the existing retention policy. Verify that backups/PITR retention is disclosed rather than implied away.

## 3. Real Resume Pilot: Required Test Script

The pilot uses only one participant at a time. The facilitator is responsible for observing the product and records metadata, not copies of the participant’s material.

| Step | Participant action | Required product behavior | Evidence to retain | Stop immediately if |
|---|---|---|---|---|
| 1 | Create a staging account and accept the consent notice. | Account is isolated; consent record is visible; no production service is touched. | User ID, consent version/time, environment label. | Account can access another participant’s records or no consent record exists. |
| 2 | Upload their own PDF/DOCX resume under 5 MB, or paste their own resume text. | File type/size are validated; user sees clear parsing state; no content logged. | File type/size only, request ID, success/error code, privacy-log review. | Console/log/telemetry contains raw content or PII. |
| 3 | Review extracted text before proceeding. | The user can identify parsing loss/corruption and stop. | Participant yes/no acknowledgement, not resume text. | Extraction silently creates materially incorrect data with no visible review point. |
| 4 | Paste a real public job description or import an approved public job-post URL. | Imported content is shown as editable; user is told to review it before analysis. | URL hostname only, import status, response size/latency, user confirmation. | Redirect/private URL accepted, imported page has incorrect source, or content is hidden from review. |
| 5 | Start analysis. | Request is bounded; progress/error state is honest; result is advisory and measurable. | Request ID, latency, HTTP status, model/provider label, result-schema check. | Infinite spinner, 5xx without safe error, fabricated success on provider failure, or sensitive data logged. |
| 6 | Review recommendations and an intentionally unsupported requirement in the job description. | Unsupported facts are presented as a gap/unknown, not added as candidate experience. | Reviewer checklist; output hash or redacted excerpt. | The system invents an employer, degree, certification, metric, date, or skill. |
| 7 | Export or save as supported, then request account/data deletion. | Export/deletion scopes are clear and deletion is verifiable. | Deletion ticket/confirmation, table/object deletion evidence. | Data remains readable to the user or staff beyond disclosed retention. |

The real-resume pilot is not a usability study alone. It is an authorization, privacy, truthfulness, and deletion test. One serious failure pauses all further participant testing.

## 4. Real Public Job-Link Pilot

### 4.1 URL allowlist for this staging cycle

Allow only public HTTPS URLs from a small, documented set of employer career sites or ATS providers chosen by the test team. Begin with two or three domains that are stable and openly accessible. Do not accept shortened URLs, URLs with embedded credentials, URLs resolving to private IP space, custom participant domains, localhost/IP-literal URLs, Google Docs/Drive links, LinkedIn application flows, pages requiring sign-in, browser extensions, or redirects.

The current importer already rejects redirects and uses bounded fetch controls. The staging test must prove—not assume—that these controls reject a URL that is private, redirecting, oversized, non-text, unsupported, or slow. Record only the category and status code, never fetched page bodies in logs.

### 4.2 Participant experience rules

The participant must be shown the imported job description before any analysis runs. They must be able to edit it, erase it, or abandon the workflow. The UI should state whether the content was pasted or imported, the source hostname, and that the system cannot verify the employer’s authenticity or that the job remains open.

The importer must not log into an employer site, bypass a paywall, call an employer API with user credentials, crawl beyond the submitted URL, or follow a redirect. The tool is a public-text importer, not a browser agent.

| Negative link test | Required result |
|---|---|
| `http://` link | Rejected or upgraded only if the code explicitly enforces and records safe HTTPS behavior. |
| Redirecting public URL | Rejected with a clear “redirects not allowed” explanation. |
| Private IP / localhost / metadata-style target | Rejected before network fetch. |
| Large non-text response | Rejected at the configured size/content-type boundary. |
| Paywalled or login-required URL | Clear failure; no attempt to authenticate. |
| A normal public ATS link | Imported text shown for participant review; no application action occurs. |

## 5. User-Initiated Automation: Strictly Bounded Staging Protocol

### 5.1 What the current AutoPilot may do

The current AutoPilot UI requires a resume, accepts job query/location/max-job/tailoring options, and sends `auto_apply: false`. Its stated behavior is to scan roles, optimize resumes, draft tailored cover letters, and route candidate review through a review queue. In this staging cycle, treat it as a **prepare-and-review workflow only**.

A “real automation trigger” means a logged-in participant intentionally presses the current **Start AutoPilot** control after seeing a preflight summary. The preflight must show the selected query, location, max-job cap, resume selected, `auto_apply: false`, permitted data sources, estimated AI usage, and a plain-language statement: “This run will not submit an application, send a message, or act on an employer website.” The participant must affirm this summary before the trigger is accepted.

### 5.2 Trigger policy

| Control | Required staging setting | Reason |
|---|---|---|
| Participant cohort | Maximum five consented users, one active run per user | Limits blast radius and makes observation possible. |
| Job cap | Maximum five jobs per run | Matches current default and bounds cost/side effects. |
| Concurrent runs | One active run per participant; system-wide cap set by platform owner | Prevents queue/provider exhaustion. |
| `auto_apply` | Hard-coded/validated `false` at UI, gateway, and backend | Prevents the critical external side effect. |
| Review queue | Every candidate-facing draft must be reviewable, approvable, rejectable, and auditable | Candidate maintains control. |
| Approval action | Test only that approval changes internal queue/saved-job state | No external submission, email, calendar, or browser action. |
| External integrations | Billing test mode; outbound email/WhatsApp/browser control disabled | No accidental third-party impact. |
| Kill switch | Feature flag and route/API/celery trigger can be disabled in under 10 minutes | Immediate containment if anything becomes unsafe. |

### 5.3 Required automation evidence

For each real AutoPilot run, capture a run ID, participant ID, consent version, trigger timestamp, configuration metadata, `auto_apply=false` assertion, result status, number of discovered/prepared items, approval/rejection actions, all external-side-effect counters, and deletion status. Do **not** record raw resume text, raw job descriptions, full generated cover letters, or uploaded documents in the evidence ledger.

The system must prove that a review approval did not submit an external application. Use network logs, integration audit logs, job-board sandbox evidence where available, and backend event records. A claim such as “it should not apply” is insufficient.

### 5.4 Automation stop conditions

Immediately disable AutoPilot for all participants if any run performs, attempts, queues, or represents an external side effect without a separately recorded explicit user action. This includes an employer form submission, email, calendar invite, referral message, application-tracker status asserted as “submitted,” third-party account login, browser click through a job form, or paid API operation beyond the disclosed budget.

Also stop if any participant can see another user’s run, draft, resume, job link, approval, or timeline; if an approval can be replayed/modified by another user; if a failed provider response is represented as a completed draft; or if an AI output invents a candidate fact.

## 6. Roles and Human Controls

| Role | May do | Must not do |
|---|---|---|
| Participant | Upload own resume; provide own public job link; start a bounded preparation run; review/reject/approve internal drafts; request deletion | Share another person’s data; expect an external job submission; enable preview-only automation features |
| Facilitator | Observe test, collect metadata, pause test, file defects | View/copy raw participant content unless participant explicitly supplies it through the product; override a participant decision |
| Support/data owner | Process deletion/export requests; inspect redacted operational data; authorize cleanup | Use staging material for product demos, training, or unrelated analysis |
| Platform owner | Set quotas, disabled integrations, access, backups, alerting, and kill switches | Enable real billing/browser/OAuth/employer side effects without a separate change review |
| Release approver | Read evidence ledger and decide go/no-go | Waive a privacy, RLS, external-action, or truthfulness red gate |

## 7. Expanded Evidence Ledger

Add these rows to the primary staging command plan. All must pass before real-user staging expands beyond the initial cohort.

| Gate | Required proof | Result | Owner | Stop-ship threshold |
|---|---|---|---|---|
| Resume console/telemetry scrub | Synthetic upload monitored across browser console, Sentry, logs, analytics, request tracing |  |  | Any raw content/PII appears |
| Participant consent | Versioned notice, timestamp, user association, withdrawal/deletion contact |  |  | Missing or ambiguous consent |
| Real resume upload | PDF/DOCX and pasted-text pilot complete; validation, parsing review, analysis, deletion proven |  |  | Content leak, broken parsing review, cross-user access |
| Real job-link import | Allowed public link works; redirects/private/oversize/non-text inputs fail safely |  |  | SSRF control failure, automatic login, hidden imported content |
| Real AutoPilot trigger | Preflight recorded; `auto_apply=false` at UI/gateway/backend; one bounded run |  |  | Any external action or absent cap/approval |
| Review queue | Internal approve/reject is owner-scoped, auditable, and causes no external action |  |  | Cross-user decision, replay, hidden status change, real submission |
| AI truthfulness | Unsupported test requirement is reported as unknown/gap; outage produces no fabricated result |  |  | Invented candidate fact or false success |
| Participant deletion | Resume/JD/result/run deletion follows the disclosed policy |  |  | User data remains accessible or deletion evidence unavailable |
| Kill-switch rehearsal | Disable AutoPilot plus validate no new runs start within 10 minutes |  |  | Kill switch unavailable or ineffective |

## 8. Real-User Staging Go/No-Go Statement

> “For the named staging release, I have reviewed evidence that real resumes and public job links are handled without content leakage; every participant gave informed consent; job-link import is bounded and non-authenticating; AutoPilot runs are candidate-initiated and constrained to `auto_apply=false`; review approvals have no external side effect; cross-account access was denied; AI failures were honest; deletion and kill switches were exercised; and all observed defects are resolved or explicitly outside the authorized staging scope.”

If the accountable approver cannot sign this statement honestly, do not invite a real participant.
