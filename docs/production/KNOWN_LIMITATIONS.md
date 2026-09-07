# KNOWN LIMITATIONS — 2026-09-07

1. **The hosted app runs frontend + Lovable Cloud only.** The Go gateway (`:8085`) and Python AI engine (`:8002`) are not deployed there. Every feature routed through `apiFetch` fails with a backend-unavailable error in the hosted environment: resume optimization, cover letter, interview generation, job search results, autopilot, agent runs, billing checkout via Go, Omnisave, computer/desktop control.
2. **Degradation is not uniform.** `src/api/client.ts` correctly raises `BackendUnavailableError`, but `useBackendHealth` and `BackendUnavailableBanner` are imported by no page. Each page handles the failure ad hoc, so messaging quality varies.
3. **Two frontend API paths have no matching Go route** (`/v1/communications/{id}/response`, `/v1/saves/{id}/highlights/{id}`) and are presumed dead calls.
4. **Feature flags are partially decorative.** Eight flags in `src/config/features.ts` are never read in `src/App.tsx`; their routes mount regardless of the flag.
5. **No authenticated end-to-end run was performed this cycle.** Data-persistence correctness for resume, pipeline, cover letter, and credits is UNKNOWN, not proven.
6. **Async, browser automation, LLM provider fallback, failure injection, latency budgets, and Docker clean start were not exercised.** Prior evidence in `.ruthless-evidence/productionization/` predates this cycle and was not re-validated.
7. **Backend tenant isolation has no database backstop.** `DATABASE_URL` connects as `postgres` (BYPASSRLS); RLS only protects direct PostgREST/Supabase-JS access. Every Go/Python query's `WHERE user_id = $n` is the only isolation control on that path.
8. **Console warnings** ("Function components cannot be given refs") appear on every page and mask real errors.
