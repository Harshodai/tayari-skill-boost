-- ==============================================================================
-- Tayari Skill Boost - Lean MVP 12-Core Schema
-- File: scripts/lean-schema-12.sql
--
-- Strategic Goal:
-- "58-table schema -> Strip to 12 core tables for MVP. VCs want lean MVPs,
-- not microservices castles."
--
-- Target Environments:
-- - Self-hosted Supabase / Docker PostgreSQL
-- - Managed Cloud Supabase / Neon Serverless Postgres
--
-- Core Security & Production Guarantees:
-- 1. Exactly 12 production-critical tables.
-- 2. Row Level Security (RLS) ENABLED and FORCED on all 12 tables.
-- 3. Strict owner-scoping: auth.uid() = user_id (or auth.uid() = id for profiles).
-- 4. Zero public `USING (true)` policies.
-- 5. Least-privilege GRANTS for `authenticated` and `service_role`.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. Auth & Schema Prerequisites (safe for standalone PostgreSQL / Neon)
-- Supabase provides auth.users plus the anon / authenticated / service_role
-- roles natively. Plain Postgres / Neon do not, so create minimal
-- Neon-compatible stubs first (no-ops where they already exist).
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE SCHEMA IF NOT EXISTS auth;

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN BYPASSRLS;
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ------------------------------------------------------------------------------
-- 1. profiles
-- Core candidate persona, contact details, headline, and target goals.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id               UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email            TEXT,
    full_name        TEXT,
    avatar_url       TEXT,
    headline         TEXT,
    summary          TEXT,
    skills           TEXT[] DEFAULT '{}',
    desired_roles    TEXT[] DEFAULT '{}',
    locations        TEXT[] DEFAULT '{}',
    experience_years NUMERIC DEFAULT 0,
    open_to_remote   BOOLEAN DEFAULT false,
    links            JSONB DEFAULT '{}'::jsonb,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- ------------------------------------------------------------------------------
-- 2. user_roles
-- Role-based access control (user, admin, moderator) without role confusion.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role       TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'moderator')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- ------------------------------------------------------------------------------
-- 3. resumes
-- Master candidate resume documents and parsed JSON representations.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.resumes (
    id             SERIAL PRIMARY KEY,
    user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title          TEXT NOT NULL DEFAULT 'Untitled Resume',
    original_text  TEXT,
    optimized_text TEXT,
    parsed_json    JSONB DEFAULT '{}'::jsonb,
    file_url       TEXT,
    file_type      TEXT,
    status         TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'parsed', 'optimizing', 'optimized', 'error')),
    ats_score      INTEGER DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON public.resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_created_at ON public.resumes(created_at DESC);

-- ------------------------------------------------------------------------------
-- 4. tailored_resumes
-- Job-specific tailored artifacts produced by AI tailoring pipeline.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tailored_resumes (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tailored_id      UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    resume_id        INTEGER REFERENCES public.resumes(id) ON DELETE CASCADE,
    application_id   UUID,
    job_hash         TEXT NOT NULL,
    tailored_text    TEXT NOT NULL,
    changes          JSONB NOT NULL DEFAULT '[]'::jsonb,
    keywords_added   JSONB NOT NULL DEFAULT '[]'::jsonb,
    ats_score_before INTEGER NOT NULL DEFAULT 0,
    ats_score_after  INTEGER NOT NULL DEFAULT 0,
    model            TEXT,
    version          INTEGER NOT NULL DEFAULT 1,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tailored_resumes_user_id ON public.tailored_resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_tailored_resumes_job_hash ON public.tailored_resumes(job_hash);
CREATE INDEX IF NOT EXISTS idx_tailored_resumes_resume_id ON public.tailored_resumes(resume_id);

-- ------------------------------------------------------------------------------
-- 5. resume_analyses
-- 60-second ATS gap analysis results, keyword matches, and score breakdowns.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.resume_analyses (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    resume_id        INTEGER REFERENCES public.resumes(id) ON DELETE SET NULL,
    resume_text      TEXT,
    resume_filename  TEXT,
    job_description  TEXT,
    job_title        TEXT,
    company_name     TEXT,
    analysis_data    JSONB NOT NULL DEFAULT '{}'::jsonb,
    overall_score    DOUBLE PRECISION NOT NULL DEFAULT 0,
    parsed_resume    JSONB DEFAULT '{}'::jsonb,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resume_analyses_user_id ON public.resume_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_resume_analyses_created_at ON public.resume_analyses(created_at DESC);

-- ------------------------------------------------------------------------------
-- 6. saved_jobs
-- Candidate's saved jobs and opportunity tracking pipeline.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_jobs (
    id          SERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    dedupe_key  TEXT NOT NULL,
    job         JSONB NOT NULL DEFAULT '{}'::jsonb,
    status      TEXT NOT NULL DEFAULT 'saved' CHECK (status IN ('saved', 'applied', 'interviewing', 'archived', 'rejected', 'offered')),
    notes       TEXT,
    match_score INTEGER DEFAULT 0,
    saved_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_saved_jobs_user_id ON public.saved_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_jobs_status ON public.saved_jobs(user_id, status);

-- ------------------------------------------------------------------------------
-- 7. scraped_jobs
-- Hermes 4-tier scraper cache (Direct ATS JSON, keyless scrapers, Playwright).
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scraped_jobs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scraped_id  UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    dedupe_key  TEXT NOT NULL,
    source      TEXT NOT NULL,
    board_class TEXT,
    board_token TEXT,
    job         JSONB NOT NULL DEFAULT '{}'::jsonb,
    query       TEXT,
    location    TEXT,
    fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, dedupe_key, source)
);

CREATE INDEX IF NOT EXISTS idx_scraped_jobs_source ON public.scraped_jobs(source);
CREATE INDEX IF NOT EXISTS idx_scraped_jobs_user_id ON public.scraped_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_scraped_jobs_fetched_at ON public.scraped_jobs(fetched_at DESC);

-- ------------------------------------------------------------------------------
-- 8. application_attempts
-- Auditable step attempts (TAILOR -> SCORE -> LETTER -> APPLY -> SUBMIT).
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.application_attempts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id     UUID NOT NULL DEFAULT gen_random_uuid(),
    run_id         UUID,
    user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    application_id UUID,
    job            JSONB NOT NULL DEFAULT '{}'::jsonb,
    step           TEXT NOT NULL CHECK (step IN ('TAILOR', 'SCORE', 'LETTER', 'APPLY', 'SUBMIT')),
    status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'skipped', 'paused_human_review')),
    attempt_num    INTEGER NOT NULL DEFAULT 1,
    result         JSONB NOT NULL DEFAULT '{}'::jsonb,
    error          TEXT,
    screenshot_url TEXT,
    started_at     TIMESTAMPTZ,
    finished_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_attempts_run_id ON public.application_attempts(run_id);
CREATE INDEX IF NOT EXISTS idx_application_attempts_user_id ON public.application_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_application_attempts_status ON public.application_attempts(status);

-- ------------------------------------------------------------------------------
-- 9. interview_sessions
-- Voice AI and interactive mock interview transcripts and scores.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.interview_sessions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role       TEXT NOT NULL,
    difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    transcript JSONB DEFAULT '[]'::jsonb,
    score      INTEGER,
    feedback   JSONB DEFAULT '{}'::jsonb,
    status     TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_id ON public.interview_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_created_at ON public.interview_sessions(user_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 10. credits
-- Usage ledger balance for application runs and AI inference.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credits (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    balance            INTEGER NOT NULL DEFAULT 10 CHECK (balance >= 0),
    lifetime_purchased INTEGER NOT NULL DEFAULT 10,
    lifetime_used      INTEGER NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credits_user_id ON public.credits(user_id);

-- ------------------------------------------------------------------------------
-- 11. billing_transactions
-- Verifiable financial ledger records for credit-pack purchases.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_transactions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount_cents     INTEGER NOT NULL CHECK (amount_cents >= 0),
    currency         TEXT NOT NULL DEFAULT 'usd',
    credits_added    INTEGER NOT NULL DEFAULT 0,
    payment_provider TEXT NOT NULL DEFAULT 'stripe',
    provider_tx_id   TEXT,
    payment_status   TEXT NOT NULL DEFAULT 'completed' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_transactions_user_id ON public.billing_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_provider_tx ON public.billing_transactions(provider_tx_id);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_created_at ON public.billing_transactions(created_at DESC);

-- ------------------------------------------------------------------------------
-- 12. agent_runs
-- Automation control plane runs for background agents and schedulers.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_runs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id         UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    run_type       TEXT NOT NULL DEFAULT 'autopilot' CHECK (run_type IN ('autopilot', 'scrape', 'application_agent', 'scheduled', 'tailor')),
    parent_run_id  UUID REFERENCES public.agent_runs(run_id) ON DELETE SET NULL,
    config         JSONB NOT NULL DEFAULT '{}'::jsonb,
    status         TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled', 'paused')),
    progress       INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    current_step   TEXT,
    logs           JSONB NOT NULL DEFAULT '[]'::jsonb,
    screenshots    JSONB NOT NULL DEFAULT '[]'::jsonb,
    result         JSONB NOT NULL DEFAULT '{}'::jsonb,
    error          TEXT,
    engine         TEXT DEFAULT 'python-celery',
    celery_task_id TEXT,
    job_title      TEXT,
    company        TEXT,
    started_at     TIMESTAMPTZ,
    completed_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_user_id ON public.agent_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON public.agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_run_type ON public.agent_runs(run_type);
CREATE INDEX IF NOT EXISTS idx_agent_runs_created_at ON public.agent_runs(created_at DESC);

-- Foreign Key tie for application_attempts -> agent_runs(run_id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_application_attempts_run'
    ) THEN
        ALTER TABLE public.application_attempts
            ADD CONSTRAINT fk_application_attempts_run
            FOREIGN KEY (run_id) REFERENCES public.agent_runs(run_id) ON DELETE CASCADE;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- updated_at Triggers (rerunnable — drops existing trigger before creating)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'profiles', 'resumes', 'tailored_resumes', 'resume_analyses',
        'saved_jobs', 'interview_sessions', 'credits', 'agent_runs'
    ] LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS set_updated_at ON public.%I; CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();',
            tbl, tbl
        );
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- Row Level Security (RLS) Enablement & Enforcement (All 12 Tables)
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes FORCE ROW LEVEL SECURITY;

ALTER TABLE public.tailored_resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tailored_resumes FORCE ROW LEVEL SECURITY;

ALTER TABLE public.resume_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_analyses FORCE ROW LEVEL SECURITY;

ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_jobs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.scraped_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraped_jobs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.application_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_attempts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_sessions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits FORCE ROW LEVEL SECURITY;

ALTER TABLE public.billing_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_transactions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs FORCE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Owner-Scoped Row Level Security Policies (Strict auth.uid() = user_id)
-- ------------------------------------------------------------------------------

-- 1. profiles: users can view and edit only their own profile
DROP POLICY IF EXISTS profiles_owner_access ON public.profiles;
CREATE POLICY profiles_owner_access ON public.profiles
    FOR ALL TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_matches_id;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_matches_id
    CHECK (user_id IS NULL OR user_id = id);

-- 2. user_roles: users can only view their own role assignments
DROP POLICY IF EXISTS user_roles_owner_access ON public.user_roles;
CREATE POLICY user_roles_owner_access ON public.user_roles
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- 3. resumes: users can view, insert, update, and delete their own resumes
DROP POLICY IF EXISTS resumes_owner_access ON public.resumes;
CREATE POLICY resumes_owner_access ON public.resumes
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. tailored_resumes: users can access their own tailored resumes
DROP POLICY IF EXISTS tailored_resumes_owner_access ON public.tailored_resumes;
CREATE POLICY tailored_resumes_owner_access ON public.tailored_resumes
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 5. resume_analyses: users can access their own resume ATS analyses
DROP POLICY IF EXISTS resume_analyses_owner_access ON public.resume_analyses;
CREATE POLICY resume_analyses_owner_access ON public.resume_analyses
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 6. saved_jobs: users can manage only their own saved jobs
DROP POLICY IF EXISTS saved_jobs_owner_access ON public.saved_jobs;
CREATE POLICY saved_jobs_owner_access ON public.saved_jobs
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 7. scraped_jobs: users can access only their user-scoped scraped jobs
DROP POLICY IF EXISTS scraped_jobs_owner_access ON public.scraped_jobs;
CREATE POLICY scraped_jobs_owner_access ON public.scraped_jobs
    FOR ALL TO authenticated
    USING (user_id IS NOT NULL AND auth.uid() = user_id)
    WITH CHECK (user_id IS NOT NULL AND auth.uid() = user_id);

-- 8. application_attempts: users can access only their own application attempts
DROP POLICY IF EXISTS application_attempts_owner_access ON public.application_attempts;
CREATE POLICY application_attempts_owner_access ON public.application_attempts
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 9. interview_sessions: users can access only their own interview mock sessions
DROP POLICY IF EXISTS interview_sessions_owner_access ON public.interview_sessions;
CREATE POLICY interview_sessions_owner_access ON public.interview_sessions
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 10. credits: users can view their own balance (mutations restricted to service_role)
DROP POLICY IF EXISTS credits_owner_access ON public.credits;
CREATE POLICY credits_owner_access ON public.credits
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- 11. billing_transactions: users can view only their own payment receipts
DROP POLICY IF EXISTS billing_transactions_owner_access ON public.billing_transactions;
CREATE POLICY billing_transactions_owner_access ON public.billing_transactions
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- 12. agent_runs: users can manage and observe only their own automation runs
DROP POLICY IF EXISTS agent_runs_owner_access ON public.agent_runs;
CREATE POLICY agent_runs_owner_access ON public.agent_runs
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- Least-Privilege Grants & Anon Revocations
-- ------------------------------------------------------------------------------
REVOKE ALL ON TABLE public.profiles, public.user_roles, public.resumes, public.tailored_resumes,
                    public.resume_analyses, public.saved_jobs, public.scraped_jobs,
                    public.application_attempts, public.interview_sessions, public.credits,
                    public.billing_transactions, public.agent_runs FROM anon, public;

-- Service role retains full administrative access
GRANT ALL ON TABLE public.profiles, public.user_roles, public.resumes, public.tailored_resumes,
                   public.resume_analyses, public.saved_jobs, public.scraped_jobs,
                   public.application_attempts, public.interview_sessions, public.credits,
                   public.billing_transactions, public.agent_runs TO service_role;

-- Authenticated candidates have full CRUD on their user-owned resources
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    public.profiles,
    public.resumes,
    public.tailored_resumes,
    public.resume_analyses,
    public.saved_jobs,
    public.scraped_jobs,
    public.application_attempts,
    public.interview_sessions,
    public.agent_runs
TO authenticated;

-- Authenticated candidates have read-only access to ledger/role/credit records
GRANT SELECT ON TABLE
    public.user_roles,
    public.credits,
    public.billing_transactions
TO authenticated;

-- Sequence grants for serial primary keys
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

COMMIT;
