-- Tayari Computer control-plane records.
-- Grants contain hashes/identifiers only: never store browser cookies, profiles,
-- passwords, storage values, or raw page payloads in these tables.

CREATE TABLE IF NOT EXISTS public.computer_runs (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id            UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    mode                 TEXT NOT NULL CHECK (mode IN ('isolated', 'local_browser_bridge')),
    state                TEXT NOT NULL DEFAULT 'requested' CHECK (state IN (
        'requested', 'awaiting_approval', 'granted', 'running', 'revoked',
        'completed', 'failed', 'cancelled'
    )),
    capability           TEXT NOT NULL CHECK (capability IN (
        'workspace.isolated_computer',
        'workspace.local_browser_bridge',
        'workspace.local_browser_sensitive_actions'
    )),
    policy               JSONB NOT NULL DEFAULT '{}'::jsonb,
    provider             TEXT,
    selected_window_id   TEXT,
    selected_tab_id      TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at           TIMESTAMPTZ,
    revoked_at           TIMESTAMPTZ,
    UNIQUE (id, user_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS public.computer_grants (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id               UUID NOT NULL,
    user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id            UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    audience             TEXT NOT NULL,
    nonce                TEXT NOT NULL,
    issued_at            TIMESTAMPTZ NOT NULL,
    expires_at           TIMESTAMPTZ NOT NULL,
    mode                 TEXT NOT NULL CHECK (mode IN ('isolated', 'local_browser_bridge')),
    capability           TEXT NOT NULL,
    policy_hash          VARCHAR(64) NOT NULL CHECK (policy_hash ~ '^[0-9a-f]{64}$'),
    key_id               TEXT NOT NULL,
    revoked_at           TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (nonce),
    FOREIGN KEY (run_id, user_id, tenant_id)
        REFERENCES public.computer_runs(id, user_id, tenant_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.computer_run_events (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id               UUID NOT NULL,
    user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id            UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    action_id            UUID,
    idempotency_key      TEXT NOT NULL,
    event_type           TEXT NOT NULL CHECK (event_type IN (
        'run_requested', 'approval_requested', 'approval_granted',
        'grant_issued', 'bridge_attached', 'isolated_session_created',
        'observation_captured', 'action_requested', 'action_blocked',
        'action_executed', 'origin_changed', 'sensitive_confirmation_requested',
        'sensitive_confirmation_denied', 'revoked', 'stopped', 'released',
        'provider_destroyed', 'failed', 'completed'
    )),
    action_class         TEXT,
    origin               TEXT,
    observation_hash     VARCHAR(64) CHECK (observation_hash IS NULL OR observation_hash ~ '^[0-9a-f]{64}$'),
    payload_hash         VARCHAR(64) NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
    metadata             JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (run_id, user_id, tenant_id)
        REFERENCES public.computer_runs(id, user_id, tenant_id) ON DELETE CASCADE,
    UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_computer_runs_owner_state
    ON public.computer_runs(user_id, tenant_id, state, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_computer_grants_run_expiry
    ON public.computer_grants(run_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_computer_events_run_time
    ON public.computer_run_events(run_id, occurred_at ASC);
CREATE INDEX IF NOT EXISTS idx_computer_events_owner_type
    ON public.computer_run_events(user_id, tenant_id, event_type, occurred_at DESC);

REVOKE ALL ON TABLE public.computer_grants FROM anon, authenticated;
GRANT ALL ON TABLE public.computer_grants TO service_role;

REVOKE ALL ON TABLE public.computer_runs FROM anon;
REVOKE ALL ON TABLE public.computer_run_events FROM anon;
GRANT SELECT ON TABLE public.computer_runs TO authenticated;
GRANT SELECT ON TABLE public.computer_run_events TO authenticated;
GRANT ALL ON TABLE public.computer_runs TO service_role;
GRANT ALL ON TABLE public.computer_run_events TO service_role;

ALTER TABLE public.computer_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.computer_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.computer_run_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS computer_runs_owner_select ON public.computer_runs;
CREATE POLICY computer_runs_owner_select ON public.computer_runs
    FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.memberships m
            WHERE m.user_id = auth.uid() AND m.tenant_id = computer_runs.tenant_id
        )
    );
DROP POLICY IF EXISTS computer_runs_service_all ON public.computer_runs;
CREATE POLICY computer_runs_service_all ON public.computer_runs
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS computer_grants_service_all ON public.computer_grants;
CREATE POLICY computer_grants_service_all ON public.computer_grants
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS computer_run_events_owner_select ON public.computer_run_events;
CREATE POLICY computer_run_events_owner_select ON public.computer_run_events
    FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.memberships m
            WHERE m.user_id = auth.uid() AND m.tenant_id = computer_run_events.tenant_id
        )
    );
DROP POLICY IF EXISTS computer_run_events_service_all ON public.computer_run_events;
CREATE POLICY computer_run_events_service_all ON public.computer_run_events
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
