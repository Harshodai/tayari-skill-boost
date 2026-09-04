-- Migration: 20260903_01_canonical_application_state_machine.sql
-- WP-03: Canonical Application State Machine and Action Ledger

BEGIN;

CREATE TABLE IF NOT EXISTS public.application_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    job_id TEXT,
    resume_version_hash TEXT,
    cover_letter_version_hash TEXT,
    state TEXT NOT NULL CHECK (state IN ('prepared', 'reviewed', 'candidate_confirmed', 'approved', 'attempted', 'receipt_confirmed', 'externally_verified')),
    state_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    approval_token_id UUID,
    receipt_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_runs_user_id ON public.application_runs (user_id);
CREATE INDEX IF NOT EXISTS idx_application_runs_job_id ON public.application_runs (job_id);
CREATE INDEX IF NOT EXISTS idx_application_runs_state ON public.application_runs (state);

ALTER TABLE public.application_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_runs FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'application_runs'
      AND policyname = 'application_runs owner'
  ) THEN
    CREATE POLICY "application_runs owner" ON public.application_runs
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_application_runs_updated'
      AND tgrelid = 'public.application_runs'::regclass
  ) THEN
    CREATE TRIGGER trg_application_runs_updated
      BEFORE UPDATE ON public.application_runs
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.action_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES public.application_runs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    action_type TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    attempt_count INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending',
    receipt JSONB,
    external_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (run_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_action_ledger_run_id ON public.action_ledger (run_id);
CREATE INDEX IF NOT EXISTS idx_action_ledger_user_id ON public.action_ledger (user_id);
CREATE INDEX IF NOT EXISTS idx_action_ledger_idempotency ON public.action_ledger (run_id, idempotency_key);

ALTER TABLE public.action_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_ledger FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'action_ledger'
      AND policyname = 'action_ledger owner'
  ) THEN
    CREATE POLICY "action_ledger owner" ON public.action_ledger
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_runs TO authenticated;
GRANT ALL ON public.application_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_ledger TO authenticated;
GRANT ALL ON public.action_ledger TO service_role;

COMMIT;
