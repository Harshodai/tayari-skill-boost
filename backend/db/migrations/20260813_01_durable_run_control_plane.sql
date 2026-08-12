-- Durable nervous-system primitives for Job Tayari.
--
-- The application remains responsible for authenticated authorization and
-- provider calls. These records make the candidate-visible state durable across
-- worker restarts and ensure external actions can be reconciled from evidence,
-- not process memory.

BEGIN;

CREATE TABLE IF NOT EXISTS public.run_events (
    event_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id         uuid NOT NULL REFERENCES public.agent_runs(run_id) ON DELETE CASCADE,
    user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sequence_no    bigint GENERATED ALWAYS AS IDENTITY,
    event_type     text NOT NULL,
    payload        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_run_events_run_sequence
    ON public.run_events (run_id, sequence_no);
CREATE INDEX IF NOT EXISTS idx_run_events_user_created
    ON public.run_events (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.run_controls (
    run_id                   uuid PRIMARY KEY REFERENCES public.agent_runs(run_id) ON DELETE CASCADE,
    user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cancellation_requested_at timestamptz,
    cancellation_reason      text,
    cancellation_acknowledged_at timestamptz,
    worker_id                text,
    worker_lease_token       uuid,
    worker_lease_expires_at  timestamptz,
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now(),
    CHECK (
        cancellation_acknowledged_at IS NULL
        OR cancellation_requested_at IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_run_controls_active_lease
    ON public.run_controls (worker_lease_expires_at)
    WHERE worker_lease_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_run_controls_cancel_requested
    ON public.run_controls (cancellation_requested_at)
    WHERE cancellation_requested_at IS NOT NULL
      AND cancellation_acknowledged_at IS NULL;

CREATE TABLE IF NOT EXISTS public.delivery_ledger (
    delivery_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_key          text NOT NULL,
    channel            text NOT NULL CHECK (channel IN ('in_app', 'email', 'telegram', 'whatsapp')),
    payload            jsonb NOT NULL DEFAULT '{}'::jsonb,
    status             text NOT NULL DEFAULT 'queued'
                       CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'suppressed')),
    provider_message_id text,
    attempt_count      integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    last_error         text,
    available_at       timestamptz NOT NULL DEFAULT now(),
    sent_at            timestamptz,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, event_key, channel)
);

CREATE INDEX IF NOT EXISTS idx_delivery_ledger_dispatch
    ON public.delivery_ledger (status, available_at)
    WHERE status IN ('queued', 'failed');
CREATE INDEX IF NOT EXISTS idx_delivery_ledger_user_created
    ON public.delivery_ledger (user_id, created_at DESC);

-- The API and workers run through server credentials. RLS prevents accidental
-- direct-client reads across candidates if these tables are later exposed.
ALTER TABLE public.run_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.run_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS run_events_owner_select ON public.run_events;
CREATE POLICY run_events_owner_select ON public.run_events
    FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS run_controls_owner_select ON public.run_controls;
CREATE POLICY run_controls_owner_select ON public.run_controls
    FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS delivery_ledger_owner_select ON public.delivery_ledger;
CREATE POLICY delivery_ledger_owner_select ON public.delivery_ledger
    FOR SELECT USING (auth.uid() = user_id);

-- Candidates may read only their RLS-scoped evidence.  Writes are exclusively
-- performed by the authenticated gateway/workers using service-role credentials.
GRANT SELECT ON TABLE public.run_events TO authenticated;
GRANT ALL ON TABLE public.run_events TO service_role;
GRANT SELECT ON TABLE public.run_controls TO authenticated;
GRANT ALL ON TABLE public.run_controls TO service_role;
GRANT SELECT ON TABLE public.delivery_ledger TO authenticated;
GRANT ALL ON TABLE public.delivery_ledger TO service_role;

COMMIT;
