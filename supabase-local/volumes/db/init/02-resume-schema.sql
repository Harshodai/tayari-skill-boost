-- ============================================================
-- Tayari Go Backend Tables
-- Matches schema used by backend/go/internal/api/router.go
-- ============================================================

-- ---------------------------------------------------------------
-- Resumes
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resumes (
    id              SERIAL PRIMARY KEY,
    user_id         TEXT NOT NULL,
    title           TEXT NOT NULL DEFAULT 'Untitled Resume',
    original_text   TEXT,
    parsed_json     TEXT,
    file_url        TEXT,
    file_type       TEXT,
    status          TEXT NOT NULL DEFAULT 'uploaded',  -- uploaded, parsed, optimized
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);

-- ---------------------------------------------------------------
-- Job Descriptions
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_descriptions (
    id              SERIAL PRIMARY KEY,
    user_id         TEXT NOT NULL,
    title           TEXT NOT NULL,
    company         TEXT,
    text            TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jds_user_id ON job_descriptions(user_id);

-- ---------------------------------------------------------------
-- Analysis Results
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analysis_results (
    id                   SERIAL PRIMARY KEY,
    user_id              TEXT NOT NULL,
    resume_id            INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    job_description_id   INTEGER NOT NULL REFERENCES job_descriptions(id) ON DELETE CASCADE,
    score                INTEGER DEFAULT 0,
    breakdown            TEXT,    -- JSON serialized
    keyword_matches      TEXT,    -- JSON serialized list
    recommendations      TEXT,    -- JSON serialized list
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_user_id ON analysis_results(user_id);
