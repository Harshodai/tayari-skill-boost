BEGIN;

CREATE TABLE IF NOT EXISTS public.automation_definitions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
    objective       TEXT NOT NULL CHECK (length(trim(objective)) BETWEEN 1 AND 10000),
    trigger_type    TEXT NOT NULL CHECK (trigger_type IN ('manual','schedule','webhook','provider_event','approval_decision','task_event')),
    trigger_config  JSONB NOT NULL DEFAULT '{}'::jsonb,
    tool_allowlist  JSONB NOT NULL DEFAULT '[]'::jsonb,
    approval_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
    retention_days  INTEGER NOT NULL DEFAULT 90 CHECK (retention_days BETWEEN 1 AND 3650),
    budget          JSONB NOT NULL DEFAULT '{}'::jsonb,
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','disabled')),
    policy_version  TEXT NOT NULL DEFAULT 'v1',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automation_runs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    definition_id     UUID NOT NULL REFERENCES public.automation_definitions(id) ON DELETE CASCADE,
    tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status            TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','awaiting_action_approval','paused','resumed','completed','failed','cancelled','expired')),
    current_step      INTEGER NOT NULL DEFAULT 0,
    idempotency_key   TEXT NOT NULL,
    last_error        TEXT,
    started_at        TIMESTAMPTZ,
    completed_at      TIMESTAMPTZ,
    expires_at        TIMESTAMPTZ,
    version           BIGINT NOT NULL DEFAULT 1,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.automation_steps (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id              UUID NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sequence_no         INTEGER NOT NULL,
    step_type           TEXT NOT NULL,
    risk_tier           TEXT NOT NULL CHECK (risk_tier IN ('read','navigation','draft','sensitive','external_write','submission')),
    input_hash          TEXT NOT NULL,
    payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','awaiting_approval','approved','denied','completed','failed','cancelled','expired')),
    approval_id         UUID,
    external_request_id TEXT,
    provenance          JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (run_id, sequence_no)
);

CREATE TABLE IF NOT EXISTS public.automation_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id      UUID NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sequence_no BIGINT GENERATED ALWAYS AS IDENTITY,
    event_type  TEXT NOT NULL,
    payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (run_id, sequence_no)
);

CREATE TABLE IF NOT EXISTS public.approval_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id              UUID REFERENCES public.automation_runs(id) ON DELETE CASCADE,
    step_id             UUID REFERENCES public.automation_steps(id) ON DELETE CASCADE,
    task_id             UUID REFERENCES public.task_runs(id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type         TEXT NOT NULL,
    risk_tier           TEXT NOT NULL CHECK (risk_tier IN ('read','navigation','draft','sensitive','external_write','submission')),
    action_hash         TEXT NOT NULL,
    summary             TEXT NOT NULL CHECK (length(trim(summary)) BETWEEN 1 AND 2000),
    payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','viewed','approved','denied','expired','revoked','consumed','delivery_failed','superseded')),
    policy_version      TEXT NOT NULL DEFAULT 'v1',
    review_token_digest TEXT NOT NULL,
    token_expires_at    TIMESTAMPTZ NOT NULL,
    decision_channel    TEXT,
    decided_at          TIMESTAMPTZ,
    decided_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (review_token_digest)
);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email_enabled       BOOLEAN NOT NULL DEFAULT false,
    email_address       TEXT,
    whatsapp_enabled    BOOLEAN NOT NULL DEFAULT false,
    phone_e164          TEXT,
    whatsapp_opt_in_at  TIMESTAMPTZ,
    whatsapp_opt_out_at TIMESTAMPTZ,
    locale              TEXT NOT NULL DEFAULT 'en',
    quiet_hours         JSONB NOT NULL DEFAULT '{}'::jsonb,
    fallback_order      JSONB NOT NULL DEFAULT '["in_app"]'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_id          UUID NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
    tenant_id            UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel              TEXT NOT NULL CHECK (channel IN ('in_app','email','whatsapp')),
    provider             TEXT NOT NULL,
    status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','sent','delivered','read','bounced','complained','failed','suppressed','cancelled')),
    idempotency_key      TEXT NOT NULL,
    provider_message_id  TEXT,
    attempt_count        INTEGER NOT NULL DEFAULT 0,
    last_error           TEXT,
    redacted_subject     TEXT,
    sent_at              TIMESTAMPTZ,
    delivered_at         TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (approval_id, channel),
    UNIQUE (provider, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.notification_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id     UUID NOT NULL REFERENCES public.notification_deliveries(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider_event_id TEXT NOT NULL,
    event_type      TEXT NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_automation_definitions_owner ON public.automation_definitions(tenant_id, user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_owner ON public.automation_runs(tenant_id, user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_steps_run ON public.automation_steps(run_id, sequence_no);
CREATE INDEX IF NOT EXISTS idx_automation_events_run ON public.automation_events(run_id, sequence_no);
CREATE INDEX IF NOT EXISTS idx_approval_requests_owner ON public.approval_requests(tenant_id, user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_approval ON public.notification_deliveries(approval_id, status);
CREATE INDEX IF NOT EXISTS idx_notification_events_delivery ON public.notification_events(delivery_id, created_at DESC);

ALTER TABLE public.automation_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_definitions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.automation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_steps FORCE ROW LEVEL SECURITY;
ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS automation_definitions_owner_access ON public.automation_definitions;
CREATE POLICY automation_definitions_owner_access ON public.automation_definitions FOR ALL TO authenticated
    USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = auth.uid() AND m.tenant_id = public.automation_definitions.tenant_id))
    WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = auth.uid() AND m.tenant_id = public.automation_definitions.tenant_id));

DROP POLICY IF EXISTS automation_runs_owner_access ON public.automation_runs;
CREATE POLICY automation_runs_owner_access ON public.automation_runs FOR ALL TO authenticated
    USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = auth.uid() AND m.tenant_id = public.automation_runs.tenant_id))
    WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = auth.uid() AND m.tenant_id = public.automation_runs.tenant_id));

DROP POLICY IF EXISTS automation_steps_owner_access ON public.automation_steps;
CREATE POLICY automation_steps_owner_access ON public.automation_steps FOR ALL TO authenticated
    USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = auth.uid() AND m.tenant_id = public.automation_steps.tenant_id))
    WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = auth.uid() AND m.tenant_id = public.automation_steps.tenant_id));

DROP POLICY IF EXISTS automation_events_owner_access ON public.automation_events;
CREATE POLICY automation_events_owner_access ON public.automation_events FOR ALL TO authenticated
    USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = auth.uid() AND m.tenant_id = public.automation_events.tenant_id))
    WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = auth.uid() AND m.tenant_id = public.automation_events.tenant_id));

DROP POLICY IF EXISTS approval_requests_owner_access ON public.approval_requests;
CREATE POLICY approval_requests_owner_access ON public.approval_requests FOR ALL TO authenticated
    USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = auth.uid() AND m.tenant_id = public.approval_requests.tenant_id))
    WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = auth.uid() AND m.tenant_id = public.approval_requests.tenant_id));

DROP POLICY IF EXISTS notification_preferences_owner_access ON public.notification_preferences;
CREATE POLICY notification_preferences_owner_access ON public.notification_preferences FOR ALL TO authenticated
    USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = auth.uid() AND m.tenant_id = public.notification_preferences.tenant_id))
    WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = auth.uid() AND m.tenant_id = public.notification_preferences.tenant_id));

DROP POLICY IF EXISTS notification_deliveries_owner_access ON public.notification_deliveries;
CREATE POLICY notification_deliveries_owner_access ON public.notification_deliveries FOR ALL TO authenticated
    USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = auth.uid() AND m.tenant_id = public.notification_deliveries.tenant_id))
    WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = auth.uid() AND m.tenant_id = public.notification_deliveries.tenant_id));

DROP POLICY IF EXISTS notification_events_owner_access ON public.notification_events;
CREATE POLICY notification_events_owner_access ON public.notification_events FOR ALL TO authenticated
    USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = auth.uid() AND m.tenant_id = public.notification_events.tenant_id))
    WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = auth.uid() AND m.tenant_id = public.notification_events.tenant_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_definitions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_steps TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_deliveries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_events TO authenticated;
GRANT ALL ON public.automation_definitions TO service_role;
GRANT ALL ON public.automation_runs TO service_role;
GRANT ALL ON public.automation_steps TO service_role;
GRANT ALL ON public.automation_events TO service_role;
GRANT ALL ON public.approval_requests TO service_role;
GRANT ALL ON public.notification_preferences TO service_role;
GRANT ALL ON public.notification_deliveries TO service_role;
GRANT ALL ON public.notification_events TO service_role;

CREATE TRIGGER automation_definitions_updated_at BEFORE UPDATE ON public.automation_definitions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER automation_runs_updated_at BEFORE UPDATE ON public.automation_runs FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER automation_steps_updated_at BEFORE UPDATE ON public.automation_steps FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER approval_requests_updated_at BEFORE UPDATE ON public.approval_requests FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER notification_deliveries_updated_at BEFORE UPDATE ON public.notification_deliveries FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMIT;
