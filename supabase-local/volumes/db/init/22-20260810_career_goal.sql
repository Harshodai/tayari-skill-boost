-- 2026-08-10: career goal persistence (P0 audit fix Q3)
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS transition_type TEXT CHECK (transition_type IN ('same_domain', 'cross_domain')),
    ADD COLUMN IF NOT EXISTS current_title TEXT,
    ADD COLUMN IF NOT EXISTS target_level TEXT,
    ADD COLUMN IF NOT EXISTS current_industry TEXT,
    ADD COLUMN IF NOT EXISTS target_industry TEXT,
    ADD COLUMN IF NOT EXISTS transferable_skills TEXT[] DEFAULT '{}';
