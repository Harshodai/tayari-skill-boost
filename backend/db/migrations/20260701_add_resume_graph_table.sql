-- Migration: add resume_graphs table
-- Added 2026-07-01

CREATE TABLE IF NOT EXISTS public.resume_graphs (
    run_id UUID PRIMARY KEY,
    graph JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS is enabled for defense-in-depth consistency with the other init files,
-- with no policies: resume_graphs has no user_id column (rows are keyed only
-- by run_id, generated server-side), and every accessor — the Python AI
-- engine's resume_graph_storage.py via the shared asyncpg pool
-- (app/services/db.py) — connects as the postgres superuser, which bypasses
-- RLS. No PostgREST/anon path reads this table, so there is no owner identity
-- to scope a policy to.
ALTER TABLE public.resume_graphs ENABLE ROW LEVEL SECURITY;

-- Trigger to update updated_at on row modification. Uses the shared
-- public.handle_updated_at convention (defined in 20260625_archive_integration.sql,
-- which runs before this file) instead of a private trigger_set_updated_at().
DROP TRIGGER IF EXISTS set_updated_at ON public.resume_graphs;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.resume_graphs
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
