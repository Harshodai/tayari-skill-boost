-- ==========================================
-- 2026-06-25: Career Intelligence Schema (Simplified)
-- Adds support for learning resources and user skill analysis reports.
-- Follows standard patterns: gen_random_uuid, TIMESTAMPTZ,
-- FK -> auth.users(id) ON DELETE CASCADE.
-- ==========================================

-- 1. learning_resources
CREATE TABLE IF NOT EXISTS public.learning_resources (
    id                SERIAL PRIMARY KEY,
    title             VARCHAR(255) NOT NULL,
    url               TEXT NOT NULL,
    provider          VARCHAR(100) NOT NULL,
    difficulty        VARCHAR(20) CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    associated_skills VARCHAR(100)[],
    cost_type         VARCHAR(20) CHECK (cost_type IN ('free', 'paid')),
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 2. user_skill_analyses
CREATE TABLE IF NOT EXISTS public.user_skill_analyses (
    id              SERIAL PRIMARY KEY,
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    resume_id       INTEGER REFERENCES public.resumes(id) ON DELETE CASCADE,
    target_role     VARCHAR(100) NOT NULL,
    matched_skills  VARCHAR(100)[],
    missing_skills  VARCHAR(100)[],
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_skill_analyses_user ON public.user_skill_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skill_analyses_resume ON public.user_skill_analyses(resume_id);
