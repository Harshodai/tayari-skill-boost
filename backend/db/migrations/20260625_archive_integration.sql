-- ============================================================
-- Archive Integration Migration (2026-06-25)
-- Adds: saved_posts, gmail_tokens, oauth_states,
--       + JSONB columns on applications for notes/voice/interview-research
-- ============================================================

-- -------------------------------------------------------
-- 1. Knowledge Hub (Omni-Save)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_posts (
    id                  uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    url                 TEXT NOT NULL,
    note                TEXT DEFAULT '',
    source              TEXT DEFAULT 'other',
    title               TEXT DEFAULT '',
    summary             TEXT DEFAULT '',
    tags                JSONB DEFAULT '[]',
    category            TEXT DEFAULT 'other',
    is_interview_related BOOLEAN DEFAULT false,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_posts_user_id  ON public.saved_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_posts_category ON public.saved_posts(category);

-- -------------------------------------------------------
-- 2. Application extras (JSONB columns on applications)
-- -------------------------------------------------------
ALTER TABLE public.applications
    ADD COLUMN IF NOT EXISTS notes_log          JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS voice_notes        JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS interview_research JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS cover_letter_data  JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS stage              TEXT DEFAULT 'saved',
    ADD COLUMN IF NOT EXISTS title              TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS company            TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS location           TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS job_url            TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS notes              TEXT DEFAULT '';

-- -------------------------------------------------------
-- 3. Gmail OAuth tokens
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gmail_tokens (
    id            uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    access_token  TEXT NOT NULL,
    refresh_token TEXT NOT NULL DEFAULT '',
    expiry        TIMESTAMPTZ,
    scope         TEXT DEFAULT '',
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------
-- 4. OAuth state nonces (CSRF protection for OAuth flows)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.oauth_states (
    id         uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    state      TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON public.oauth_states(state);

-- Auto-expire oauth states after 10 minutes (cleaned up by application)
-- -------------------------------------------------------
-- 5. Voice note files storage record
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.voice_note_files (
    id             uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    application_id uuid,
    file_path      TEXT NOT NULL,
    content_type   TEXT DEFAULT 'audio/webm',
    transcript     TEXT DEFAULT '',
    duration_secs  FLOAT DEFAULT 0,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_note_files_user_id ON public.voice_note_files(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_note_files_app_id  ON public.voice_note_files(application_id);

-- -------------------------------------------------------
-- Triggers
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_saved_posts_update   ON public.saved_posts;
CREATE TRIGGER on_saved_posts_update
    BEFORE UPDATE ON public.saved_posts
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_gmail_tokens_update  ON public.gmail_tokens;
CREATE TRIGGER on_gmail_tokens_update
    BEFORE UPDATE ON public.gmail_tokens
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -------------------------------------------------------
-- 6. Hermes Sessions
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hermes_sessions (
    id         uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    goal       TEXT NOT NULL,
    kind       TEXT NOT NULL DEFAULT 'job_search',
    status     TEXT NOT NULL DEFAULT 'running',
    events     JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hermes_sessions_user_id ON public.hermes_sessions(user_id);

DROP TRIGGER IF EXISTS on_hermes_sessions_update ON public.hermes_sessions;
CREATE TRIGGER on_hermes_sessions_update
    BEFORE UPDATE ON public.hermes_sessions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

