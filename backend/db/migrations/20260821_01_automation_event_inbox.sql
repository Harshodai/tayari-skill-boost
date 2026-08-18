BEGIN;

ALTER TABLE public.automation_runs
    ADD COLUMN IF NOT EXISTS trigger_event_id UUID,
    ADD COLUMN IF NOT EXISTS definition_version BIGINT NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_automation_runs_trigger_event
    ON public.automation_runs (trigger_event_id, tenant_id, user_id);

CREATE TABLE IF NOT EXISTS public.automation_event_inbox (
    event_id         UUID PRIMARY KEY,
    tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type       TEXT NOT NULL CHECK (length(trim(event_type)) BETWEEN 1 AND 160),
    source           TEXT NOT NULL CHECK (length(trim(source)) BETWEEN 1 AND 160),
    occurred_at      TIMESTAMPTZ NOT NULL,
    payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
    status           TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','dispatching','dispatched','ignored','failed')),
    attempt_count    INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    next_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error       TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_event_inbox_due
    ON public.automation_event_inbox (status, next_attempt_at, created_at)
    WHERE status IN ('received','failed');
CREATE INDEX IF NOT EXISTS idx_automation_event_inbox_owner
    ON public.automation_event_inbox (tenant_id, user_id, created_at DESC);

ALTER TABLE public.automation_event_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_event_inbox FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS automation_event_inbox_owner_access ON public.automation_event_inbox;
CREATE POLICY automation_event_inbox_owner_access ON public.automation_event_inbox FOR ALL TO authenticated
    USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = auth.uid() AND m.tenant_id = public.automation_event_inbox.tenant_id))
    WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = auth.uid() AND m.tenant_id = public.automation_event_inbox.tenant_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_event_inbox TO authenticated;
GRANT ALL ON public.automation_event_inbox TO service_role;

CREATE TRIGGER automation_event_inbox_updated_at BEFORE UPDATE ON public.automation_event_inbox FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMIT;
