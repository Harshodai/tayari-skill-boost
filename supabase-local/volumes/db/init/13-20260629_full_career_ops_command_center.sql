-- ===================================================
-- 2026-06-29: Full Career-Ops Command Center Schema
-- Adds support for Legitimacy Checks, Evaluation Reports,
-- Story Bank, and zero-token Portal Subscriptions.
-- ===================================================

-- 1. Add columns to applications
ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS legitimacy_assessment JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS evaluation_report JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. Add column to saved_jobs
ALTER TABLE public.saved_jobs
ADD COLUMN IF NOT EXISTS legitimacy_assessment JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3. Add column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS story_bank JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 4. Create user_portals table
CREATE TABLE IF NOT EXISTS public.user_portals (
    id                SERIAL PRIMARY KEY,
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name              TEXT NOT NULL,
    careers_url       TEXT NOT NULL,
    provider          TEXT NOT NULL,
    enabled           BOOLEAN NOT NULL DEFAULT true,
    keywords_override JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_portals_user_name ON public.user_portals(user_id, name);
CREATE INDEX IF NOT EXISTS idx_user_portals_user ON public.user_portals(user_id);
