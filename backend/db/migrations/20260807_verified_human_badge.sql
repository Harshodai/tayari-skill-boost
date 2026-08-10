-- V3: Verified-Human Badge — per-user verification record.
-- Design: docs/superpowers/specs/2026-08-07-v3-verified-human-badge-design.md
-- Go is authoritative for this table (ADR-0003); Python scoring stays stateless.

CREATE TABLE IF NOT EXISTS public.candidate_verification (
    user_id UUID PRIMARY KEY,
    status VARCHAR(20) NOT NULL DEFAULT 'unverified',
    truthful_score NUMERIC(5,2),
    red_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
    screening_score NUMERIC(5,2),
    strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
    gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
    sample_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    verified_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidate_verification_status
ON public.candidate_verification (status);

-- RLS: default-deny for client roles. The Go backend connects as the
-- postgres superuser (bypasses RLS) and is the only reader/writer — same
-- shape as auth_attempts in 20260731_self_hosted_rls_hardening.sql.
ALTER TABLE public.candidate_verification ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.candidate_verification FROM anon;
REVOKE ALL ON public.candidate_verification FROM authenticated;
REVOKE ALL ON public.candidate_verification FROM PUBLIC;

DROP POLICY IF EXISTS "candidate_verification_deny_all" ON public.candidate_verification;
CREATE POLICY "candidate_verification_deny_all" ON public.candidate_verification
    FOR ALL TO public
    USING (false)
    WITH CHECK (false);