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