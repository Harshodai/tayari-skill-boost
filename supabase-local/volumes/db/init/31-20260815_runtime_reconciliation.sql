BEGIN;

CREATE TABLE IF NOT EXISTS public.task_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 240),
  objective text NOT NULL CHECK (length(trim(objective)) BETWEEN 1 AND 10000),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','planning','awaiting_plan_approval','queued','running','paused','awaiting_action_approval','awaiting_takeover','completed','stopped','failed')),
  stop_requested_at timestamptz,
  takeover_requested_at timestamptz,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.task_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version bigint NOT NULL DEFAULT 1,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','rejected','superseded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  UNIQUE(task_id, version)
);

CREATE TABLE IF NOT EXISTS public.task_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.task_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('allowed','denied','ask_each_time')),
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, permission)
);

CREATE TABLE IF NOT EXISTS public.action_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.task_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  risk_tier text NOT NULL CHECK (risk_tier IN ('read','navigation','draft','sensitive','external_write','submission')),
  site_origin text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied','expired','executed','failed')),
  decided_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.task_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sequence_no bigint GENERATED ALWAYS AS IDENTITY,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, sequence_no)
);

CREATE INDEX IF NOT EXISTS idx_task_runs_user_updated ON public.task_runs(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_plans_task_version ON public.task_plans(task_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_task_permissions_task ON public.task_permissions(task_id, permission);
CREATE INDEX IF NOT EXISTS idx_action_proposals_task_status ON public.action_proposals(task_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_task_events_task_sequence ON public.task_events(task_id, sequence_no);

ALTER TABLE public.task_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_runs_owner_access ON public.task_runs;
CREATE POLICY task_runs_owner_access ON public.task_runs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS task_plans_owner_access ON public.task_plans;
CREATE POLICY task_plans_owner_access ON public.task_plans
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS task_permissions_owner_access ON public.task_permissions;
CREATE POLICY task_permissions_owner_access ON public.task_permissions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS action_proposals_owner_access ON public.action_proposals;
CREATE POLICY action_proposals_owner_access ON public.action_proposals
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS task_events_owner_access ON public.task_events;
CREATE POLICY task_events_owner_access ON public.task_events
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_runs, public.task_plans, public.task_permissions, public.action_proposals, public.task_events TO authenticated;
GRANT ALL ON public.task_runs, public.task_plans, public.task_permissions, public.action_proposals, public.task_events TO service_role;

COMMIT;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_proposals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_events TO authenticated;
GRANT ALL ON public.task_plans TO service_role;
GRANT ALL ON public.task_permissions TO service_role;
GRANT ALL ON public.action_proposals TO service_role;
GRANT ALL ON public.task_events TO service_role;

-- Runtime reconciliation: verified owner-scoped answer snapshots.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE IF NOT EXISTS public.candidate_answer_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  application_id TEXT,
  confirmed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, version)
);

CREATE TABLE IF NOT EXISTS public.candidate_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.candidate_answer_versions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  value TEXT,
  sensitivity_class TEXT NOT NULL DEFAULT 'ordinary'
    CHECK (sensitivity_class IN ('legal','compensation','eeo','identity','ordinary')),
  provenance_type TEXT NOT NULL DEFAULT 'user_entered'
    CHECK (provenance_type IN ('user_entered','verified_profile','application_specific','unset')),
  provenance_ref TEXT,
  answer_hash TEXT,
  confirmed_for_application BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(version_id, field_key)
);

CREATE INDEX IF NOT EXISTS candidate_answer_versions_owner_idx
  ON public.candidate_answer_versions(user_id, version DESC);
CREATE INDEX IF NOT EXISTS candidate_answers_owner_idx
  ON public.candidate_answers(user_id, field_key);

ALTER TABLE public.candidate_answer_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_candidate_answer_versions ON public.candidate_answer_versions;
CREATE POLICY own_candidate_answer_versions ON public.candidate_answer_versions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS own_candidate_answers ON public.candidate_answers;
CREATE POLICY own_candidate_answers ON public.candidate_answers
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_candidate_answer_versions_updated ON public.candidate_answer_versions;
CREATE TRIGGER trg_candidate_answer_versions_updated
  BEFORE UPDATE ON public.candidate_answer_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_candidate_answers_updated ON public.candidate_answers;
CREATE TRIGGER trg_candidate_answers_updated
  BEFORE UPDATE ON public.candidate_answers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_answer_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_answers TO authenticated;

-- Runtime columns used by the authenticated Hermes control plane.
ALTER TABLE IF EXISTS public.agent_runs
  ADD COLUMN IF NOT EXISTS state_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS handoff_state TEXT,
  ADD COLUMN IF NOT EXISTS handoff_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS handoff_expires_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS public.agent_questions
  ADD COLUMN IF NOT EXISTS normalized_field_key TEXT,
  ADD COLUMN IF NOT EXISTS sensitivity_class TEXT NOT NULL DEFAULT 'legal',
  ADD COLUMN IF NOT EXISTS required_for_state TEXT NOT NULL DEFAULT 'needs_sensitive_answer',
  ADD COLUMN IF NOT EXISTS redacted_context TEXT,
  ADD COLUMN IF NOT EXISTS application_id TEXT,
  ADD COLUMN IF NOT EXISTS provenance_type TEXT NOT NULL DEFAULT 'unset',
  ADD COLUMN IF NOT EXISTS answer_hash TEXT,
  ADD COLUMN IF NOT EXISTS answer_version INTEGER,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS public.applications
  ADD COLUMN IF NOT EXISTS submission_verification_status TEXT NOT NULL DEFAULT 'unverified';
