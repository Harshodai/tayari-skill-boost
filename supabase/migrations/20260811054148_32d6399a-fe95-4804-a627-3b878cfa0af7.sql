CREATE TABLE public.application_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  run_id TEXT NOT NULL,
  job_url TEXT,
  job_title TEXT,
  company TEXT,
  resume_sha256 TEXT NOT NULL,
  resume_preview TEXT,
  decision TEXT NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending','approved','rejected')),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX application_approvals_unique_idx
  ON public.application_approvals (user_id, run_id, resume_sha256);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_approvals TO authenticated;
GRANT ALL ON public.application_approvals TO service_role;
ALTER TABLE public.application_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own approvals" ON public.application_approvals FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_application_approvals_updated BEFORE UPDATE ON public.application_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.submission_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  application_id TEXT,
  run_id TEXT,
  job_url TEXT,
  job_title TEXT,
  company TEXT,
  ats_vendor TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  verified BOOLEAN NOT NULL DEFAULT false,
  confirmation_text TEXT,
  confirmation_number TEXT,
  screenshot_path TEXT,
  submitted_resume_sha256 TEXT,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  outcome TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX submission_receipts_user_idx ON public.submission_receipts (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submission_receipts TO authenticated;
GRANT ALL ON public.submission_receipts TO service_role;
ALTER TABLE public.submission_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own receipts" ON public.submission_receipts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_submission_receipts_updated BEFORE UPDATE ON public.submission_receipts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.agent_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  run_id TEXT,
  job_title TEXT,
  company TEXT,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  answer TEXT,
  answered_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','answered','skipped')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX agent_questions_pending_idx ON public.agent_questions (user_id, status, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_questions TO authenticated;
GRANT ALL ON public.agent_questions TO service_role;
ALTER TABLE public.agent_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own agent questions" ON public.agent_questions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_agent_questions_updated BEFORE UPDATE ON public.agent_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();