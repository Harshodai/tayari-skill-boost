BEGIN;

ALTER TABLE public.task_runs
  ADD COLUMN IF NOT EXISTS lease_owner text,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_task_runs_lease_recovery
  ON public.task_runs(status, lease_expires_at)
  WHERE status = 'running';

COMMIT;
