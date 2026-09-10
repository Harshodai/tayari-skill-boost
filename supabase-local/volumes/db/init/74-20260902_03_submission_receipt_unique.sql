-- Ensure duplicate submission attempts for the same run_id / job_url are idempotent
-- Deduplicate existing rows before creating unique index, retaining the most informative row
DELETE FROM public.submission_receipts
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY user_id, run_id, COALESCE(job_url, '')
                   ORDER BY
                       CASE WHEN verified THEN 1 ELSE 0 END DESC,
                       CASE WHEN outcome IN ('submitted', 'verified') THEN 1 ELSE 0 END DESC,
                       submitted_at DESC NULLS LAST,
                       created_at DESC NULLS LAST
               ) AS rn
        FROM public.submission_receipts
        WHERE run_id IS NOT NULL
    ) ranked
    WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_submission_receipts_run
    ON public.submission_receipts (user_id, run_id, job_url)
    WHERE run_id IS NOT NULL;
