-- M2-08/M2-09: explicit tenant isolation for PostgREST and direct roles.
-- Server workers use service_role; browser clients receive only the rows
-- authorized by auth.uid() and tenant membership.
BEGIN;

CREATE OR REPLACE FUNCTION public.is_tenant_member(target_tenant UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.memberships
         WHERE tenant_id = target_tenant AND user_id = auth.uid()
    )
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(target_tenant UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.memberships
         WHERE tenant_id = target_tenant
           AND user_id = auth.uid()
           AND role = 'admin'
    )
$$;

REVOKE ALL ON FUNCTION public.is_tenant_member(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_tenant_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin(UUID) TO authenticated, service_role;

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenants_member_select ON public.tenants;
CREATE POLICY tenants_member_select ON public.tenants
    FOR SELECT TO authenticated
    USING (public.is_tenant_member(id));
GRANT SELECT ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;

ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cohorts_member_select ON public.cohorts;
CREATE POLICY cohorts_member_select ON public.cohorts
    FOR SELECT TO authenticated
    USING (public.is_tenant_member(tenant_id));
DROP POLICY IF EXISTS cohorts_admin_write ON public.cohorts;
CREATE POLICY cohorts_admin_write ON public.cohorts
    FOR ALL TO authenticated
    USING (public.is_tenant_admin(tenant_id))
    WITH CHECK (public.is_tenant_admin(tenant_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cohorts TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.cohorts_id_seq TO authenticated;
GRANT ALL ON public.cohorts TO service_role;

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS memberships_owner_or_admin_select ON public.memberships;
CREATE POLICY memberships_owner_or_admin_select ON public.memberships
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id OR public.is_tenant_admin(tenant_id));
GRANT SELECT ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_subscriptions_owner_all ON public.push_subscriptions;
CREATE POLICY push_subscriptions_owner_all ON public.push_subscriptions
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.push_subscriptions_id_seq TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

-- Automation records are readable by their owner; only the Python/Go services
-- may mutate them. This prevents direct PostgREST edits to run state, browser
-- cookies, tailored artifacts, or platform credentials.
DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'agent_runs', 'application_attempts', 'user_sessions',
        'tailored_resumes', 'platform_configs', 'runtime_approvals',
        'digital_employees', 'agent_tasks', 'agent_task_attempts',
        'agent_router_events'
    ] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
        EXECUTE format('GRANT SELECT ON public.%I TO authenticated', table_name);
        EXECUTE format('GRANT ALL ON public.%I TO service_role', table_name);
    END LOOP;
END $$;

DROP POLICY IF EXISTS agent_runs_owner_select ON public.agent_runs;
CREATE POLICY agent_runs_owner_select ON public.agent_runs
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS application_attempts_owner_select ON public.application_attempts;
CREATE POLICY application_attempts_owner_select ON public.application_attempts
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS user_sessions_owner_select ON public.user_sessions;
CREATE POLICY user_sessions_owner_select ON public.user_sessions
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS tailored_resumes_owner_select ON public.tailored_resumes;
CREATE POLICY tailored_resumes_owner_select ON public.tailored_resumes
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS platform_configs_owner_select ON public.platform_configs;
CREATE POLICY platform_configs_owner_select ON public.platform_configs
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS runtime_approvals_owner_select ON public.runtime_approvals;
CREATE POLICY runtime_approvals_owner_select ON public.runtime_approvals
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS digital_employees_owner_select ON public.digital_employees;
CREATE POLICY digital_employees_owner_select ON public.digital_employees
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS agent_tasks_owner_select ON public.agent_tasks;
CREATE POLICY agent_tasks_owner_select ON public.agent_tasks
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS agent_task_attempts_owner_select ON public.agent_task_attempts;
CREATE POLICY agent_task_attempts_owner_select ON public.agent_task_attempts
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS agent_router_events_owner_select ON public.agent_router_events;
CREATE POLICY agent_router_events_owner_select ON public.agent_router_events
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Application approval decisions are made through the authenticated API, which
-- uses the service role after checking the caller. Do not grant direct client
-- writes to the full row, since that would allow changing hashes or expiry.
ALTER TABLE public.application_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS application_approvals_all_own ON public.application_approvals;
DROP POLICY IF EXISTS application_approvals_owner_select ON public.application_approvals;
CREATE POLICY application_approvals_owner_select ON public.application_approvals
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
GRANT SELECT ON public.application_approvals TO authenticated;
GRANT ALL ON public.application_approvals TO service_role;

ALTER TABLE public.submission_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS submission_receipts_all_own ON public.submission_receipts;
DROP POLICY IF EXISTS submission_receipts_owner_select ON public.submission_receipts;
CREATE POLICY submission_receipts_owner_select ON public.submission_receipts
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
GRANT SELECT ON public.submission_receipts TO authenticated;
GRANT ALL ON public.submission_receipts TO service_role;

ALTER TABLE public.agent_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_questions_all_own ON public.agent_questions;
DROP POLICY IF EXISTS agent_questions_owner_all ON public.agent_questions;
CREATE POLICY agent_questions_owner_all ON public.agent_questions
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_questions TO authenticated;
GRANT ALL ON public.agent_questions TO service_role;

COMMIT;
