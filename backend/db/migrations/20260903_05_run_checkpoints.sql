-- Migration: 20260903_05_run_checkpoints.sql
-- WP-11: Durable Checkpoints — Checkpoint Store & State Rewind

BEGIN;

CREATE TABLE IF NOT EXISTS public.run_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL,
    user_id UUID,
    step_index INT NOT NULL,
    state_json JSONB NOT NULL,
    state_hash TEXT NOT NULL,
    approver_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (run_id, step_index)
);

CREATE INDEX IF NOT EXISTS idx_run_checkpoints_run_id ON public.run_checkpoints (run_id);
CREATE INDEX IF NOT EXISTS idx_run_checkpoints_user_id ON public.run_checkpoints (user_id);
CREATE INDEX IF NOT EXISTS idx_run_checkpoints_run_step ON public.run_checkpoints (run_id, step_index);

ALTER TABLE public.run_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.run_checkpoints FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'run_checkpoints'
      AND policyname = 'run_checkpoints owner'
  ) THEN
    CREATE POLICY "run_checkpoints owner" ON public.run_checkpoints
      FOR ALL TO authenticated
      USING (
        (user_id IS NOT NULL AND auth.uid() = user_id)
        OR EXISTS (
          SELECT 1 FROM public.agent_runs ar
          WHERE ar.run_id = run_checkpoints.run_id AND ar.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.application_runs apr
          WHERE apr.id = run_checkpoints.run_id AND apr.user_id = auth.uid()
        )
        OR (approver_user_id IS NOT NULL AND approver_user_id = auth.uid())
      )
      WITH CHECK (
        (user_id IS NOT NULL AND auth.uid() = user_id)
        OR EXISTS (
          SELECT 1 FROM public.agent_runs ar
          WHERE ar.run_id = run_checkpoints.run_id AND ar.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.application_runs apr
          WHERE apr.id = run_checkpoints.run_id AND apr.user_id = auth.uid()
        )
      );
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.run_checkpoints TO authenticated;
GRANT ALL ON public.run_checkpoints TO service_role;

COMMIT;
