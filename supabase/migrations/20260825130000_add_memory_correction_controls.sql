-- Memory correction controls: user-confirmed feedback can be reviewed,
-- expired, superseded, or deleted without silently changing ownership rules.
ALTER TABLE public.user_job_feedback
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS confidence TEXT NOT NULL DEFAULT 'user_confirmed',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS corrected_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_job_feedback_confidence_check'
      AND conrelid = 'public.user_job_feedback'::regclass
  ) THEN
    ALTER TABLE public.user_job_feedback
      ADD CONSTRAINT user_job_feedback_confidence_check
      CHECK (confidence IN ('user_confirmed', 'user_inferred', 'system_inferred'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_job_feedback_active_expiry
  ON public.user_job_feedback(user_id, is_active, expires_at, created_at DESC);

-- The existing summary is a cache, so rebuild its definition to exclude revoked
-- and expired memory. The unique index is recreated for concurrent refreshes.
DROP MATERIALIZED VIEW IF EXISTS public.user_preference_summary;
CREATE MATERIALIZED VIEW public.user_preference_summary AS
SELECT
  user_id,
  COUNT(*) FILTER (WHERE feedback_type = 'liked') as liked_count,
  COUNT(*) FILTER (WHERE feedback_type = 'applied') as applied_count,
  COUNT(*) FILTER (WHERE feedback_type = 'skipped') as skipped_count,
  ARRAY_AGG(DISTINCT job_title) FILTER (WHERE feedback_type IN ('liked', 'applied')) as preferred_titles,
  ARRAY_AGG(DISTINCT company_name) FILTER (WHERE feedback_type IN ('liked', 'applied')) as preferred_companies,
  MAX(created_at) as last_feedback_at
FROM public.user_job_feedback
WHERE is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())
GROUP BY user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_pref_summary_user
  ON public.user_preference_summary(user_id);
