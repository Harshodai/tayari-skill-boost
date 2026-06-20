-- ==========================================
-- MVP Additions: Profile columns, Saved Jobs, Auto-Pilot, Applications, Schedules
-- ==========================================

-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ...
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS headline TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS desired_roles TEXT[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS locations TEXT[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS experience_years FLOAT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS open_to_remote BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS links JSONB DEFAULT '{}';

-- ==========================================
-- Saved Jobs
-- ==========================================
CREATE TABLE IF NOT EXISTS public.saved_jobs (
    id          SERIAL PRIMARY KEY,
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    dedupe_key  TEXT NOT NULL,
    job         JSONB NOT NULL DEFAULT '{}',
    status      TEXT NOT NULL DEFAULT 'saved',
    saved_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_saved_jobs_user_id ON public.saved_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_jobs_status ON public.saved_jobs(status);

-- ==========================================
-- Auto-Pilot Runs
-- ==========================================
CREATE TABLE IF NOT EXISTS public.autopilot_runs (
    id                  SERIAL PRIMARY KEY,
    run_id              uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    config              JSONB NOT NULL DEFAULT '{}',
    status              TEXT NOT NULL DEFAULT 'pending',
    progress            INTEGER DEFAULT 0,
    current_step        TEXT,
    logs                JSONB DEFAULT '[]',
    applications_created INTEGER DEFAULT 0,
    error               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autopilot_runs_user_id ON public.autopilot_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_autopilot_runs_run_id ON public.autopilot_runs(run_id);

-- ==========================================
-- Applications (Kanban / Auto-Pilot)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.applications (
    id                   SERIAL PRIMARY KEY,
    application_id       uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    run_id               uuid REFERENCES public.autopilot_runs(run_id) ON DELETE SET NULL,
    job                  JSONB NOT NULL DEFAULT '{}',
    tailored_resume_text TEXT,
    cover_letter         TEXT,
    changes              JSONB DEFAULT '{}',
    keywords_added       JSONB DEFAULT '[]',
    ats_score_before     INTEGER DEFAULT 0,
    ats_score_after      INTEGER DEFAULT 0,
    is_dream_company     BOOLEAN DEFAULT false,
    status               TEXT NOT NULL DEFAULT 'saved',
    submission_mode      TEXT,
    apply_url            TEXT,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_applications_user_id ON public.applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_run_id ON public.applications(run_id);

-- ==========================================
-- Auto-Pilot Schedules
-- ==========================================
CREATE TABLE IF NOT EXISTS public.autopilot_schedules (
    id          SERIAL PRIMARY KEY,
    schedule_id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    frequency   TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly')),
    config      JSONB NOT NULL DEFAULT '{}',
    active      BOOLEAN DEFAULT true,
    next_run_at TIMESTAMPTZ,
    last_run_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autopilot_schedules_user_id ON public.autopilot_schedules(user_id);

-- Triggers
CREATE TRIGGER on_profiles_update
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
