-- ==========================================
-- 2026-06-26: Predictive Funnel Analytics Schema
-- Adds support for resume variants and A/B testing stats.
-- ==========================================

-- 1. resume_variants
CREATE TABLE IF NOT EXISTS public.resume_variants (
    id           SERIAL PRIMARY KEY,
    resume_id    INTEGER NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
    name         VARCHAR(100) NOT NULL,
    original_text TEXT NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resume_variants_resume ON public.resume_variants(resume_id);

-- 2. ab_testing_bandit
CREATE TABLE IF NOT EXISTS public.ab_testing_bandit (
    id           SERIAL PRIMARY KEY,
    variant_id   INTEGER NOT NULL REFERENCES public.resume_variants(id) ON DELETE CASCADE,
    pulls        INTEGER DEFAULT 0,
    conversions  INTEGER DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(variant_id)
);

-- 3. Alter applications to link variant
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS resume_variant_id INTEGER REFERENCES public.resume_variants(id) ON DELETE SET NULL;
