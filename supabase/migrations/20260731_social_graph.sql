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
    );

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
    upvotes         INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_siq_user       ON public.shared_interview_questions (user_id);
CREATE INDEX IF NOT EXISTS idx_siq_company    ON public.shared_interview_questions (company);
CREATE INDEX IF NOT EXISTS idx_siq_visibility ON public.shared_interview_questions (visibility);

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
COMMENT ON TABLE public.application_outcomes IS 'Real outcome tracking for autopilot conversion funnel (M2)';
