ALTER TABLE public.credit_ledger
    ALTER COLUMN id TYPE TEXT USING id::TEXT;

ALTER TABLE public.submission_receipts
    ADD COLUMN IF NOT EXISTS submitted_resume_text TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_submission_receipts_run
    ON public.submission_receipts (user_id, run_id, job_url)
    WHERE run_id IS NOT NULL;