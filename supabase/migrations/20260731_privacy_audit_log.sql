-- Privacy Audit Ledger (Task 4.4 / GDPR Article 30)
-- =====================================================
-- Append-only log of every significant AI inference, data access,
-- or external API call that touches user PII.

CREATE TABLE IF NOT EXISTS public.privacy_audit_log (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID        NOT NULL,
    action      TEXT        NOT NULL,   -- 'llm_inference' | 'data_export' | 'hermes_scrape' | ...
    resource    TEXT,                   -- endpoint or service name
    detail      JSONB       NOT NULL DEFAULT '{}',
    ip_hash     TEXT,                   -- SHA-256 of client IP (never store raw IP)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user-scoped queries (Privacy Readiness panel)
CREATE INDEX IF NOT EXISTS idx_pal_user_created
    ON public.privacy_audit_log (user_id, created_at DESC);

-- RLS: users can read their own rows; service role can insert
ALTER TABLE public.privacy_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pal_own ON public.privacy_audit_log;
CREATE POLICY pal_own ON public.privacy_audit_log
    FOR SELECT
    USING (auth.uid() = user_id);

-- Service role bypass (Supabase service_role JWT skips RLS automatically).
-- No explicit policy needed for INSERT from backend services.

COMMENT ON TABLE public.privacy_audit_log IS
    'GDPR Art.30 Records of Processing Activities. Append-only. Never delete rows \u2014 '
    'redact via anonymise_user() on account deletion instead.';
