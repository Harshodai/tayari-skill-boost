-- Self-hosted mirror of backend/db/migrations/20260823_01_external_research_runs.sql.
CREATE TABLE IF NOT EXISTS public.external_research_runs (
    job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID,
    subject TEXT NOT NULL,
    request_id TEXT,
    idempotency_key TEXT NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('apify')),
    query TEXT NOT NULL CHECK (char_length(query) BETWEEN 2 AND 500),
    requested_limit INTEGER NOT NULL CHECK (requested_limit BETWEEN 1 AND 20),
    actor_id TEXT NOT NULL,
    provider_run_id TEXT,
    dataset_id TEXT,
    status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted','running','succeeded','failed','aborted','timed_out','cancelled','expired')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    result JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_count INTEGER NOT NULL DEFAULT 0,
    truncated BOOLEAN NOT NULL DEFAULT FALSE,
    error_code TEXT,
    error_message TEXT,
    celery_task_id TEXT,
    lease_owner TEXT,
    lease_expires_at TIMESTAMPTZ,
    last_heartbeat_at TIMESTAMPTZ,
    reclaim_count INTEGER NOT NULL DEFAULT 0,
    retry_count INTEGER NOT NULL DEFAULT 0,
    deadline_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_external_research_runs_owner ON public.external_research_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_research_runs_status ON public.external_research_runs(status, lease_expires_at);
CREATE INDEX IF NOT EXISTS idx_external_research_runs_provider ON public.external_research_runs(provider, provider_run_id);
ALTER TABLE public.external_research_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_research_runs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.external_research_runs FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.external_research_runs FROM authenticated;
GRANT SELECT ON TABLE public.external_research_runs TO authenticated;
GRANT ALL ON TABLE public.external_research_runs TO service_role;
DROP POLICY IF EXISTS external_research_runs_owner_select ON public.external_research_runs;
CREATE POLICY external_research_runs_owner_select ON public.external_research_runs FOR SELECT TO authenticated USING (auth.uid() = user_id);
