-- Governed Google Workspace integration: Calendar and Drive, read-only first release.
-- Gmail remains backward compatible and reuses oauth_states with provider='gmail'.

ALTER TABLE public.oauth_states
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'gmail';

CREATE INDEX IF NOT EXISTS idx_oauth_states_provider_tenant
    ON public.oauth_states(provider, tenant_id, created_at);

ALTER TABLE public.gmail_tokens
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.gmail_tokens
    DROP CONSTRAINT IF EXISTS gmail_tokens_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gmail_tokens_user_tenant
    ON public.gmail_tokens(user_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_gmail_tokens_owner
    ON public.gmail_tokens(tenant_id, user_id);

ALTER TABLE public.gmail_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_tokens FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.gmail_tokens FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.gmail_tokens TO service_role;
DROP POLICY IF EXISTS gmail_tokens_deny_all ON public.gmail_tokens;
CREATE POLICY gmail_tokens_deny_all ON public.gmail_tokens
    FOR ALL TO public USING (false) WITH CHECK (false);

ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_states FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.oauth_states FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.oauth_states TO service_role;
DROP POLICY IF EXISTS oauth_states_deny_all ON public.oauth_states;
CREATE POLICY oauth_states_deny_all ON public.oauth_states
    FOR ALL TO public USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.google_calendar_tokens (
    id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id     UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    access_token  TEXT NOT NULL,
    refresh_token TEXT NOT NULL DEFAULT '',
    expiry        TIMESTAMPTZ,
    scope         TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_google_calendar_tokens_owner
    ON public.google_calendar_tokens(tenant_id, user_id);

CREATE TABLE IF NOT EXISTS public.google_calendar_events (
    id                UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id         UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    provider_event_id TEXT NOT NULL,
    calendar_id       TEXT NOT NULL DEFAULT 'primary',
    summary           TEXT NOT NULL DEFAULT '',
    description       TEXT NOT NULL DEFAULT '',
    start_time        TIMESTAMPTZ,
    html_link         TEXT NOT NULL DEFAULT '',
    provenance        TEXT NOT NULL DEFAULT 'google_calendar_readonly',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, tenant_id, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_google_calendar_events_owner
    ON public.google_calendar_events(tenant_id, user_id, start_time);

CREATE TABLE IF NOT EXISTS public.google_drive_files (
    id                UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id         UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    provider_file_id  TEXT NOT NULL,
    name              TEXT NOT NULL DEFAULT '',
    mime_type         TEXT NOT NULL DEFAULT '',
    modified_time     TIMESTAMPTZ,
    web_view_link     TEXT NOT NULL DEFAULT '',
    provenance        TEXT NOT NULL DEFAULT 'google_drive_readonly',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, tenant_id, provider_file_id)
);

CREATE INDEX IF NOT EXISTS idx_google_drive_files_owner
    ON public.google_drive_files(tenant_id, user_id, modified_time DESC);

CREATE TABLE IF NOT EXISTS public.google_drive_tokens (
    id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id     UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    access_token  TEXT NOT NULL,
    refresh_token TEXT NOT NULL DEFAULT '',
    expiry        TIMESTAMPTZ,
    scope         TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_google_drive_tokens_owner
    ON public.google_drive_tokens(tenant_id, user_id);

-- OAuth bearer tokens are service-only secrets. The Go gateway uses its
-- server-side database connection; direct client roles receive no access.
ALTER TABLE public.google_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_calendar_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_calendar_events FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.google_calendar_events TO service_role;
DROP POLICY IF EXISTS google_calendar_events_deny_all ON public.google_calendar_events;
CREATE POLICY google_calendar_events_deny_all ON public.google_calendar_events
    FOR ALL TO public USING (false) WITH CHECK (false);

ALTER TABLE public.google_drive_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_drive_files FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_drive_files FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.google_drive_files TO service_role;
DROP POLICY IF EXISTS google_drive_files_deny_all ON public.google_drive_files;
CREATE POLICY google_drive_files_deny_all ON public.google_drive_files
    FOR ALL TO public USING (false) WITH CHECK (false);

ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_calendar_tokens FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_calendar_tokens FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.google_calendar_tokens TO service_role;
DROP POLICY IF EXISTS google_calendar_tokens_deny_all ON public.google_calendar_tokens;
CREATE POLICY google_calendar_tokens_deny_all ON public.google_calendar_tokens
    FOR ALL TO public USING (false) WITH CHECK (false);

ALTER TABLE public.google_drive_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_drive_tokens FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_drive_tokens FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.google_drive_tokens TO service_role;
DROP POLICY IF EXISTS google_drive_tokens_deny_all ON public.google_drive_tokens;
CREATE POLICY google_drive_tokens_deny_all ON public.google_drive_tokens
    FOR ALL TO public USING (false) WITH CHECK (false);

DROP TRIGGER IF EXISTS on_google_calendar_events_update ON public.google_calendar_events;
CREATE TRIGGER on_google_calendar_events_update
    BEFORE UPDATE ON public.google_calendar_events
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_google_drive_files_update ON public.google_drive_files;
CREATE TRIGGER on_google_drive_files_update
    BEFORE UPDATE ON public.google_drive_files
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_google_calendar_tokens_update ON public.google_calendar_tokens;
CREATE TRIGGER on_google_calendar_tokens_update
    BEFORE UPDATE ON public.google_calendar_tokens
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_google_drive_tokens_update ON public.google_drive_tokens;
CREATE TRIGGER on_google_drive_tokens_update
    BEFORE UPDATE ON public.google_drive_tokens
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
