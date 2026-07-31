-- ==========================================
-- 2026-07-31: Social Graph + Privacy Ledger + Preference Learning
-- Self-hosted-stack counterpart of supabase/migrations/20260731_social_graph.sql,
-- 20260731_privacy_audit_log.sql, 20260629000001_add_conversations.sql, and
-- 20260629000002_add_user_feedback.sql — without these, the tables those
-- migrations create only exist on the (optional) Supabase stack, and every
-- Go handler/route that touches them (routes_social.go, the GDPR delete/
-- export cascade in routes_account.go, the /api/v1/conversations and
-- /api/v1/preferences proxies) 500s on the primary docker-compose Postgres.
--
-- No RLS/auth.uid() policies here, matching every other file in this
-- directory: the Go backend connects as a superuser (bypasses RLS anyway)
-- and does its own `WHERE user_id=$1` / ownership checks in-handler.
-- ==========================================

-- ==========================================
-- connections: directed connection requests between users
-- ==========================================
CREATE TABLE IF NOT EXISTS public.connections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    addressee_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (requester_id, addressee_id),
    CHECK (requester_id <> addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_connections_requester ON public.connections (requester_id);
CREATE INDEX IF NOT EXISTS idx_connections_addressee ON public.connections (addressee_id);
CREATE INDEX IF NOT EXISTS idx_connections_status    ON public.connections (status);

-- Same identity-lock as the Supabase migration's trigger: an UPDATE may
-- only change `status`, never who the connection is between.
CREATE OR REPLACE FUNCTION public.connections_lock_identity()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.requester_id <> OLD.requester_id OR NEW.addressee_id <> OLD.addressee_id THEN
        RAISE EXCEPTION 'requester_id and addressee_id cannot be changed';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_connections_lock_identity ON public.connections;
CREATE TRIGGER trg_connections_lock_identity
    BEFORE UPDATE ON public.connections
    FOR EACH ROW EXECUTE FUNCTION public.connections_lock_identity();

-- ==========================================
-- shared_interview_questions: community knowledge base
-- ==========================================
CREATE TABLE IF NOT EXISTS public.shared_interview_questions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company         TEXT,
    role            TEXT,
    question_text   TEXT NOT NULL,
    answer_text     TEXT,
    category        TEXT DEFAULT 'behavioral'
                        CHECK (category IN ('behavioral', 'technical', 'system_design',
                                            'culture', 'hr', 'other')),
    visibility      TEXT NOT NULL DEFAULT 'connections'
                        CHECK (visibility IN ('private', 'connections', 'public')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- No stored upvotes counter — see question_upvotes below.

CREATE INDEX IF NOT EXISTS idx_siq_user       ON public.shared_interview_questions (user_id);
CREATE INDEX IF NOT EXISTS idx_siq_company    ON public.shared_interview_questions (company);
CREATE INDEX IF NOT EXISTS idx_siq_visibility ON public.shared_interview_questions (visibility);

-- pg_trgm powers the feed's leading-wildcard `company ILIKE '%term%'` filter,
-- which a plain B-tree index can't accelerate. Bundled in the standard
-- postgres:16-alpine image's contrib modules — no extra install needed.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_siq_company_trgm
    ON public.shared_interview_questions USING GIN (company gin_trgm_ops);

-- ==========================================
-- question_upvotes: one vote per (question, user)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.question_upvotes (
    question_id UUID NOT NULL REFERENCES public.shared_interview_questions(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (question_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_question_upvotes_question ON public.question_upvotes (question_id);

-- ==========================================
-- application_outcomes: real conversion-funnel tracking (M2)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.application_outcomes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id      UUID NOT NULL REFERENCES public.applications(application_id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    automation_run_id   UUID,
    recruiter_reply     BOOLEAN DEFAULT FALSE,
    phone_screen        BOOLEAN DEFAULT FALSE,
    technical_interview BOOLEAN DEFAULT FALSE,
    final_interview     BOOLEAN DEFAULT FALSE,
    offer_received      BOOLEAN DEFAULT FALSE,
    offer_accepted      BOOLEAN DEFAULT FALSE,
    salary_offered      NUMERIC(12,2),
    outcome_date        TIMESTAMPTZ,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (application_id)
);

-- ==========================================
-- privacy_audit_log: GDPR Article 30 processing records (append-only)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.privacy_audit_log (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID        NOT NULL,
    action      TEXT        NOT NULL,
    resource    TEXT,
    detail      JSONB       NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pal_user_created
    ON public.privacy_audit_log (user_id, created_at DESC);

-- ==========================================
-- conversations: persistent chat memory (backs the Go /api/v1/conversations
-- proxy in routes_memory.go and Python app/services/memory_composer.py)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title           TEXT,
    messages        JSONB NOT NULL DEFAULT '[]',
    summary         TEXT,
    context_type    TEXT DEFAULT 'general',
    related_job_id  UUID,
    is_archived     BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user    ON public.conversations (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_context ON public.conversations (user_id, context_type);

DROP TRIGGER IF EXISTS on_conversations_update ON public.conversations;
CREATE TRIGGER on_conversations_update
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==========================================
-- user_job_feedback + user_preference_summary: backs the Go
-- /api/v1/preferences proxy in routes_memory.go and
-- app/services/preference_learning.py. This is the real table behind
-- what routes_account.go's delete cascade calls "preferences" — see the
-- fix there (was pointed at a nonexistent `user_preferences` table).
-- ==========================================
CREATE TABLE IF NOT EXISTS public.user_job_feedback (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id          TEXT NOT NULL,
    job_title       TEXT,
    company_name    TEXT,
    feedback_type   TEXT NOT NULL CHECK (feedback_type IN ('liked', 'disliked', 'applied', 'skipped', 'saved')),
    feedback_source TEXT DEFAULT 'manual',
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_job_feedback_user ON public.user_job_feedback(user_id, feedback_type);
CREATE INDEX IF NOT EXISTS idx_user_job_feedback_job  ON public.user_job_feedback(job_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS public.user_preference_summary AS
SELECT
    user_id,
    COUNT(*) FILTER (WHERE feedback_type = 'liked') as liked_count,
    COUNT(*) FILTER (WHERE feedback_type = 'applied') as applied_count,
    COUNT(*) FILTER (WHERE feedback_type = 'skipped') as skipped_count,
    ARRAY_AGG(DISTINCT job_title) FILTER (WHERE feedback_type IN ('liked', 'applied')) as preferred_titles,
    ARRAY_AGG(DISTINCT company_name) FILTER (WHERE feedback_type IN ('liked', 'applied')) as preferred_companies,
    MAX(created_at) as last_feedback_at
FROM public.user_job_feedback
GROUP BY user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_pref_summary_user ON public.user_preference_summary(user_id);

-- NOTE: no CONCURRENTLY — this function is called via `SELECT
-- refresh_user_preference_summary()` (see backend/python/app/services/
-- preference_learning.py), and REFRESH MATERIALIZED VIEW CONCURRENTLY
-- cannot run inside a transaction block. A plpgsql function body always
-- executes as part of the calling statement's transaction, so CONCURRENTLY
-- here would unconditionally raise "cannot run inside a transaction block"
-- on every invocation. Plain REFRESH takes a brief lock instead, which is
-- an acceptable tradeoff for a daily preference-learning job.
CREATE OR REPLACE FUNCTION public.refresh_user_preference_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW public.user_preference_summary;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE public.connections IS 'User connection graph for social features (Phase 4.2)';
COMMENT ON TABLE public.shared_interview_questions IS 'Community interview question bank with visibility controls (Phase 4.2)';
COMMENT ON TABLE public.question_upvotes IS 'One vote per (question, user) — dedupes shared_interview_questions upvotes';
COMMENT ON TABLE public.application_outcomes IS 'Real outcome tracking for autopilot conversion funnel (M2)';
COMMENT ON TABLE public.privacy_audit_log IS
    'GDPR Art.30 Records of Processing Activities. Append-only. Never delete rows on account deletion.';
COMMENT ON TABLE public.conversations IS 'Persistent chat memory (Knowledge Hub / memory layer)';
COMMENT ON TABLE public.user_job_feedback IS 'Per-job liked/applied/disliked/skipped signals feeding preference learning';
