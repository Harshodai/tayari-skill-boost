-- Interview experience moderation and abuse reporting.
-- Public/connections posts are held pending until an admin approves them.
ALTER TABLE public.shared_interview_questions
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS moderation_reason TEXT,
  ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS report_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_siq_moderation_status
  ON public.shared_interview_questions (moderation_status, visibility, created_at DESC);

CREATE TABLE IF NOT EXISTS public.interview_question_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.shared_interview_questions(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('privacy', 'confidential', 'harassment', 'spam', 'other')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (question_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_interview_question_reports_status
  ON public.interview_question_reports (status, created_at DESC);

ALTER TABLE public.interview_question_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS interview_question_reports_owner ON public.interview_question_reports;
CREATE POLICY interview_question_reports_owner ON public.interview_question_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());
DROP POLICY IF EXISTS interview_question_reports_reader ON public.interview_question_reports;
CREATE POLICY interview_question_reports_reader ON public.interview_question_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());
