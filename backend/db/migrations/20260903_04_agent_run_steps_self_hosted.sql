-- Migration: 20260903_04_agent_run_steps_self_hosted.sql
-- WP-14: Self-Hosted Parity for agent_run_steps

BEGIN;

CREATE TABLE IF NOT EXISTS public.agent_run_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  user_id UUID NOT NULL,
  idx INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  detail TEXT,
  logs TEXT,
  screenshot_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_run_steps_run ON public.agent_run_steps (run_id, idx);
CREATE INDEX IF NOT EXISTS idx_agent_run_steps_user ON public.agent_run_steps (user_id);

ALTER TABLE public.agent_run_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_run_steps FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'agent_run_steps'
      AND policyname = 'agent_run_steps own'
  ) THEN
    CREATE POLICY "agent_run_steps own" ON public.agent_run_steps
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_agent_run_steps_updated'
      AND tgrelid = 'public.agent_run_steps'::regclass
  ) THEN
    CREATE TRIGGER trg_agent_run_steps_updated
      BEFORE UPDATE ON public.agent_run_steps
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_run_steps TO authenticated;
GRANT ALL ON public.agent_run_steps TO service_role;

COMMIT;
