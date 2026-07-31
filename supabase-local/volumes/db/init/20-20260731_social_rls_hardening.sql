-- ==========================================================================
-- Self-hosted RLS hardening for 20260731_social_privacy_preferences.sql tables
-- ==========================================================================
-- 20260731_social_privacy_preferences.sql (already committed — not edited in
-- place here) creates public.connections, shared_interview_questions,
-- question_upvotes, application_outcomes, and privacy_audit_log WITHOUT
-- enabling RLS, on the stated rationale that "the Go backend connects as a
-- superuser (bypasses RLS anyway) and does its own WHERE user_id=$1 checks
-- in-handler". That's true for the Go gateway, but not for PostgREST: the
-- self-hosted stack's `rest` service (supabase-local/docker-compose.yml)
-- connects as `authenticator` and switches to `anon`/`authenticated` per
-- request based on the caller's JWT, and Supabase's default bootstrap grants
-- those roles full table privileges on every `public` table. Verified live
-- against the running self-hosted stack:
--
--   SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants
--   WHERE table_schema='public' AND table_name IN
--     ('connections','shared_interview_questions','question_upvotes',
--      'application_outcomes','privacy_audit_log')
--     AND grantee IN ('anon','authenticated');
--
-- returned full SELECT/INSERT/UPDATE/DELETE for BOTH anon (unauthenticated!)
-- and authenticated on all five tables — including privacy_audit_log, the
-- GDPR Article 30 append-only ledger. Without RLS, any caller with an anon
-- key (no login required) could read or write every user's connections,
-- shared interview answers, upvotes, application outcomes, and audit log
-- straight through PostgREST. This closes that gap.
--
-- Policy logic mirrors supabase/migrations/20260731_social_graph.sql (the
-- Supabase-Cloud-path counterpart of these same tables) and
-- supabase/migrations/20260731_privacy_audit_log.sql, translated to the
-- explicit `TO authenticated` role-scoping idiom already established in
-- backend/db/migrations/20260731_self_hosted_rls_hardening.sql, rather than
-- relying on auth.uid() IS NULL to implicitly lock out `anon` the way the
-- Cloud-path file does — both are correct, but explicit is the convention
-- already in this directory.
-- ==========================================================================

-- ---- connections -----------------------------------------------------
-- trg_connections_lock_identity already exists (created in
-- 20260731_social_privacy_preferences.sql) — not recreated here.
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "connections_select" ON public.connections;
CREATE POLICY "connections_select" ON public.connections
    FOR SELECT TO authenticated
    USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

DROP POLICY IF EXISTS "connections_insert" ON public.connections;
CREATE POLICY "connections_insert" ON public.connections
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "connections_update" ON public.connections;
CREATE POLICY "connections_update" ON public.connections
    FOR UPDATE TO authenticated
    USING (auth.uid() = addressee_id AND status = 'pending')
    WITH CHECK (auth.uid() = addressee_id AND status IN ('accepted', 'rejected'));

DROP POLICY IF EXISTS "connections_delete" ON public.connections;
CREATE POLICY "connections_delete" ON public.connections
    FOR DELETE TO authenticated
    USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- ---- shared_interview_questions ---------------------------------------
ALTER TABLE public.shared_interview_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "siq_own" ON public.shared_interview_questions;
CREATE POLICY "siq_own" ON public.shared_interview_questions
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 'public' means public — intentionally NOT scoped to authenticated,
-- matching supabase/migrations/20260731_social_graph.sql's siq_public_read
-- exactly (applies to all roles, including anon).
DROP POLICY IF EXISTS "siq_public_read" ON public.shared_interview_questions;
CREATE POLICY "siq_public_read" ON public.shared_interview_questions
    FOR SELECT
    USING (visibility = 'public');

DROP POLICY IF EXISTS "siq_connections_read" ON public.shared_interview_questions;
CREATE POLICY "siq_connections_read" ON public.shared_interview_questions
    FOR SELECT TO authenticated
    USING (
        visibility = 'connections' AND (
            auth.uid() = user_id OR
            EXISTS (
                SELECT 1 FROM public.connections c
                WHERE c.status = 'accepted'
                  AND (
                    (c.requester_id = auth.uid() AND c.addressee_id = user_id) OR
                    (c.addressee_id = auth.uid() AND c.requester_id = user_id)
                  )
            )
        )
    );

-- ---- question_upvotes --------------------------------------------------
ALTER TABLE public.question_upvotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "question_upvotes_own" ON public.question_upvotes;
CREATE POLICY "question_upvotes_own" ON public.question_upvotes
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Separate FOR SELECT policy so aggregate upvote-count queries (COUNT(*)
-- grouped by question_id, e.g. for the feed's vote tallies) can see every
-- user's vote, not just the caller's own row. Postgres RLS: multiple
-- permissive policies for the same command combine with OR, and a FOR ALL
-- policy plus an additional FOR SELECT policy is a normal, correct pattern
-- — INSERT/UPDATE/DELETE stay governed solely by question_upvotes_own above.
-- Same fix applied to the Cloud-path schema (supabase/migrations/
-- 20260731_social_graph.sql) in the same round.
DROP POLICY IF EXISTS "question_upvotes_read_all" ON public.question_upvotes;
CREATE POLICY "question_upvotes_read_all" ON public.question_upvotes
    FOR SELECT TO authenticated
    USING (true);

-- ---- application_outcomes ----------------------------------------------
ALTER TABLE public.application_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "outcomes_own" ON public.application_outcomes;
CREATE POLICY "outcomes_own" ON public.application_outcomes
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ---- privacy_audit_log --------------------------------------------------
-- Only the Go backend's superuser connection writes this table (append-only,
-- GDPR Article 30 — see routes_account.go's cascadeQueries comment). No
-- client role gets INSERT/UPDATE/DELETE, at either the grant or policy
-- level. Users MAY read their own rows (there is no current PostgREST-direct
-- caller for this — Go's handleExportAccount reads it via its own superuser
-- connection — but the Cloud-path schema's equivalent, supabase/migrations/
-- 20260731_privacy_audit_log.sql, grants SELECT-of-own-rows, so this mirrors
-- that rather than a gmail_tokens-style total deny-all).
REVOKE ALL ON public.privacy_audit_log FROM anon;
REVOKE ALL ON public.privacy_audit_log FROM authenticated;
GRANT SELECT ON public.privacy_audit_log TO authenticated;

ALTER TABLE public.privacy_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pal_own" ON public.privacy_audit_log;
CREATE POLICY "pal_own" ON public.privacy_audit_log
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- ---- updated_at triggers -------------------------------------------------
-- connections, shared_interview_questions, and application_outcomes all
-- have an updated_at column but no trigger to maintain it (conversations,
-- created in the same original file, already has one — this copies that
-- exact pattern). The Go backend sets updated_at=NOW() explicitly on its
-- own UPDATEs today, so this is belt-and-suspenders for those paths, and the
-- real backstop for any future PostgREST-direct client update.
DROP TRIGGER IF EXISTS connections_set_updated_at ON public.connections;
CREATE TRIGGER connections_set_updated_at
    BEFORE UPDATE ON public.connections
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS shared_interview_questions_set_updated_at ON public.shared_interview_questions;
CREATE TRIGGER shared_interview_questions_set_updated_at
    BEFORE UPDATE ON public.shared_interview_questions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS application_outcomes_set_updated_at ON public.application_outcomes;
CREATE TRIGGER application_outcomes_set_updated_at
    BEFORE UPDATE ON public.application_outcomes
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
