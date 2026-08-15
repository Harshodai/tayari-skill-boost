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
CREATE TABLE IF NOT EXISTS public.task_plans (CREATE TABLE IF NOT EXISTS public.task_plans (CREATE TABLE IF NOT EXISTS public.task_plans (CREA_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version bigint NOT NULL DEFAULT 1,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','rejected','superseded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  UNIQUE(task_id, vers  UNIQUE(task_id, vers  UNIQUE(task_id, vers  UNIQUE(task_id, vers  UNIQUE(tRY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.task_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('allowed','denied','ask_each_time')),
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tas  UNIQUE(tas  UNIQUE(tas  UNIQUE(tas  UNIQUE(tas  UNIQUE(tas  UNIQUE(tas  UNIQUE(tas  UNIQUE(tas  UNIQUE(tas  UNIQUE(tas  UNIQUE(tas  UNIQUE(tas  UNIQUE(tas  UNIQUE(task_r  UNIQUE(tas  UNIQUE(tas  UNIQUE(tas  UNIQUE(tas  UNIQUE(tas  Uuth.users(id) ON DELETE CASCADE,
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
ALTER TABLE public.task_permissions EALTER TABLE public.task_permissions EALTER TABLE public.task_permissioOW LEVEL SECURITY;
ALTER TABLE public.task_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS task_runs_owner_select ON DROP POLICY IF EXISTS tasPOLICY task_runs_owner_select ON public.task_runs FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS task_plans_owner_select ON public.task_plans;
CREATE POLICY task_plans_owner_select ON public.task_plans FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS task_permissions_owner_select ON public.task_permissions;
CREATE POLICY task_permissions_owner_select ON public.task_permissions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS action_proposals_owner_select ON public.action_proposals;
CREATE POLICY action_proposals_owner_select ON public.action_proposals FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS task_events_owner_select ON public.task_events;
CREATE POLICY task_events_owner_select ON public.task_events FOR SELECT USING (auth.uid() = user_id);
GRANT SELECT ON public.task_runs, public.task_plans, public.task_permissions, public.action_proposals, public.task_events TO authenticated;
GRANT ALL ON public.task_runs, public.task_plans, public.task_permissions, public.action_proposals, public.task_events TO service_role;
COMMIT;
