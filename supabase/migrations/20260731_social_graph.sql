-- Social Graph Migration (Phase 4.2)
-- Adds connection requests and shared interview questions with RLS.

-- ===================================================================
-- connections: directed connection requests between users
-- ===================================================================
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

-- RLS
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "connections_select" ON public.connections
    FOR SELECT USING (
        auth.uid() = requester_id OR auth.uid() = addressee_id
    );

CREATE POLICY "connections_insert" ON public.connections
    FOR INSERT WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "connections_update" ON public.connections
    FOR UPDATE USING (
        auth.uid() = addressee_id AND status = 'pending'
    )
    WITH CHECK (
        auth.uid() = addressee_id AND status IN ('accepted', 'rejected')
    );

-- WITH CHECK above can only see the NEW row, so it can't stop a client from
-- also rewriting requester_id/addressee_id in the same UPDATE — enforce that
-- with a trigger that compares against OLD.
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

CREATE POLICY "connections_delete" ON public.connections
    FOR DELETE USING (
        auth.uid() = requester_id OR auth.uid() = addressee_id
    );

-- ===================================================================
-- shared_interview_questions: community knowledge base
-- ===================================================================
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
-- No stored upvotes counter: see public.question_upvotes below, which
-- dedupes one vote per (question, user) — a bare counter can't do that.

CREATE INDEX IF NOT EXISTS idx_siq_user       ON public.shared_interview_questions (user_id);
CREATE INDEX IF NOT EXISTS idx_siq_company    ON public.shared_interview_questions (company);
CREATE INDEX IF NOT EXISTS idx_siq_visibility ON public.shared_interview_questions (visibility);

-- pg_trgm powers the feed's leading-wildcard `company ILIKE '%term%'` filter,
-- which the plain B-tree index above can't accelerate.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_siq_company_trgm
    ON public.shared_interview_questions USING GIN (company gin_trgm_ops);

-- RLS
ALTER TABLE public.shared_interview_questions ENABLE ROW LEVEL SECURITY;

-- Own posts: full access
CREATE POLICY "siq_own" ON public.shared_interview_questions
    FOR ALL USING (auth.uid() = user_id);

-- Public posts: anyone can read
CREATE POLICY "siq_public_read" ON public.shared_interview_questions
    FOR SELECT USING (visibility = 'public');

-- Connection posts: visible to accepted connections only
CREATE POLICY "siq_connections_read" ON public.shared_interview_questions
    FOR SELECT USING (
        visibility = 'connections' AND (
            auth.uid() = user_id OR
            EXISTS (
                SELECT 1 FROM public.connections c
                WHERE c.status = 'accepted'
                  AND (
                    (c.requester_id = auth.uid() AND c.addressee_id = user_id) OR
                    (c.addressee_id = auth.uid() AND c.requester_id = user_id)
                  )
            )
        )
    );

-- ===================================================================
-- question_upvotes: one vote per (question, user), dedup for the feed's
-- upvote counter (replaces the old bare shared_interview_questions.upvotes
-- integer, which had no way to stop a user voting more than once)
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.question_upvotes (
    question_id UUID NOT NULL REFERENCES public.shared_interview_questions(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (question_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_question_upvotes_question ON public.question_upvotes (question_id);

ALTER TABLE public.question_upvotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "question_upvotes_own" ON public.question_upvotes
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ===================================================================
-- application_outcomes: instrument the real conversion funnel (M2)
-- ===================================================================
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

ALTER TABLE public.application_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outcomes_own" ON public.application_outcomes
    FOR ALL USING (auth.uid() = user_id);

COMMENT ON TABLE public.connections IS 'User connection graph for social features (Phase 4.2)';
COMMENT ON TABLE public.shared_interview_questions IS 'Community interview question bank with visibility controls (Phase 4.2)';
COMMENT ON TABLE public.question_upvotes IS 'One vote per (question, user) — dedupes shared_interview_questions upvotes';
COMMENT ON TABLE public.application_outcomes IS 'Real outcome tracking for autopilot conversion funnel (M2)';
