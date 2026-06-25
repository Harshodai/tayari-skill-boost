-- Database schema for Tayari Resume Optimizer (Go backend)
-- Run this migration to set up tables for resumes, job descriptions, and analysis results

-- ---------------------------------------------------------------------------
-- Resumes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resumes (
    id              SERIAL PRIMARY KEY,
    user_id         TEXT NOT NULL,
    title           TEXT NOT NULL DEFAULT 'Untitled Resume',
    original_text   TEXT,
    optimized_text  TEXT,
    parsed_json       TEXT,                    -- JSON-serialized structured resume
    file_url        TEXT,
    file_type       TEXT,
    status          TEXT NOT NULL DEFAULT 'uploaded',  -- uploaded, parsed, optimized
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);

-- ---------------------------------------------------------------------------
-- Job Descriptions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_descriptions (
    id              SERIAL PRIMARY KEY,
    user_id         TEXT NOT NULL,
    title           TEXT NOT NULL,
    company         TEXT,
    text            TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jds_user_id ON job_descriptions(user_id);

-- ---------------------------------------------------------------------------
-- Analysis Results
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analysis_results (
    id                   SERIAL PRIMARY KEY,
    user_id              TEXT NOT NULL,
    resume_id            INTEGER NOT NULL,
    job_description_id   INTEGER NOT NULL,
    score                INTEGER DEFAULT 0,
    breakdown            TEXT,                     -- JSON serialized
    keyword_matches      TEXT,                     -- JSON serialized list
    recommendations    TEXT,                     -- JSON serialized list
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_user_id ON analysis_results(user_id);

-- ---------------------------------------------------------------------------
-- Resume Versions (for optimized versions of a resume)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resume_versions (
    id          SERIAL PRIMARY KEY,
    resume_id   INTEGER NOT NULL,
    version_type TEXT NOT NULL DEFAULT 'optimized',
    parsed_json  TEXT,                       -- JSON serialized optimized resume
    file_url    TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- MVP Additions: Saved Jobs, Auto-Pilot, Applications, Schedules
-- ==========================================

CREATE TABLE IF NOT EXISTS saved_jobs (
    id          SERIAL PRIMARY KEY,
    user_id     TEXT NOT NULL,
    dedupe_key  TEXT NOT NULL,
    job         TEXT,  -- JSON serialized
    status      TEXT NOT NULL DEFAULT 'saved',
    saved_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_saved_jobs_user_id ON saved_jobs(user_id);

CREATE TABLE IF NOT EXISTS autopilot_runs (
    id                  SERIAL PRIMARY KEY,
    run_id              TEXT NOT NULL,
    user_id             TEXT NOT NULL,
    config              TEXT,  -- JSON serialized
    status              TEXT NOT NULL DEFAULT 'pending',
    progress            INTEGER DEFAULT 0,
    current_step        TEXT,
    logs                TEXT,  -- JSON serialized
    applications_created INTEGER DEFAULT 0,
    error               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autopilot_runs_user_id ON autopilot_runs(user_id);

CREATE TABLE IF NOT EXISTS applications (
    id                   SERIAL PRIMARY KEY,
    application_id       TEXT NOT NULL,
    user_id              TEXT NOT NULL,
    run_id               TEXT,
    job                  TEXT,  -- JSON serialized
    tailored_resume_text TEXT,
    cover_letter         TEXT,
    changes              TEXT,  -- JSON serialized
    keywords_added       TEXT,  -- JSON serialized
    ats_score_before     INTEGER DEFAULT 0,
    ats_score_after      INTEGER DEFAULT 0,
    is_dream_company     BOOLEAN DEFAULT false,
    status               TEXT NOT NULL DEFAULT 'saved',
    submission_mode      TEXT,
    apply_url            TEXT,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);

CREATE TABLE IF NOT EXISTS autopilot_schedules (
    id          SERIAL PRIMARY KEY,
    schedule_id TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    frequency   TEXT NOT NULL,
    config      TEXT,  -- JSON serialized
    active      BOOLEAN DEFAULT true,
    next_run_at TIMESTAMPTZ,
    last_run_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autopilot_schedules_user_id ON autopilot_schedules(user_id);
