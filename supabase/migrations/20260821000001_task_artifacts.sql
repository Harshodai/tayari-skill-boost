BEGIN;

CREATE TABLE IF NOT EXISTS public.task_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.task_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artifact_type text NOT NULL DEFAULT 'draft' CHECK (artifact_type IN ('draft','report','file_reference')),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 240),
  content_type text NOT NULL DEFAULT 'text/markdown' CHECK (length(trim(content_type)) BETWEEN 1 AND 120),
  body text NOT NULL CHECK (length(body) <= 1000000),
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_artifacts_task_created ON public.task_artifacts(task_id, created_at DESC);
ALTER TABLE public.task_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_artifacts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS task_artifacts_owner_access ON public.task_artifacts;
CREATE POLICY task_artifacts_owner_access ON public.task_artifacts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
REVOKE ALL ON public.task_artifacts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_artifacts TO authenticated;
GRANT ALL ON public.task_artifacts TO service_role;

COMMIT;
