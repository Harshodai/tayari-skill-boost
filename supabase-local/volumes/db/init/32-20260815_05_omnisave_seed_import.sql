CREATE TABLE IF NOT EXISTS public.omnisave_seed_import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL DEFAULT 'saved-items.csv',
    source_platform TEXT NOT NULL DEFAULT 'linkedin',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'partial', 'failed')),
    total_count INTEGER NOT NULL DEFAULT 0 CHECK (total_count >= 0),
    hydrated_count INTEGER NOT NULL DEFAULT 0 CHECK (hydrated_count >= 0),
    imported_count INTEGER NOT NULL DEFAULT 0 CHECK (imported_count >= 0),
    skipped_count INTEGER NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
    failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
    next_cursor INTEGER NOT NULL DEFAULT 0 CHECK (next_cursor >= 0),
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    UNIQUE (id, user_id)
);

CREATE TABLE IF NOT EXISTS public.omnisave_seed_import_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_url TEXT NOT NULL,
    source_platform TEXT NOT NULL DEFAULT 'linkedin',
    saved_at TIMESTAMPTZ,
    title TEXT,
    author TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'imported', 'skipped', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    source_id UUID,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (job_id, source_url),
    FOREIGN KEY (job_id, user_id) REFERENCES public.omnisave_seed_import_jobs(id, user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_omnisave_seed_jobs_user_created
    ON public.omnisave_seed_import_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_omnisave_seed_items_job_status
    ON public.omnisave_seed_import_items(job_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_omnisave_seed_items_user_url
    ON public.omnisave_seed_import_items(user_id, source_url);

ALTER TABLE public.omnisave_seed_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnisave_seed_import_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS omnisave_seed_jobs_owner ON public.omnisave_seed_import_jobs;
CREATE POLICY omnisave_seed_jobs_owner ON public.omnisave_seed_import_jobs
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS omnisave_seed_items_owner ON public.omnisave_seed_import_items;
CREATE POLICY omnisave_seed_items_owner ON public.omnisave_seed_import_items
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.omnisave_seed_import_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.omnisave_seed_import_items TO authenticated;
