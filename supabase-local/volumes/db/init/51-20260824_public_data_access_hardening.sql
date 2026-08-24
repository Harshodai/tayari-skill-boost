-- ============================================================================
-- Public data access hardening: complete the self-hosted Supabase RLS boundary
-- ============================================================================
--
-- Why this exists
-- ---------------
-- Supabase's authenticator can assume the anon/authenticated roles for every
-- PostgREST request. Those roles have broad bootstrap grants on public tables,
-- so a table with RLS disabled is directly readable and writable via PostgREST,
-- bypassing the Go gateway's ownership checks.
--
-- This migration is deliberately fail-closed. Every listed table is put behind
-- RLS, browser roles lose all grants by default, and only narrowly necessary
-- reads/writes are re-granted with an explicit policy. Go/Python workers use the
-- postgres/service_role boundary and retain server-side access.
--
-- The migration is idempotent and also removes any pre-existing policy on the
-- protected tables so that a stale permissive policy cannot survive a deploy.
-- ============================================================================

BEGIN;

-- Utility used by the blocks below: remove every existing policy on a table
-- before applying the intended least-privilege policy set.
CREATE OR REPLACE FUNCTION public.drop_all_policies(target_table TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    existing_policy TEXT;
BEGIN
    FOR existing_policy IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = target_table
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', existing_policy, target_table);
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.drop_all_policies(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.drop_all_policies(TEXT) TO service_role;

-- Owner-scoped records that browser clients may read after authentication. All
-- mutation remains server-only: the Go/Python services validate business rules,
-- approval state, and immutable audit fields before writing.
DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'agent_router_events',
        'agent_runs',
        'agent_task_attempts',
        'agent_tasks',
        'applications',
        'autopilot_runs',
        'autopilot_schedules',
        'communications',
        'conversations',
        'digital_employees',
        'hermes_sessions',
        'interview_sessions',
        'job_watches',
        'review_queue_history',
        'runtime_approvals',
        'saved_posts',
        'saved_sources',
        'source_chunks',
        'user_job_feedback',
        'user_portals',
        'user_skill_analyses',
        'user_subscriptions'
    ] LOOP
        IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
            PERFORM public.drop_all_policies(table_name);
            EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated, PUBLIC', table_name);
            EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', table_name);
            EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', table_name);
            EXECUTE format(
                'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (auth.uid() = user_id)',
                table_name || '_owner_select',
                table_name
            );
        END IF;
    END LOOP;
END;
$$;

-- Push subscriptions are the sole owner-scoped table in this set that needs a
-- direct client mutation path for browser notification registration.
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
SELECT public.drop_all_policies('push_subscriptions');
REVOKE ALL ON TABLE public.push_subscriptions FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_subscriptions TO authenticated;
GRANT ALL ON TABLE public.push_subscriptions TO service_role;
CREATE POLICY push_subscriptions_owner_all ON public.push_subscriptions
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Tenant data needs relationship-based access rather than a simple user_id.
-- These SECURITY DEFINER helpers avoid recursive RLS evaluation while exposing
-- no membership rows by themselves.
CREATE OR REPLACE FUNCTION public.is_tenant_member(target_tenant UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.memberships
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
        SELECT 1
        FROM public.memberships
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
SELECT public.drop_all_policies('tenants');
REVOKE ALL ON TABLE public.tenants FROM anon, authenticated, PUBLIC;
GRANT SELECT ON TABLE public.tenants TO authenticated;
GRANT ALL ON TABLE public.tenants TO service_role;
CREATE POLICY tenants_member_select ON public.tenants
    FOR SELECT TO authenticated
    USING (public.is_tenant_member(id));

ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;
SELECT public.drop_all_policies('cohorts');
REVOKE ALL ON TABLE public.cohorts FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cohorts TO authenticated;
GRANT ALL ON TABLE public.cohorts TO service_role;
CREATE POLICY cohorts_member_select ON public.cohorts
    FOR SELECT TO authenticated
    USING (public.is_tenant_member(tenant_id));
CREATE POLICY cohorts_admin_write ON public.cohorts
    FOR ALL TO authenticated
    USING (public.is_tenant_admin(tenant_id))
    WITH CHECK (public.is_tenant_admin(tenant_id));

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
SELECT public.drop_all_policies('memberships');
REVOKE ALL ON TABLE public.memberships FROM anon, authenticated, PUBLIC;
GRANT SELECT ON TABLE public.memberships TO authenticated;
GRANT ALL ON TABLE public.memberships TO service_role;
CREATE POLICY memberships_owner_or_admin_select ON public.memberships
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id OR public.is_tenant_admin(tenant_id));

-- Blog pages are public by design, but only content that has actually been
-- published may be read through the browser-facing REST API.
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
SELECT public.drop_all_policies('blog_posts');
REVOKE ALL ON TABLE public.blog_posts FROM anon, authenticated, PUBLIC;
GRANT SELECT ON TABLE public.blog_posts TO anon, authenticated;
GRANT ALL ON TABLE public.blog_posts TO service_role;
CREATE POLICY blog_posts_published_select ON public.blog_posts
    FOR SELECT TO anon, authenticated
    USING (published_at IS NOT NULL AND published_at <= NOW());

-- Sensitive, operational, or indirectly-owned tables have no supported direct
-- browser access. RLS with no policy plus zero browser grants means a future
-- client-side query fails closed instead of exposing another user's records.
DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'ab_testing_bandit',
        'agent_action_approvals',
        'api_keys',
        'api_usage',
        'candidate_agent_audit_logs',
        'interview_scores',
        'oauth_states',
        'password_reset_tokens',
        'resume_variants',
        'scraped_jobs'
    ] LOOP
        IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
            PERFORM public.drop_all_policies(table_name);
            EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated, PUBLIC', table_name);
            EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', table_name);
        END IF;
    END LOOP;
END $$;

-- The helper is needed only while this migration runs; do not retain a mutable
-- policy-management function in the application schema after commit.
DROP FUNCTION public.drop_all_policies(TEXT);

COMMIT;
