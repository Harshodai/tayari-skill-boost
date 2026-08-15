CREATE TABLE IF NOT EXISTS public.omnisave_source_provenance (
    source_id UUID PRIMARY KEY REFERENCES public.saved_sources(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    capture_origin TEXT NOT NULL DEFAULT 'url_import' CHECK (capture_origin IN ('url_import', 'browser_capture', 'seed_csv', 'manual')),
    content_hash VARCHAR(64),
    sync_status TEXT NOT NULL DEFAULT 'captured' CHECK (sync_status IN ('captured', 'hydrated', 'unchanged', 'blocked', 'failed')),
    first_captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_attempt_at TIMESTAMPTZ,
    attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count >= 0),
    last_error TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_omnisave_provenance_user_seen
    ON public.omnisave_source_provenance(user_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_omnisave_provenance_status
    ON public.omnisave_source_provenance(user_id, sync_status, updated_at DESC);

ALTER TABLE public.omnisave_source_provenance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS omnisave_source_provenance_owner ON public.omnisave_source_provenance;
CREATE POLICY omnisave_source_provenance_owner ON public.omnisave_source_provenance
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.omnisave_source_provenance TO authenticated;
