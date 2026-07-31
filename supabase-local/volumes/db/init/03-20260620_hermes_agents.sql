-- ==========================================
-- 2026-06-20: Hermes Agent + Automation Schema
-- Adds server-side scraping cache, agent run state, application
-- step attempts, browser sessions, tailored resumes, and platform
-- credential configs to support the Hermes integration + Celery/Redis
-- automation layer. Follows init.sql conventions: gen_random_uuid,
-- jsonb, TIMESTAMPTZ DEFAULT NOW(), FK -> auth.users(id) ON DELETE
-- CASCADE, CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS.
-- Idempotent: safe to re-run via docker-entrypoint-initdb.d.
-- ==========================================

-- ------------------------------------------
-- 0. Prerequisite: UNIQUE on applications.application_id
-- init.sql declares applications.application_id as
-- `uuid NOT NULL DEFAULT gen_random_uuid()` but does NOT mark it
-- UNIQUE or PK (the PK is `id SERIAL`). PostgreSQL requires FK target
-- columns to be UNIQUE or PK. Several tables below (and the earlier
-- 20250120 review_queue migration) reference applications(application_id),
-- so we backfill a guarded UNIQUE constraint here to make those FKs
-- valid. Idempotent via pg_constraint check.
-- ------------------------------------------
DO $$
BEGIN
    -- Only backfill if the applications table exists. If it is absent
    -- (pre-existing init.sql issue), this block is a no-op and the
    -- FK DDL below will raise a clear "relation does not exist" error,
    -- correctly signalling the environment is not ready.
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'applications'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'applications_application_id_key'
          AND conrelid = 'public.applications'::regclass
    ) THEN
        ALTER TABLE public.applications
            ADD CONSTRAINT applications_application_id_key UNIQUE (application_id);
    END IF;
END $$;

-- ------------------------------------------
-- 1. scraped_jobs
-- Cache of jobs fetched by Hermes tiered scraper (ATS JSON APIs,
-- Firecrawl/Apify/SerpApi/Crawl4AI). Deduped by (dedupe_key, source).
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.scraped_jobs (
    scraped_id   uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    dedupe_key    TEXT NOT NULL,
    source        TEXT NOT NULL CHECK (source IN (
                        'greenhouse', 'lever', 'ashby', 'workday',
                        'firecrawl', 'apify', 'serp', 'crawl4ai')),
    board_class   TEXT,
    board_token   TEXT,
    job           JSONB NOT NULL DEFAULT '{}',
    query         TEXT,
    location      TEXT,
    fetched_at    TIMESTAMPTZ DEFAULT NOW(),
    expires_at    TIMESTAMPTZ,
    UNIQUE(dedupe_key, source)
);

CREATE INDEX IF NOT EXISTS idx_scraped_jobs_source     ON public.scraped_jobs(source);
CREATE INDEX IF NOT EXISTS idx_scraped_jobs_board_class ON public.scraped_jobs(board_class);
CREATE INDEX IF NOT EXISTS idx_scraped_jobs_fetched_at ON public.scraped_jobs(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_scraped_jobs_expires_at ON public.scraped_jobs(expires_at)
    WHERE expires_at IS NOT NULL;

-- ------------------------------------------
-- 2. agent_runs
-- Server-side automation run state (autopilot, scrape, application
-- agent, scheduled). Replaces in-memory _autopilot_store; read/written
-- by Python scheduler + Celery workers via asyncpg.
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_runs (
    run_id          uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    run_type         TEXT NOT NULL CHECK (run_type IN (
                          'autopilot', 'scrape',
                          'application_agent', 'scheduled')),
    parent_run_id   uuid REFERENCES public.agent_runs(run_id) ON DELETE SET NULL,
    config          JSONB NOT NULL DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
                          'queued', 'running', 'completed',
                          'failed', 'cancelled')),
    progress        INTEGER NOT NULL DEFAULT 0,
    current_step    TEXT,
    logs            JSONB NOT NULL DEFAULT '[]',
    screenshots     JSONB NOT NULL DEFAULT '[]',
    result          JSONB NOT NULL DEFAULT '{}',
    error           TEXT,
    engine          TEXT,
    celery_task_id  TEXT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_user_id    ON public.agent_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status     ON public.agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_run_type   ON public.agent_runs(run_type);
CREATE INDEX IF NOT EXISTS idx_agent_runs_parent    ON public.agent_runs(parent_run_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_created   ON public.agent_runs(created_at DESC);

-- ------------------------------------------
-- 3. application_attempts
-- Granular per-step attempt log for the application agent
-- (TAILOR -> SCORE -> LETTER -> APPLY -> SUBMIT). Belongs to an
-- agent_runs row and (loosely) to an applications row.
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.application_attempts (
    attempt_id      uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          uuid NOT NULL REFERENCES public.agent_runs(run_id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    application_id  uuid REFERENCES public.applications(application_id) ON DELETE SET NULL,
    job             JSONB NOT NULL DEFAULT '{}',
    step            TEXT NOT NULL CHECK (step IN (
                          'TAILOR', 'SCORE', 'LETTER', 'APPLY', 'SUBMIT')),
    status          TEXT CHECK (status IN (
                          'pending', 'running', 'succeeded',
                          'failed', 'skipped')),
    attempt_num     INTEGER NOT NULL DEFAULT 1,
    result          JSONB NOT NULL DEFAULT '{}',
    error           TEXT,
    screenshot_url  TEXT,
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_application_attempts_run_id    ON public.application_attempts(run_id);
CREATE INDEX IF NOT EXISTS idx_application_attempts_user_id   ON public.application_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_application_attempts_status    ON public.application_attempts(status);

-- ------------------------------------------
-- 4. user_sessions
-- Persisted browser sessions (cookies + storage_state) for
-- authenticated apply flows. Reused by the application agent across
-- runs to avoid re-login. expires_at drives re-auth decisions.
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_sessions (
    session_id     uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform        TEXT NOT NULL,
    cookies         JSONB NOT NULL DEFAULT '{}',
    storage_state   JSONB NOT NULL DEFAULT '{}',
    user_agent      TEXT,
    proxy           TEXT,
    expires_at      TIMESTAMPTZ,
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id          ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id_platform ON public.user_sessions(user_id, platform);

-- ------------------------------------------
-- 5. tailored_resumes
-- Tailored resume artifacts produced by the application agent's
-- TAILOR step. job_hash dedupes per (resume, job) pair. application_id
-- and run_id are loose refs (SET NULL on parent delete).
-- NOTE: source_resume_id is a BIGINT loose reference; there is no
-- `resumes` table with a BIGINT PK in this schema today (only
-- resume_analyses with a uuid PK). Kept as a loose column for future
-- wiring; no hard FK is declared by design.
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.tailored_resumes (
    tailored_id        uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    run_id             uuid REFERENCES public.agent_runs(run_id) ON DELETE SET NULL,
    application_id     uuid REFERENCES public.applications(application_id) ON DELETE SET NULL,
    source_resume_id   BIGINT,
    job_hash           TEXT NOT NULL,
    tailored_text      TEXT NOT NULL,
    changes            JSONB NOT NULL DEFAULT '[]',
    keywords_added     JSONB NOT NULL DEFAULT '[]',
    ats_score_before   INTEGER NOT NULL DEFAULT 0,
    ats_score_after    INTEGER NOT NULL DEFAULT 0,
    model              TEXT,
    version            INTEGER NOT NULL DEFAULT 1,
    created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tailored_resumes_user_id       ON public.tailored_resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_tailored_resumes_job_hash      ON public.tailored_resumes(job_hash);
CREATE INDEX IF NOT EXISTS idx_tailored_resumes_application  ON public.tailored_resumes(application_id);

-- ------------------------------------------
-- 6. platform_configs
-- Per-user platform integration settings (LinkedIn, Greenhouse,
-- Workday, etc.). credentials JSONB is encrypted at rest via pgcrypto
-- (application layer encrypts secrets before insert). Unique per
-- (user_id, platform).
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_configs (
    config_id        uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform         TEXT NOT NULL,
    enabled          BOOLEAN NOT NULL DEFAULT true,
    -- credentials JSONB is encrypted at rest via pgcrypto; the
    -- application layer must encrypt secrets before writing.
    credentials      JSONB NOT NULL DEFAULT '{}',
    settings         JSONB NOT NULL DEFAULT '{}',
    last_synced_at   TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_platform_configs_user_id ON public.platform_configs(user_id);

-- ------------------------------------------
-- 7. touch_updated_at trigger for agent_runs
-- Keeps agent_runs.updated_at in sync with row changes so the
-- Python scheduler/workers can poll for recent activity. Reusable
-- function; guarded trigger creation follows the pattern from
-- 20250120_week3_4_review_queue.sql.
-- ------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_agent_runs_touch'
    ) THEN
        CREATE TRIGGER trg_agent_runs_touch
        BEFORE UPDATE ON public.agent_runs
        FOR EACH ROW
        EXECUTE FUNCTION public.touch_updated_at();
    END IF;
END $$;