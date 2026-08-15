-- OmniSaveAI automatic capture controls and durable sync run history.
-- Automatic capture is disabled by default and can only be enabled by the owner.

CREATE TABLE IF NOT EXISTS public.omnisave_sync_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    platforms TEXT[] NOT NULL DEFAULT ARRAY['linkedin', 'medium', 'substack', 'instagram']::TEXT[],
    interval_minutes INT NOT NULL DEFAULT 60 CHECK (interval_minutes BETWEEN 5 AND 1440),
    last_started_at TIMESTAMPTZ,
    last_completed_at TIMESTAMPTZ,
    last_status VARCHAR(24) NOT NULL DEFAULT 'never'
        CHECK (last_status IN ('never', 'running', 'completed', 'partial', 'failed', 'paused')),
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.omnisave_sync_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    trigger_type VARCHAR(24) NOT NULL
        CHECK (trigger_type IN ('manual', 'automatic', 'import', 'extension')),
    status VARCHAR(24) NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'completed', 'partial', 'failed')),
    requested_count INT NOT NULL DEFAULT 0 CHECK (requested_count >= 0),
    imported_count INT NOT NULL DEFAULT 0 CHECK (imported_count >= 0),
    skipped_count INT NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
    failed_count INT NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
    errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_omnisave_sync_runs_owner_started
    ON public.omnisave_sync_runs (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_omnisave_sync_runs_owner_status
    ON public.omnisave_sync_runs (user_id, status, started_at DESC);

ALTER TABLE public.omnisave_sync_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnisave_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS omnisave_sync_settings_owner ON public.omnisave_sync_settings;
CREATE POLICY omnisave_sync_settings_owner ON public.omnisave_sync_settings
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS omnisave_sync_runs_owner ON public.omnisave_sync_runs;
CREATE POLICY omnisave_sync_runs_owner ON public.omnisave_sync_runs
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.omnisave_sync_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.omnisave_sync_runs TO authenticated;
