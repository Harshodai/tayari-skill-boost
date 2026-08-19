-- OmniSaveAI resumable browser capture runs.
-- This is separate from legacy sync runs so existing API consumers keep their contract.

CREATE TABLE IF NOT EXISTS public.omnisave_capture_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform VARCHAR(32) NOT NULL CHECK (platform IN ('linkedin', 'medium', 'substack', 'instagram')),
    source_page_url TEXT NOT NULL,
    trigger_type VARCHAR(24) NOT NULL CHECK (trigger_type IN ('manual', 'automatic', 'extension')),
    status VARCHAR(24) NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'partial', 'completed', 'cancel_requested', 'cancelled', 'blocked', 'failed')),
    consent_acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    requested_limit INTEGER NOT NULL DEFAULT 250 CHECK (requested_limit BETWEEN 1 AND 5000),
    page_cursor TEXT,
    page_count INTEGER NOT NULL DEFAULT 0 CHECK (page_count >= 0),
    discovered_count INTEGER NOT NULL DEFAULT 0 CHECK (discovered_count >= 0),
    imported_count INTEGER NOT NULL DEFAULT 0 CHECK (imported_count >= 0),
    skipped_count INTEGER NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
    failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
    checkpoint JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_error TEXT,
    cancel_requested_at TIMESTAMPTZ,
    heartbeat_at TIMESTAMPTZ,
    lease_until TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.omnisave_capture_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES public.omnisave_capture_runs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_key VARCHAR(128) NOT NULL,
    source_url TEXT NOT NULL,
    source_platform VARCHAR(32) NOT NULL CHECK (source_platform IN ('linkedin', 'medium', 'substack', 'instagram')),
    ordinal INTEGER NOT NULL DEFAULT 0 CHECK (ordinal >= 0),
    title TEXT,
    author TEXT,
    content TEXT,
    media JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(24) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'imported', 'skipped', 'blocked', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    source_id UUID,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (run_id, source_key),
    UNIQUE (run_id, source_url)
);

CREATE INDEX IF NOT EXISTS idx_omnisave_capture_runs_owner_created
    ON public.omnisave_capture_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_omnisave_capture_runs_owner_status
    ON public.omnisave_capture_runs(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_omnisave_capture_items_run_status
    ON public.omnisave_capture_items(run_id, status, ordinal);
CREATE INDEX IF NOT EXISTS idx_omnisave_capture_items_owner_url
    ON public.omnisave_capture_items(user_id, source_url);

ALTER TABLE public.omnisave_capture_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnisave_capture_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS omnisave_capture_runs_owner ON public.omnisave_capture_runs;
CREATE POLICY omnisave_capture_runs_owner ON public.omnisave_capture_runs
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS omnisave_capture_items_owner ON public.omnisave_capture_items;
CREATE POLICY omnisave_capture_items_owner ON public.omnisave_capture_items
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.omnisave_capture_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.omnisave_capture_items TO authenticated;
