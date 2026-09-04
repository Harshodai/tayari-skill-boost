# OmniSaveAI UI Redesign Specification

**Author:** Manus AI
**Status:** Implementation-ready product specification
**Scope:** OmniSaveAI workspace redesign for seamless consented capture, automatic synchronization, provenance-aware review, career preparation, and portable export.

## 1. Product intent

OmniSaveAI should feel like a quiet background companion rather than a form that requires users to paste every link manually. The primary experience is a reliable loop: the candidate gives explicit consent, chooses supported saved-content surfaces, lets the browser companion collect only visible saved items, reviews what entered the library, and reuses that knowledge in role preparation. Manual URL import remains an important fallback, but it must no longer appear to be the product’s main path.

The redesign keeps OmniSaveAI’s evidence-first and career-context strengths while making system status visible at every step. A user should be able to answer four questions without leaving the workspace: **What is being watched? What was captured? Is anything blocked or stale? How can I export or use it next?** The interface must never imply server-side access to private saved lists, arbitrary tabs, passwords, messages, or unsupported platform surfaces.

## 2. Experience principles

| Principle | UI implication | Acceptance signal |
|---|---|---|
| Consent before capture | Automatic capture is off for new users; the first-run card explains scope before the toggle is enabled. | A new account sees a clear opt-in state and no background capture activity. |
| Status over surprise | Every asynchronous action exposes a visible state, timestamp, result count, or actionable error. | No failed or blocked item silently disappears. |
| Review before reuse | Provenance and freshness appear on source cards and export previews. | Users can distinguish URL imports, browser captures, and CSV seed items. |
| Career context is first-class | Role, company, skill, application, and practice contexts are available from the same workspace. | Evidence can move directly from a source into preparation workflows. |
| Portable by default | Export is a dedicated control plane rather than a pair of hidden buttons. | JSON, Markdown, and CSV downloads share a consistent preview and receipt model. |
| Platform boundaries are explicit | Copy states describe supported pages and visible content only. | Users are told what is never read and what requires opening a supported page. |
| Calm motion | Animations communicate progress and hierarchy without delaying interaction. | Panels use the existing FadeIn, SlideUp, and StaggerContainer language; no layout flicker. |

## 3. Workspace information architecture

The page should be organized as a vertical command center with four persistent zones. The **Sync header** is the first zone and gives a one-glance answer about automatic capture. The **Capture and import zone** combines browser sync with manual URL fallback and the full-history seed path. The **Career preparation zone** contains Interview Brief and context graph actions. The **Library zone** contains search, filters, provenance-aware source cards, and evidence workspaces. Export is available from the header and library zone through the same modal, so users do not need to understand which panel owns their data.

| Zone | Primary job | Existing implementation anchor | Redesign direction |
|---|---|---|---|
| Sync header | Enable, pause, inspect, or manually run capture. | `OmniSaveCapturePanel.tsx` | Promote health, last sync, pending items, and platform status to the top of the page. |
| Capture and import | Bring in new sources or seed an existing library. | URL capture and `OmniSaveSeedImportCard.tsx` | Use a two-tab or segmented layout: “Keep in sync” and “Bring existing library.” |
| Career preparation | Turn saved reading into interview preparation. | Interview Brief and context graph cards | Add suggested contexts, coverage stats, new-since-last-brief, and a practice CTA. |
| Library and evidence | Search, inspect, annotate, and reuse sources. | `Omnisave.tsx` source cards and detail dialog | Add capture origin, sync status, freshness, and thread context to every card. |

## 4. Automatic sync control plane

### 4.1 Header summary

The top of the workspace should contain a compact status strip with four values: the automatic-capture state, the latest successful capture time, the number of pending or blocked items, and the next scheduled check. A primary button changes according to state: **Enable automatic capture**, **Pause capture**, or **Sync now**. The status strip must remain readable on mobile by collapsing into a two-row layout rather than truncating timestamps.

The existing consent copy should remain prominent and become more specific: the companion reads visible links and supported metadata from explicitly supported saved-content pages that the user has open or has authorized through the extension. It does not read passwords, private messages, arbitrary tabs, or unrelated pages, and it never posts, shares, applies, or schedules on the user’s behalf.

### 4.2 Controls

| Control | Behavior | Required states |
|---|---|---|
| Automatic capture toggle | Enables or pauses the consented browser companion. | Off by default, enabling, enabled, pausing, paused, unavailable. |
| Platform checkboxes | Select LinkedIn saved posts, Medium reading list, Substack supported feeds, and Instagram saved activity. | Selected, unselected, disabled until companion is connected, partially configured. |
| Interval selector | Choose a bounded interval in minutes; retain the existing 5–1440 minute guardrail. | Saved, unsaved, invalid, saving, failed. |
| Sync now | Starts a user-visible sync of currently supported open pages. | Ready, running, completed, partial, failed, companion unavailable. |
| Companion status | Indicates whether the extension is installed and responding. | Connected, not installed, permission needed, stale heartbeat, offline. |
| Pause control | Stops automatic capture without deleting existing data. | Paused confirmation, paused, resume available. |
| Export | Opens the export drawer/modal without interrupting sync. | Ready, preparing, download ready, failed. |

### 4.3 Sync health language

Health badges must be human-readable and action-oriented. “Healthy” means the last run completed without failures. “Partial sync” means at least one item was imported while another was blocked or failed. “Needs attention” means the most recent run failed or the companion has not responded within the expected interval. “Paused” is not an error. Each non-healthy state must include a next action such as **Open supported page**, **Retry failed items**, **Reconnect companion**, or **Review blocked URLs**.

### 4.4 Platform health rows

Each enabled platform receives a compact row showing the last successful capture, pending item count, last error, and the current scope. This gives the user the platform-level visibility that LinkedMash makes valuable without claiming broader access than OmniSaveAI actually has.

| Platform row field | Example | Data source |
|---|---|---|
| Scope | “LinkedIn saved posts · visible cards only” | Extension manifest and capture result |
| Last success | “Today, 10:42” | Sync run receipt |
| Pending | “3 awaiting hydration” | Seed/sync item counters |
| Last error | “2 pages blocked by login wall” | Per-item failure receipt |
| Action | “Open supported page” or “Retry” | Extension and backend state |

## 5. Capture provenance and source cards

Every source card must expose provenance without making the card visually noisy. The primary row retains the platform badge and NLP status. A secondary metadata row adds **capture origin**, **sync status**, and **last seen**. Origin values are rendered as user-facing labels: “Browser capture,” “URL import,” “LinkedIn CSV,” or “Manual.” Raw enum values remain available in a tooltip and export data.

A blocked or repeatedly failing source must remain visible in the library with a clear status chip. It must not be treated as a successful source and must not be cited as if its content were available. If the source has retry attempts, display “Attempt 2 of 3” or “3 attempts” and expose the latest error in the detail workspace.

| Card element | Success example | Attention example |
|---|---|---|
| Origin badge | `Browser capture` | `LinkedIn CSV` |
| Sync chip | `Synced` | `Blocked · retry available` |
| Freshness | `Seen 2 hours ago` | `Last seen 18 days ago` |
| NLP state | `AI enriched · 94% confidence` | `Needs review` |
| Thread context | `8 replies captured` | `Thread context unavailable` |
| Reuse counts | `2 evidence · 1 role link` | `0 evidence · 0 context` |

The detail workspace should include a provenance drawer with the original URL, first captured timestamp, last seen timestamp, capture origin, content hash status, sync attempts, and last error. This supports auditability and makes duplicate suppression understandable.

## 6. Full-history seed import

The seed importer should be presented as a safe migration path for users who already have a LinkedIn saved-items CSV. The first state is a drag-and-drop zone with a secondary file-picker button. Once selected, the UI parses the file locally and shows a preview before any backend job is created. The preview must identify recognized columns, missing optional columns, row count, invalid URLs, and duplicate URLs.

Before submission, show a deduplication summary such as **1,284 rows found · 1,241 unique URLs · 31 duplicates removed · 12 rows need review**. The user must explicitly confirm the normalized count. The preview does not expose or upload unrelated files, and the CSV is not treated as proof that page content can be hydrated.

During hydration, show a durable progress receipt rather than a transient spinner. The receipt contains total, hydrated, imported, skipped, failed, and remaining counts, plus a progress bar and a **Hydrate next batch** or **Retry failed batch** action. A partial job remains resumable after refresh. Failed items show whether the failure is due to an unavailable page, a login wall, malformed URL, rate limit, or temporary backend error.

## 7. Interview Brief and career preparation

The Interview Brief should become the main “why this matters now” surface. Role, company, and skill fields should support suggestions from the interview board and application data before allowing free-form entry. The brief header displays the active preparation context, the number of matched sources, evidence coverage, freshness, and gaps.

| Brief section | Content | Interaction |
|---|---|---|
| Context picker | Role, company, skill, stage, and optionally application. | Autocomplete from interview board; free-form fallback. |
| Coverage grid | Sources, evidence cards, context links, fresh sources, unresolved gaps. | Each metric filters the library or opens a gap explanation. |
| What’s new | Sources first seen or last seen since the previous brief. | Open source, capture evidence, or dismiss as reviewed. |
| Next actions | Concrete preparation actions derived from coverage. | Link evidence to application, flashcard deck, practice session, or mock interview. |
| Evidence carousel | Short, cited excerpts ordered by relevance and freshness. | Save as question, flashcard, or application note. |
| Practice CTA | Sends selected evidence-derived prompts into the mock interview or Clash of Code workflow. | Confirmation required before creating a practice session. |

The brief must distinguish **source coverage gaps** from **candidate-example gaps**. For example, “No saved reading found for distributed tracing” is different from “Reading found, but no candidate story is linked.” The distinction prevents the product from implying that more browsing alone will solve an experience gap.

## 8. Export control plane

Export should be a single reusable modal or drawer opened from the sync header, library toolbar, and Interview Brief. The first step is a format selector with **JSON**, **Markdown**, and **CSV**. The second step defines scope and metadata. The final step previews the result and creates a downloadable receipt.

| Export option | Default | Purpose |
|---|---|---|
| Format | Markdown | Human-readable career notes. |
| Date range | All time | Limit to sources first captured or last seen in a selected range. |
| Include evidence | On | Include exact excerpts and action types. |
| Include context | On | Include role, company, skill, application, and practice links. |
| Include provenance | On | Include origin, sync status, first captured, last seen, attempts, and errors. |
| Include thread context | On when available | Preserve reply counts and captured top-comment context. |
| Active brief context | Optional | Add role/company/skill metadata and coverage summary. |

The preview must show the number of sources, evidence cards, context links, and excluded records before download. Every completed export creates a history entry with format, filter summary, record count, generated time, and a download action. If a format cannot represent a field, the preview explains how it is encoded rather than silently dropping it. Markdown may use optional YAML front matter for role, company, skill, capture origin, and timestamps; CSV should use stable column names; JSON should include a versioned schema identifier.

## 9. First-run onboarding and consent

New users see a non-blocking onboarding card before the first automatic-capture toggle. The card uses a three-part explanation: **What OmniSaveAI reads:** visible links and supported metadata from explicitly supported saved-content pages; **What it never reads:** passwords, private messages, arbitrary tabs, unrelated pages, or hidden server-side saved lists; **What the user controls:** supported platforms, interval, pause, deletion, and export.

The user must be able to continue with manual URL import without enabling automatic capture. Consent is recorded with the selected platforms and timestamp so settings can be audited. Changing scope later should show a short inline confirmation, not a full onboarding repeat.

## 10. Resilient states

All panels must have explicit empty, loading, offline, and migration-required states. These states should preserve the user’s next action and avoid layout shifts. Skeletons should match the final card geometry. Errors should be concise in the panel with a detailed expandable receipt when necessary.

| State | Sync panel | Seed importer | Interview Brief | Export |
|---|---|---|---|---|
| Empty | “Automatic capture is paused” with enable and manual-sync actions. | Drop a CSV or choose a file. | Choose a role or company to build a brief. | “No export history yet.” |
| Loading | Pulsing status dot and disabled controls. | File parsing or hydration progress. | Context resolution and evidence loading. | Preparing preview or bundle. |
| Offline | “Browser companion unavailable; URL import still works.” | Preserve local preview; retry upload. | Show cached last brief and retry. | Allow export of cached library when safe. |
| Migration required | Explain which database capability is missing and provide deployment handoff label. | Disable job creation while retaining file guidance. | Explain that provenance or context data is not yet available. | Allow only formats supported by the current schema, with warning. |
| Partial | Imported/skipped/failed counters and retry. | Partial hydration receipt. | Coverage warning with missing evidence. | Preview excluded or unavailable records. |

## 11. Motion, typography, and accessibility

The redesign must preserve the current typography, color tokens, and motion primitives. Use `FadeIn` for page-level arrival, `SlideUp` for independent panels, and `StaggerContainer` for source cards. New status changes should use a short opacity and color transition rather than a full reflow. Progress bars may animate width, but numeric counters should update without bouncing the surrounding layout. Avoid indefinite shimmer on offline or error states.

Interactive controls require visible focus rings, keyboard-operable platform selectors, labels for every form field, and status announcements for sync completion, failure, and export readiness. Color must not be the only status signal; pair badges with text and icons. Dialogs must preserve focus, support Escape to close, and expose the same controls on small screens through a single-column layout.

## 12. Data and API expectations

The frontend should consume typed models rather than infer status from nullable fields. The sync settings response should include `enabled`, `platforms`, `interval_minutes`, `last_status`, `last_completed_at`, `last_error`, and companion availability. Source objects should expose provenance, freshness, thread context, and retry information. Export requests should accept format, date range, include flags, and active brief context, and should return a receipt with stable identifiers.

The read-only agent surface remains limited to library search and brief retrieval. External integrations should begin as explicit read-only connectors. Any future write, posting, application submission, scheduling, or third-party mutation must use a separate confirmation flow and must not be implied by the export UI.

## 13. P0 and rollout mapping

| Priority | Work item | UI consequence | Validation owner |
|---|---|---|---|
| P0 | Apply six migrations and validate RLS. | Enable provenance, evidence, context, sync, seed, and Instagram states. | Deployment/operator. |
| P0 | Verify real-browser automatic capture. | Confirm scope, alarm interval, pause, retry, duplicate suppression, and blocked-item visibility. | User with authenticated browser. |
| P0 | Validate full-history seed import. | Confirm preview, deduplication, bounded batches, retries, and `seed_csv` provenance. | User with representative CSV. |
| P1 | Finish career-intelligence loop. | Add board suggestions, direct preparation actions, freshness, and evidence gaps. | Product/frontend/backend. |
| P1 | Improve portability. | Add export history, front matter, schema validation, and import preview. | Product/frontend/backend. |
| P2 | Product polish and observability. | Add onboarding, platform health rows, activity timeline, and resilient states. | Frontend/backend. |

## 14. LinkedMash-inspired decisions and boundaries

The redesign adopts LinkedMash’s strongest workflow ideas: full-history seeding, always-on new-save synchronization, comments or thread context when visible, rediscovery through “what’s new” briefs, and portable exports. These ideas are adapted to OmniSaveAI’s stronger multi-platform and career-context model rather than copied as a generic creator workflow.

OmniSaveAI must preserve a narrower and safer boundary. Capture is consented, browser-session based, limited to visible content on supported pages, and never presented as an official private saved-post API. Thread context is stored only when visible during supported capture. External app sync begins as read-only export or connector behavior. Agent routes remain read-only and scoped. The product must not silently publish, schedule, submit applications, or read unrelated private content.

## 15. Definition of done

The redesign is ready when a new user can understand consent and enable one platform in under one minute; a returning user can see last-success, pending, and blocked status without opening a secondary page; a seed import can be previewed and resumed after refresh; every source card identifies origin and freshness; an Interview Brief explains what is new and what evidence is missing; JSON, Markdown, and CSV exports share the same filters and provenance guarantees; and all empty, loading, offline, partial, and migration-required states are explicit and accessible.

The existing P0 deployment caveat remains: code-level UI readiness does not mean the six database migrations have been applied. The release checklist must therefore separate **implementation complete** from **environment validated** and must not mark the automatic-capture or seed-import P0 items complete until real-browser and disposable-database checks have passed.
