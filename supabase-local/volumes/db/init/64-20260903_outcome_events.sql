-- Migration: 20260903_02_outcome_events.sql
-- WP-09: Outcome Learning Loop

BEGIN;

CREATE TABLE IF NOT EXISTS public.outcome_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    application_run_id UUID REFERENCES public.application_runs(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('saved', 'rejected', 'applied', 'interviewing', 'declined', 'offer', 'hired')),
    is_candidate_confirmed BOOLEAN NOT NULL DEFAULT true,
    is_externally_verified BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outcome_events_user_id ON public.outcome_events (user_id);
CREATE INDEX IF NOT EXISTS idx_outcome_events_app_run_id ON public.outcome_events (application_run_id);
CREATE INDEX IF NOT EXISTS idx_outcome_events_event_type ON public.outcome_events (event_type);
CREATE INDEX IF NOT EXISTS idx_outcome_events_created_at ON public.outcome_events (created_at DESC);

ALTER TABLE public.outcome_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outcome_events FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'outcome_events'
      AND policyname = 'outcome_events_select'
  ) THEN
    CREATE POLICY "outcome_events_select" ON public.outcome_events
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'outcome_events'
      AND policyname = 'outcome_events_insert'
  ) THEN
    CREATE POLICY "outcome_events_insert" ON public.outcome_events
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id AND is_externally_verified = false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'outcome_events'
      AND policyname = 'outcome_events_update'
  ) THEN
    CREATE POLICY "outcome_events_update" ON public.outcome_events
      FOR UPDATE TO authenticated
      USING (auth.uid() = user_id AND is_externally_verified = false)
      WITH CHECK (auth.uid() = user_id AND is_externally_verified = false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'outcome_events'
      AND policyname = 'outcome_events_delete'
  ) THEN
    CREATE POLICY "outcome_events_delete" ON public.outcome_events
      FOR DELETE TO authenticated
      USING (auth.uid() = user_id AND is_externally_verified = false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'outcome_events'
      AND policyname = 'outcome_events_service_role'
  ) THEN
    CREATE POLICY "outcome_events_service_role" ON public.outcome_events
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.outcome_events TO authenticated;
GRANT ALL ON public.outcome_events TO service_role;

COMMIT;
