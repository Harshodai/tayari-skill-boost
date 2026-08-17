-- Migration: scope resume_graphs to an owner
-- Added 2026-08-17
--
-- resume_graphs previously had no owner column, so the AI engine's
-- /v1/resume-graph routes could read, overwrite, export, or delete any run's
-- parsed resume data given only a guessed run_id. Add user_id so every read
-- and write can carry an owner predicate.

ALTER TABLE public.resume_graphs
    ADD COLUMN IF NOT EXISTS user_id UUID;

CREATE INDEX IF NOT EXISTS idx_resume_graphs_user_id
    ON public.resume_graphs (user_id);

-- RLS stays enabled with no policies: the table is only reached by the Python
-- AI engine through the superuser asyncpg pool, which now always filters by
-- user_id in the query itself. No PostgREST/anon path exists.
ALTER TABLE public.resume_graphs ENABLE ROW LEVEL SECURITY;
