-- Consent-gated preparation outcome signals. Store bounded outcome metadata,
-- never raw interview answers, transcripts, resumes, or provider payloads.
CREATE TABLE IF NOT EXISTS public.practice_outcomes (
    id                   UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    application_id       TEXT,
    practice_session_id  TEXT NOT NULL,
    completion_status    TEXT NOT NULL CHECK (completion_status IN ('started', 'partial', 'completed', 'skipped')),
    confidence           SMALLINT NOT NULL CHECK (confidence BETWEEN 0 AND 100),
    interview_outcome    TEXT NOT NULL DEFAULT 'unknown'
                         CHECK (interview_outcome IN ('unknown', 'no_interview', 'screen', 'technical', 'onsite', 'offer', 'rejected')),
    correction_note      TEXT,
    consent_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at           TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practice_outcomes_user ON public.practice_outcomes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_practice_outcomes_session ON public.practice_outcomes(user_id, practice_session_id, created_at DESC);

ALTER TABLE public.practice_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_outcomes FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.practice_outcomes FROM anon, authenticated;
GRANT ALL ON TABLE public.practice_outcomes TO service_role;
DROP POLICY IF EXISTS practice_outcomes_owner ON public.practice_outcomes;
CREATE POLICY practice_outcomes_owner ON public.practice_outcomes
    FOR ALL TO service_role USING (true) WITH CHECK (true);
