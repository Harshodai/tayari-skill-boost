-- Reconcile the original agent_runs schema with the Python runtime contract.
-- `backend/db/migrations/20260620_hermes_agents.sql` is the canonical
-- source for agent_runs and already defines run_id as UUID, run_type,
-- parent_run_id, config, logs, screenshots, result, error, engine,
-- celery_task_id, started_at, completed_at, created_at, and updated_at.
-- Do not reference a legacy `id` column or attempt to change run_id's type.
CREATE UNIQUE INDEX IF NOT EXISTS agent_runs_run_id_uidx ON public.agent_runs(run_id);
CREATE INDEX IF NOT EXISTS agent_runs_user_created_idx
  ON public.agent_runs(user_id, created_at DESC);

-- Versioned, owner-scoped answer snapshots. Sensitive values are never global.
CREATE TABLE IF NOT EXISTS public.candidate_answer_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  version INTEGER NOT NULL,
  application_id TEXT,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, version)
);

CREATE TABLE IF NOT EXISTS public.candidate_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.candidate_answer_versions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  field_key TEXT NOT NULL,
  value TEXT,
  sensitivity_class TEXT NOT NULL DEFAULT 'ordinary'
    CHECK (sensitivity_class IN ('legal','compensation','eeo','identity','ordinary')),
  provenance_type TEXT NOT NULL DEFAULT 'user_entered'
    CHECK (provenance_type IN ('user_entered','verified_profile','application_specific','unset')),
  provenance_ref TEXT,
  answer_hash TEXT,
  confirmed_for_application BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(version_id, field_key)
);

CREATE INDEX IF NOT EXISTS candidate_answer_versions_owner_idx
  ON public.candidate_answer_versions(user_id, version DESC);
CREATE INDEX IF NOT EXISTS candidate_answers_owner_idx
  ON public.candidate_answers(user_id, field_key);

ALTER TABLE public.candidate_answer_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_answers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'own candidate answer versions' AND tablename = 'candidate_answer_versions') THEN
    CREATE POLICY "own candidate answer versions" ON public.candidate_answer_versions
      FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'own candidate answers' AND tablename = 'candidate_answers') THEN
    CREATE POLICY "own candidate answers" ON public.candidate_answers
      FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_candidate_answer_versions_updated'
      AND tgrelid = 'public.candidate_answer_versions'::regclass
  ) THEN
    CREATE TRIGGER trg_candidate_answer_versions_updated
      BEFORE UPDATE ON public.candidate_answer_versions
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_candidate_answers_updated'
      AND tgrelid = 'public.candidate_answers'::regclass
  ) THEN
    CREATE TRIGGER trg_candidate_answers_updated
      BEFORE UPDATE ON public.candidate_answers
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS state_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS handoff_state TEXT,
  ADD COLUMN IF NOT EXISTS handoff_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS handoff_expires_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS agent_runs_handoff_state_idx
  ON public.agent_runs(user_id, handoff_state)
  WHERE handoff_state IS NOT NULL;

ALTER TABLE public.agent_questions
  ADD COLUMN IF NOT EXISTS normalized_field_key TEXT,
  ADD COLUMN IF NOT EXISTS sensitivity_class TEXT NOT NULL DEFAULT 'legal',
  ADD COLUMN IF NOT EXISTS required_for_state TEXT NOT NULL DEFAULT 'needs_sensitive_answer',
  ADD COLUMN IF NOT EXISTS redacted_context TEXT,
  ADD COLUMN IF NOT EXISTS application_id TEXT,
  ADD COLUMN IF NOT EXISTS provenance_type TEXT NOT NULL DEFAULT 'unset',
  ADD COLUMN IF NOT EXISTS answer_hash TEXT,
  ADD COLUMN IF NOT EXISTS answer_version INTEGER,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS agent_questions_owner_key_idx
  ON public.agent_questions(user_id, normalized_field_key, status);

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS submission_verification_status TEXT NOT NULL DEFAULT 'unverified'
  CHECK (submission_verification_status IN ('unverified', 'verified', 'failed'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_answer_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_answers TO authenticated;
