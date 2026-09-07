# E2E ACCEPTANCE MATRIX — 2026-09-07

Status vocabulary: VERIFIED / PASS / FAIL / BLOCKED / NOT IMPLEMENTED / NOT ADVERTISED / UNKNOWN.
UNKNOWN is never promoted to PASS.

| Feature | UI | API | DB | Async | External | E2E | Security | Performance | Evidence | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| Public marketing pages (`/`, `/pricing`, `/about`, `/blog`, `/privacy`, `/terms`) | PASS | n/a | n/a | n/a | n/a | PASS | PASS | ~4s cold dev load | LIVE_TEST_RESULTS | PASS |
| Email/password auth | PASS | Cloud auth | PASS | n/a | Supabase | UNKNOWN (no signed-in run) | PASS (gating verified) | UNKNOWN | route sweep | CONDITIONAL |
| Google sign-in | PASS (button renders) | Cloud auth | n/a | n/a | Google OAuth | UNKNOWN | UNKNOWN | UNKNOWN | provider enabled | UNKNOWN |
| Protected-route gating | PASS | n/a | n/a | n/a | n/a | PASS | PASS | n/a | 5 routes → `/auth` | PASS |
| Credits / checkout pages | PASS | Go billing (absent here) | tables exist | n/a | Stripe | BLOCKED | UNKNOWN | n/a | route sweep | BLOCKED |
| Credit debit on verified receipt | UNKNOWN | Go `agent-runs/transition` | `submission_receipts` | UNKNOWN | n/a | BLOCKED | UNKNOWN | UNKNOWN | code only | BLOCKED |
| Job search / saved jobs | PASS (renders) | 500 from absent gateway | `saved_jobs` RLS OK | n/a | scrapers | BLOCKED | PASS (static) | n/a | LIVE_TEST_RESULTS | BLOCKED |
| Pipeline Kanban | UNKNOWN | Supabase direct | `saved_jobs` | n/a | n/a | UNKNOWN | PASS (static) | UNKNOWN | code only | UNKNOWN |
| Resume optimize | UI PASS | Python engine absent | — | — | LLM | BLOCKED | UNKNOWN | UNKNOWN | route sweep | BLOCKED |
| Cover letter | UI gated | Go route exists | — | — | LLM | BLOCKED | UNKNOWN | UNKNOWN | route parity audit | BLOCKED |
| Apply Agent (edge function) | preview-only flag | edge fn owner-scoped | `agent_runs` | n/a | Lovable AI | UNKNOWN | PASS (static owner checks) | UNKNOWN | code audit | UNKNOWN |
| Push send | n/a | Go | `push_subscriptions` | n/a | n/a | BLOCKED | **FIXED** (was IDOR) | n/a | FAILURES_AND_FIXES F1 | CONDITIONAL |
| Contact form | PASS | Supabase insert | `contact_messages` | n/a | n/a | UNKNOWN | PASS (admin read added) | n/a | security scan | PASS |
| Celery / Redis async | n/a | n/a | n/a | BLOCKED | n/a | BLOCKED | UNKNOWN | UNKNOWN | not running here | BLOCKED |
| Browser automation / HITL boundary | n/a | Python | — | BLOCKED | Playwright | BLOCKED | UNKNOWN | UNKNOWN | not running here | BLOCKED |
| Docker clean start | n/a | n/a | n/a | n/a | n/a | BLOCKED | UNKNOWN | UNKNOWN | no Docker in this env | BLOCKED |
| Cloud security posture | n/a | n/a | PASS | n/a | n/a | n/a | PASS (0 critical/high) | n/a | scan 2026-09-07 | PASS |
