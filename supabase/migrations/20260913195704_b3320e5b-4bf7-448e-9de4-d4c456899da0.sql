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
    EXECUTE 'GRANT SELECT, DELETE ON TABLE public.api_keys TO authenticated';
    EXECUTE 'ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS api_keys_owner_ro ON public.api_keys';
    EXECUTE 'DROP POLICY IF EXISTS api_keys_owner_delete ON public.api_keys';
    EXECUTE 'CREATE POLICY api_keys_owner_ro ON public.api_keys FOR SELECT TO authenticated USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY api_keys_owner_delete ON public.api_keys FOR DELETE TO authenticated USING (user_id = auth.uid())';
  END IF;
END $$;