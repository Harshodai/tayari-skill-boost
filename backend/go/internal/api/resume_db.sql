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
