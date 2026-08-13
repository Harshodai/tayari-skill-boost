-- Durable commercial-interest capture for the public Pricing page.
-- This table intentionally contains only the minimum lead data required for
-- a requested institutional follow-up; no user account is created here.

CREATE TABLE IF NOT EXISTS public.waitlist_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    tier TEXT NOT NULL CHECK (tier IN ('institutions')),
    source TEXT NOT NULL DEFAULT 'pricing',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT waitlist_leads_email_format CHECK (
        email ~* '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS waitlist_leads_email_tier_key
    ON public.waitlist_leads (email, tier);
CREATE INDEX IF NOT EXISTS waitlist_leads_tier_created_at_idx
    ON public.waitlist_leads (tier, created_at DESC);

ALTER TABLE public.waitlist_leads ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.waitlist_leads TO service_role;
DROP POLICY IF EXISTS "waitlist_leads_service_all" ON public.waitlist_leads;
CREATE POLICY "waitlist_leads_service_all" ON public.waitlist_leads
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
