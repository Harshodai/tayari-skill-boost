-- Ensure duplicate submission attempts for the same run_id / job_url are idempotent
CREATE UNIQUE INDEX IF NOT EXISTS uq_submission_receipts_run
    ON public.submission_receipts (user_id, run_id, job_url)
    WHERE run_id IS NOT NULL;
