-- User feedback on job recommendations for preference learning
CREATE TABLE public.user_job_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  job_id TEXT NOT NULL,
  job_title TEXT,
  company_name TEXT,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('liked', 'disliked', 'applied', 'skipped', 'saved')),
  feedback_source TEXT DEFAULT 'manual', -- 'manual', 'auto_detected'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast preference lookups
CREATE INDEX idx_user_job_feedback_user ON public.user_job_feedback(user_id, feedback_type);
CREATE INDEX idx_user_job_feedback_job ON public.user_job_feedback(job_id);

-- RLS
ALTER TABLE public.user_job_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own feedback"
ON public.user_job_feedback FOR ALL USING (auth.uid() = user_id);

-- Materialized view for user preference vectors
CREATE MATERIALIZED VIEW public.user_preference_summary AS
SELECT 
  user_id,
  COUNT(*) FILTER (WHERE feedback_type = 'liked') as liked_count,
  COUNT(*) FILTER (WHERE feedback_type = 'applied') as applied_count,
  COUNT(*) FILTER (WHERE feedback_type = 'skipped') as skipped_count,
  -- Extract common skills from liked jobs (simplified)
  ARRAY_AGG(DISTINCT job_title) FILTER (WHERE feedback_type IN ('liked', 'applied')) as preferred_titles,
  ARRAY_AGG(DISTINCT company_name) FILTER (WHERE feedback_type IN ('liked', 'applied')) as preferred_companies,
  MAX(created_at) as last_feedback_at
FROM public.user_job_feedback
GROUP BY user_id;

CREATE UNIQUE INDEX idx_user_pref_summary_user ON public.user_preference_summary(user_id);

-- Refresh function
CREATE OR REPLACE FUNCTION public.refresh_user_preference_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_preference_summary;
END;
$$ LANGUAGE plpgsql;
