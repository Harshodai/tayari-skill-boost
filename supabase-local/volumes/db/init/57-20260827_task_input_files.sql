BEGIN;

ALTER TABLE public.task_runs
  ADD COLUMN IF NOT EXISTS input_files jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.task_runs
  DROP CONSTRAINT IF EXISTS task_runs_input_files_array;

ALTER TABLE public.task_runs
  ADD CONSTRAINT task_runs_input_files_array
  CHECK (jsonb_typeof(input_files) = 'array');

COMMENT ON COLUMN public.task_runs.input_files IS
  'Owner-selected, bounded task input files. Each entry stores metadata and a base64 payload for the draft-only executor; no arbitrary filesystem path is trusted.';

COMMIT;
