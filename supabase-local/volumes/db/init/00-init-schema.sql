-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- NOTE: auth schema/auth.users/auth.uid() are provided by real Supabase
-- (GoTrue + the supabase/postgres image) when this file runs inside the
-- self-hosted Supabase stack (supabase-local/) -- do NOT recreate them
-- here, that would shadow Supabase's real, RLS-correct auth.uid().
-- ==========================================
-- 2. Create Public Tables
-- ==========================================

-- PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    updated_at timestamp with time zone,
    full_name text,
    avatar_url text,
    email text,
    headline text,
    summary text,
    skills text[] DEFAULT '{}',
    desired_roles text[] DEFAULT '{}',
    locations text[] DEFAULT '{}',
    experience_years float DEFAULT 0,
    open_to_remote boolean DEFAULT false,
    links jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- RESUMES
CREATE TABLE IF NOT EXISTS public.resumes (
    id              SERIAL PRIMARY KEY,
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL DEFAULT 'Untitled Resume',
    original_text   TEXT,
    optimized_text  TEXT,
    parsed_json     TEXT,                    -- JSON-serialized structured resume
    file_url        TEXT,
    file_type       TEXT,
    status          TEXT NOT NULL DEFAULT 'uploaded',  -- uploaded, parsed, optimized
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON public.resumes(user_id);

-- JOB DESCRIPTIONS
CREATE TABLE IF NOT EXISTS public.job_descriptions (
    id              SERIAL PRIMARY KEY,
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    company         TEXT,
    text            TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jds_user_id ON public.job_descriptions(user_id);

-- ANALYSIS RESULTS
CREATE TABLE IF NOT EXISTS public.analysis_results (
    id                   SERIAL PRIMARY KEY,
    user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    resume_id            INTEGER NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
    job_description_id   INTEGER NOT NULL REFERENCES public.job_descriptions(id) ON DELETE CASCADE,
    score                INTEGER DEFAULT 0,
    breakdown            TEXT,                     -- JSON serialized
    keyword_matches      TEXT,                     -- JSON serialized list
    recommendations      TEXT,                     -- JSON serialized list
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_user_id ON public.analysis_results(user_id);

-- RESUME VERSIONS
CREATE TABLE IF NOT EXISTS public.resume_versions (
    id          SERIAL PRIMARY KEY,
    resume_id   INTEGER NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
    version_type TEXT NOT NULL DEFAULT 'optimized',
    parsed_json  TEXT,                       -- JSON serialized optimized resume
    file_url    TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- USER ROLES
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('admin', 'user', 'moderator')),
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, role)
);

-- BLOG POSTS
CREATE TABLE IF NOT EXISTS public.blog_posts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    slug text NOT NULL UNIQUE,
    content text NOT NULL,
    excerpt text NOT NULL,
    featured_image text,
    category text NOT NULL,
    tags text[],
    author_name text,
    published_at timestamp with time zone,
    is_featured boolean DEFAULT false,
    is_success_story boolean DEFAULT false,
    read_time_minutes integer,
    prompts_used jsonb,
    outcomes jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- RESUME ANALYSES
CREATE TABLE IF NOT EXISTS public.resume_analyses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    resume_text text,
    resume_filename text NOT NULL,
    job_description text,
    job_title text,
    company_name text,
    analysis_data jsonb NOT NULL,
    overall_score double precision NOT NULL,
    parsed_resume jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- AUTH ATTEMPTS
CREATE TABLE IF NOT EXISTS public.auth_attempts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    email text NOT NULL UNIQUE,
    ip_hash text,
    attempt_count integer DEFAULT 1 NOT NULL,
    last_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    blocked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- USER ACHIEVEMENTS
CREATE TABLE IF NOT EXISTS public.user_achievements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_type text NOT NULL,
    metadata jsonb,
    achieved_at timestamp with time zone DEFAULT now()
);

-- USER STREAKS
CREATE TABLE IF NOT EXISTS public.user_streaks (
    user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    current_streak integer DEFAULT 0,
    longest_streak integer DEFAULT 0,
    last_activity_date timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now()
);


-- ==========================================
-- 3. Security Definer Functions
-- ==========================================

CREATE OR REPLACE FUNCTION public.has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_has_role BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = required_role
    ) INTO user_has_role;
    
    RETURN user_has_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==========================================
-- MVP Additions: Saved Jobs, Auto-Pilot, Applications, Schedules
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

CREATE TABLE IF NOT EXISTS public.autopilot_runs (
    id                  SERIAL PRIMARY KEY,
    run_id              uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
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

CREATE TABLE IF NOT EXISTS public.applications (
    id                   SERIAL PRIMARY KEY,
    application_id       uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
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

-- USER SUBSCRIPTIONS (M10 Billing)
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id                      SERIAL PRIMARY KEY,
    user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    stripe_customer_id      TEXT,
    stripe_subscription_id TEXT,
    plan                    TEXT NOT NULL DEFAULT 'free',
    status                  TEXT NOT NULL DEFAULT 'active',
    metered_limit           INTEGER NOT NULL DEFAULT 1000,
    requests_used           INTEGER NOT NULL DEFAULT 0,
    current_period_end      TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);

-- JOB WATCHES (M15 Standing Interest Engine)
CREATE TABLE IF NOT EXISTS public.job_watches (
    id                  SERIAL PRIMARY KEY,
    watch_id            uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    query_title         TEXT NOT NULL,
    location            TEXT DEFAULT 'Remote',
    salary_floor        NUMERIC DEFAULT 100000,
    schedule_tier       TEXT DEFAULT 'daily',
    is_active           BOOLEAN DEFAULT true,
    last_run_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_watches_user_id ON public.job_watches(user_id);

