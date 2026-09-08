-- 2026-09-07 — Forward fix: restore service-role-only posture on secret-bearing tables.
--
-- Regression: 20260815120000_harden_critical_public_tables.sql applied a blanket
-- "<table>_owner FOR ALL TO authenticated" template to password_reset_tokens and
-- api_keys, which had deliberately been service-role-only. That let any signed-in
-- session insert a self-chosen, never-expiring password-reset token (a persistence
-- backdoor) or mint/re-activate an api_keys row outside the key-issuance flow.
--
-- Idempotent and guarded: these tables only exist in the self-hosted schema.

DO $$
BEGIN
  IF to_regclass('public.password_reset_tokens') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.password_reset_tokens FROM authenticated, anon';
    EXECUTE 'DROP POLICY IF EXISTS password_reset_tokens_owner ON public.password_reset_tokens';
    EXECUTE 'GRANT ALL ON TABLE public.password_reset_tokens TO service_role';
    EXECUTE 'ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS password_reset_tokens_deny_all ON public.password_reset_tokens';
    EXECUTE 'CREATE POLICY password_reset_tokens_deny_all ON public.password_reset_tokens FOR ALL TO public USING (false) WITH CHECK (false)';
  END IF;

  IF to_regclass('public.api_keys') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.api_keys FROM authenticated, anon';
    EXECUTE 'DROP POLICY IF EXISTS api_keys_owner ON public.api_keys';
    EXECUTE 'GRANT ALL ON TABLE public.api_keys TO service_role';
    -- Owners may list and revoke their own keys; minting and re-activation stay server-side.
    EXECUTE 'GRANT SELECT, DELETE ON TABLE public.api_keys TO authenticated';
    EXECUTE 'ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS api_keys_owner_ro ON public.api_keys';
    EXECUTE 'DROP POLICY IF EXISTS api_keys_owner_delete ON public.api_keys';
    EXECUTE 'CREATE POLICY api_keys_owner_ro ON public.api_keys FOR SELECT TO authenticated USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY api_keys_owner_delete ON public.api_keys FOR DELETE TO authenticated USING (user_id = auth.uid())';
  END IF;
END $$;
