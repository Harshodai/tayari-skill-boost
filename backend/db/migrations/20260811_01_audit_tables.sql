-- 2026-08-11: WS-01/02/05 audit tables — application_approvals,
-- submission_receipts, agent_questions. The Python services that read/write
-- these (approval_gate.py, submission_receipt.py, question_queue.py) degrade
-- to no-ops when the tables are absent, so without this migration the entire
-- approval-gate + receipt + human-answer-queue system is silently disabled.
-- All three tables are user-scoped (RLS by user_id) with a service_role bypass
-- for the Python engine's server-side writes.

-- =========================================================================
-- application_approvals (WS-01)
-- One row per (user_id, run_id, resume_sha256). decision='approved' is the
-- only thing that authorises a submission; a stored job_watches config row
-- can no longer grant consent on its own.
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.application_approvals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    run_id          TEXT NOT NULL,
    job_url         TEXT,
    job_title       TEXT,
    company         TEXT,
    resume_sha256   TEXT NOT NULL,
    resume_preview  TEXT,
    decision        TEXT NOT NULL DEFAULT 'pending'
                    CHECK (decision IN ('pending', 'approved', 'rejected')),
    approved_by     UUID,
    approved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, run_id, resume_sha256)
);

CREATE INDEX IF NOT EXISTS idx_application_approvals_user
    ON public.application_approvals (user_id);
CREATE INDEX IF NOT EXISTS idx_application_approvals_run
    ON public.application_approvals (run_id);
CREATE INDEX IF NOT EXISTS idx_application_approvals_pending
    ON public.application_approvals (user_id) WHERE decision = 'pending';

ALTER TABLE public.application_approvals ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.application_approvals TO authenticated, service_role;

DROP POLICY IF EXISTS "application_approvals_all_own" ON public.application_approvals;
CREATE POLICY "application_approvals_all_own" ON public.application_approvals
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "application_approvals_service_all" ON public.application_approvals;
CREATE POLICY "application_approvals_service_all" ON public.application_approvals
    FOR ALL TO service_role
    USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- =========================================================================
-- submission_receipts (WS-02)
-- Immutable evidence row per application attempt. verified=true requires an
-- explicit confirmation phrase from the ATS; an unverified run is never
-- upgraded to 'applied' in the UI.
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.submission_receipts (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    run_id                   TEXT,
    application_id           UUID,
    job_url                  TEXT,
    job_title                TEXT,
    company                  TEXT,
    ats_vendor               TEXT,
    submitted_at             TIMESTAMPTZ,
    verified                 BOOLEAN NOT NULL DEFAULT FALSE,
    confirmation_text        TEXT,
    confirmation_number      TEXT,
    screenshot_path           TEXT,
    submitted_resume_sha256   TEXT,
    submitted_resume_text     TEXT,
    answers                  JSONB NOT NULL DEFAULT '{}'::jsonb,
    outcome                  TEXT NOT NULL DEFAULT 'unknown'
                             CHECK (outcome IN ('unknown', 'submitted', 'unconfirmed', 'failed', 'prepared')),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submission_receipts_user
    ON public.submission_receipts (user_id);
CREATE INDEX IF NOT EXISTS idx_submission_receipts_run
    ON public.submission_receipts (run_id);
CREATE INDEX IF NOT EXISTS idx_submission_receipts_application
    ON public.submission_receipts (application_id);
CREATE INDEX IF NOT EXISTS idx_submission_receipts_verified
    ON public.submission_receipts (user_id, verified);

ALTER TABLE public.submission_receipts ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.submission_receipts TO authenticated;
GRANT ALL ON TABLE public.submission_receipts TO service_role;

DROP POLICY IF EXISTS "submission_receipts_all_own" ON public.submission_receipts;
CREATE POLICY "submission_receipts_all_own" ON public.submission_receipts
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "submission_receipts_service_all" ON public.submission_receipts;
CREATE POLICY "submission_receipts_service_all" ON public.submission_receipts
    FOR ALL TO service_role
    USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- =========================================================================
-- agent_questions (WS-05)
-- Human-answer queue for ATS fields the agent must never guess
-- (sponsorship, salary, veteran status, etc.). The agent blocks on
-- status='pending' and resumes once the user answers in /questions.
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.agent_questions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    run_id       TEXT,
    job_title    TEXT,
    company      TEXT,
    field_label  TEXT NOT NULL,
    field_type   TEXT NOT NULL DEFAULT 'text'
                 CHECK (field_type IN ('text', 'choice')),
    options      JSONB NOT NULL DEFAULT '[]'::jsonb,
    answer       TEXT,
    answered_at  TIMESTAMPTZ,
    status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'answered', 'skipped')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_questions_user
    ON public.agent_questions (user_id);
CREATE INDEX IF NOT EXISTS idx_agent_questions_pending
    ON public.agent_questions (user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_agent_questions_run
    ON public.agent_questions (run_id);

ALTER TABLE public.agent_questions ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.agent_questions TO authenticated, service_role;

DROP POLICY IF EXISTS "agent_questions_all_own" ON public.agent_questions;
CREATE POLICY "agent_questions_all_own" ON public.agent_questions
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "agent_questions_service_all" ON public.agent_questions;
CREATE POLICY "agent_questions_service_all" ON public.agent_questions
    FOR ALL TO service_role
    USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');