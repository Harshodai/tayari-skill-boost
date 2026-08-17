-- Durable Stripe event idempotency ledger.
-- The subscription mutation and this claim are committed together by the Go gateway.
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_received_at
    ON public.stripe_webhook_events (received_at);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stripe_webhook_events_deny_client ON public.stripe_webhook_events;
CREATE POLICY stripe_webhook_events_deny_client
    ON public.stripe_webhook_events
    FOR ALL TO authenticated, anon
    USING (false)
    WITH CHECK (false);

REVOKE ALL ON public.stripe_webhook_events FROM anon, authenticated;
GRANT SELECT, INSERT ON public.stripe_webhook_events TO service_role;
