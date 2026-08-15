# OmniSaveAI LinkedMash-Inspired Implementation Handoff

**Author:** Manus AI
**Status:** Code changes implemented and verified; deployment validation remains pending.

## Executive summary

OmniSaveAI now has a documented automatic-sync and export experience, a reusable SimilarWeb benchmark puller, and a second round of LinkedMash-inspired workflow improvements. The implementation preserves OmniSaveAI’s safer product boundary: capture is consented and browser-session based, content is limited to visible cards on explicitly supported pages, and external or agent-facing surfaces remain read-only unless a separate confirmation flow is introduced.

The redesign specification is in [`OMNISAVE_UI_SPEC.md`](./OMNISAVE_UI_SPEC.md). The remaining P0 database and real-browser checks are intentionally still open because they require access to the target PostgreSQL/Supabase environment and the user’s authenticated browser session.

## LinkedMash workflow analysis

The strongest LinkedMash patterns are not the product’s publishing features; they are the capture and rediscovery loop. LinkedMash treats saving as the beginning of a durable library workflow: it supports full-history seeding, continuously syncs new saves, captures visible comments or thread context, provides rediscovery through digests and an assistant, and keeps the library portable through external exports. Its public product material also emphasizes a browser-session workaround because LinkedIn does not expose an official saved-posts API.

OmniSaveAI adopts the workflow patterns that improve a candidate’s research loop while declining patterns that would broaden platform risk or career-action scope. The product keeps multi-platform ingestion, NLP enrichment, evidence cards, career-context links, grounded Q&A, and interview reuse as its differentiators. It does not claim server-side access to private saved lists, does not read arbitrary tabs or private messages, and does not publish, schedule, submit applications, or mutate external systems through the read-only agent surface.

| LinkedMash practice | OmniSaveAI adaptation | Boundary preserved |
|---|---|---|
| Full-history saved-library seed | Resumable LinkedIn CSV import with local preview, URL deduplication, bounded hydration, and retryable failures. | A CSV contains links and dates; it does not grant access to blocked page content. |
| Always-on new-save sync | Consent-based browser companion with platform selection, interval, pause, run receipts, and duplicate suppression. | Only visible content on supported saved-content pages is captured. |
| Comment/thread capture | `thread_context` stores visible reply counts and up to three visible comment excerpts alongside captured source metadata. | No hidden comments, private conversations, or server-side enumeration. |
| Rediscovery digests | Interview Brief exposes `new_since_last_brief` so recent sources become preparation actions. | Rediscovery remains tied to the candidate’s own library and selected context. |
| External portability | JSON, Markdown, and CSV exports retain provenance, freshness, and thread metadata. | External connections begin as read-only export or connector behavior. |
| Agent access | Existing read-only library and brief routes remain; activity is owner-scoped and read-only. | Mutation actions and posting capabilities remain excluded. |

## Implemented changes

The browser collector now records bounded `thread_context` for each visible saved card. The backend validates and stores that context in the existing NLP metadata JSONB, exposes it in source listings, and includes it in export bundles. Source listings and exports also expose an explainable `freshness_score` derived from `last_seen_at` or `created_at`, sync status, and source age.

The gateway and Python API now expose `GET /api/v1/saves/activity`, returning owner-scoped capture, evidence creation, context-link, and sync-run events. It is intentionally read-only. Export history is still a separate portability follow-up because durable export-event storage would require a new migration and should not be represented as complete until that schema is deployed.

The automatic-capture panel now shows platform-level health derived from the candidate’s loaded library: last seen capture time, pending records, and the latest source error. The Interview Brief now includes a “What’s new since last brief” section so a candidate can rediscover recent sources before reviewing next actions and evidence cards.

## SimilarWeb benchmark puller

The reusable collector is available at [`tools/omnisave_benchmark_puller.py`](./tools/omnisave_benchmark_puller.py) and also at `/home/ubuntu/omnisave_benchmark_puller.py` in the working environment. It covers eight domains and all seven supported metric families: global rank, total visits, unique visits, bounce rate, desktop traffic sources, mobile traffic sources, and traffic by country.

The collector saves an atomic JSON receipt after every API call, keeps an append-only run summary, retries non-success records on later runs, and provides `--force` and `--render-only` modes. It produces a dark, readable availability matrix and a Markdown report instead of presenting raw JSON as the primary deliverable.

The completed run returned **56 unavailable metrics, 0 successful numeric metrics, and 0 call errors**. SimilarWeb’s unavailable responses are preserved as explicit receipts; no traffic, ranking, engagement, source, or geography values have been estimated. The visual artifact is [`omnisave_benchmark_chart.png`](./omnisave_benchmark_chart.png), and the report is [`omnisave_benchmark_report.md`](./omnisave_benchmark_report.md). The raw receipt remains a supporting artifact only.

## Verification

The frontend production build, TypeScript compiler, touched-file ESLint checks, focused Python tests, Go gateway tests, Python compilation, extension syntax checks, and `git diff --check` pass after the final repair. The focused backend run reports **10 passed and 1 skipped**; the existing PyPDF2, Pydantic V1-style, and FastAPI `regex` deprecation warnings remain unrelated to this change.

## Remaining P0 actions

The six database migrations still need to be applied to the target PostgreSQL/Supabase environment and checked with a disposable-database smoke test. The browser extension must be reloaded in an authenticated browser and exercised against LinkedIn saved posts, Medium reading list, Substack supported feeds, and Instagram saved activity. The real-browser checklist should confirm consent defaults, visible-card scope, pause/resume behavior, duplicate suppression, blocked-item visibility, and resumable seed import.

These actions are deployment and environment validations, not reasons to weaken the code-level privacy boundary. Until they are complete, the release state should be described as **implementation verified; environment validation pending**.
