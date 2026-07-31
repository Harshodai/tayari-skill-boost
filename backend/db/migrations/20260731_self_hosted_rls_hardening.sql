-- ==========================================================================
-- Self-hosted RLS hardening for 00-init-schema.sql tables
-- ==========================================================================
-- 00-init-schema.sql (backend/db/init.sql / supabase-local/volumes/db/init/
-- 00-init-schema.sql) creates public.profiles, resumes, job_descriptions,
-- analysis_results, resume_versions, user_roles, resume_analyses,
-- auth_attempts, user_achievements, and user_streaks WITHOUT enabling RLS.
--
-- That's safe for the Go backend, which connects as the `postgres` superuser
-- and does its own `WHERE user_id=$1` checks in-handler (RLS never applies
-- to a superuser connection either way). It is NOT safe for PostgREST: the
-- self-hosted stack's `rest` service (supabase-local/docker-compose.yml)
-- connects as `authenticator` and switches to the `anon`/`authenticated`
-- roles per-request based on the caller's JWT, and Supabase's default
-- bootstrap grants those roles full table privileges on every `public`
-- table. Verified live against the running self-hosted stack:
--
--   SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants
--   WHERE table_schema='public' AND table_name IN ('profiles','applications','resumes')
--     AND grantee IN ('anon','authenticated');
--
-- returns SELECT/INSERT/UPDATE/DELETE for BOTH anon and authenticated on
-- every one of these tables. Several MCP tools (src/lib/mcp/tools/
-- get-pipeline.ts, get-profile.ts, list-applications.ts, search-jobs.ts,
-- save-job.ts) create a Supabase client with the caller's JWT and query
-- these exact tables via PostgREST — i.e. this is a real, live client-side
-- exposure path, not a theoretical one. Without RLS, any authenticated user
-- (and, for anon-readable rows, any unauthenticated caller) can read or
-- write every other user's profile/resume/analysis data straight through
-- PostgREST, bypassing the Go backend's own per-request ownership checks
-- entirely.
--
-- Mirrors the RLS/ownership-policy shape already used for the same tables
-- in the Supabase-Cloud-path schema (see supabase/migrations/
-- 20260111165801_*.sql, 20260118070026_*.sql, 20260118110049_*.sql,
-- 20260120000000_secure_auth_and_profiles.sql, and
-- 20260201120000_enable_rbac_and_hardening.sql) — resumes, job_descriptions,
-- analysis_results, and resume_versions have no Cloud-path equivalent to
-- mirror (self-hosted-only tables), so their policies below follow the same
-- owner-match idiom used everywhere else in this file.
--
-- Scope note: this migration only covers the 10 tables created by
-- 00-init-schema.sql. A repo-wide audit found NO other init file
-- (01-mvp-additions.sql .. 17-seed-tenants.sql) enables RLS either — that
-- is a materially larger follow-up, deliberately left out of this pass.
-- ==========================================================================

-- ---- profiles --------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ---- resumes -----------------------------------------------------------
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resumes_all_own" ON public.resumes;
CREATE POLICY "resumes_all_own" ON public.resumes
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ---- job_descriptions ----------------------------------------------------
ALTER TABLE public.job_descriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_descriptions_all_own" ON public.job_descriptions;
CREATE POLICY "job_descriptions_all_own" ON public.job_descriptions
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ---- analysis_results ----------------------------------------------------
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analysis_results_all_own" ON public.analysis_results;
CREATE POLICY "analysis_results_all_own" ON public.analysis_results
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ---- resume_versions -------------------------------------------------
-- No user_id column here — ownership is via resume_id -> resumes.user_id.
ALTER TABLE public.resume_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resume_versions_all_own" ON public.resume_versions;
CREATE POLICY "resume_versions_all_own" ON public.resume_versions
    FOR ALL TO authenticated
    USING (resume_id IN (SELECT id FROM public.resumes WHERE user_id = auth.uid()))
    WITH CHECK (resume_id IN (SELECT id FROM public.resumes WHERE user_id = auth.uid()));

-- ---- user_roles ------------------------------------------------------
-- Users may read their own role assignment; only service_role may write,
-- to prevent a client from self-granting 'admin' via a raw PostgREST INSERT.
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles_select_own" ON public.user_roles;
CREATE POLICY "user_roles_select_own" ON public.user_roles
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_roles_service_role_manages" ON public.user_roles;
CREATE POLICY "user_roles_service_role_manages" ON public.user_roles
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- ---- resume_analyses -------------------------------------------------
ALTER TABLE public.resume_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resume_analyses_select_own" ON public.resume_analyses;
CREATE POLICY "resume_analyses_select_own" ON public.resume_analyses
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "resume_analyses_insert_own" ON public.resume_analyses;
CREATE POLICY "resume_analyses_insert_own" ON public.resume_analyses
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "resume_analyses_update_own" ON public.resume_analyses;
CREATE POLICY "resume_analyses_update_own" ON public.resume_analyses
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "resume_analyses_delete_own" ON public.resume_analyses;
CREATE POLICY "resume_analyses_delete_own" ON public.resume_analyses
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- ---- auth_attempts -----------------------------------------------------
-- No user_id (keyed by email, used for login rate-limiting) — never
-- client-readable or client-writable. Mirrors the Cloud-path
-- "Deny all access" policy in supabase/migrations/20260120000000_
-- secure_auth_and_profiles.sql. Only the Go backend's superuser
-- connection (which bypasses RLS) reads/writes this table.
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.auth_attempts FROM anon;
REVOKE ALL ON public.auth_attempts FROM authenticated;
REVOKE ALL ON public.auth_attempts FROM PUBLIC;

DROP POLICY IF EXISTS "auth_attempts_deny_all" ON public.auth_attempts;
CREATE POLICY "auth_attempts_deny_all" ON public.auth_attempts
    FOR ALL TO public
    USING (false)
    WITH CHECK (false);

-- ---- user_achievements -------------------------------------------------
-- Read-only for the owner; achievements are only ever awarded server-side
-- (Go superuser connection), so there's no client-facing INSERT/UPDATE/DELETE
-- policy — matches supabase/migrations/20260118110049_*.sql / 20260201120000_*.sql.
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_achievements_select_own" ON public.user_achievements;
CREATE POLICY "user_achievements_select_own" ON public.user_achievements
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- ---- user_streaks --------------------------------------------------------
-- Read-only for the owner; streaks are only ever updated server-side
-- (Go superuser connection) — matches supabase/migrations/20260118110049_*.sql.
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_streaks_select_own" ON public.user_streaks;
CREATE POLICY "user_streaks_select_own" ON public.user_streaks
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
