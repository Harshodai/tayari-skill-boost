-- Create resume_analyses table for storing analysis history
CREATE TABLE public.resume_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  resume_filename TEXT NOT NULL,
  job_title TEXT,
  company_name TEXT,
  overall_score INTEGER NOT NULL,
  analysis_data JSONB NOT NULL,
  parsed_resume JSONB,
  resume_text TEXT,
  job_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.resume_analyses ENABLE ROW LEVEL SECURITY;

-- Users can view their own analyses
CREATE POLICY "Users can view own analyses" 
ON public.resume_analyses 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own analyses
CREATE POLICY "Users can insert own analyses" 
ON public.resume_analyses 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own analyses
CREATE POLICY "Users can delete own analyses" 
ON public.resume_analyses 
FOR DELETE 
USING (auth.uid() = user_id);

-- Indexes for faster lookups
CREATE INDEX idx_resume_analyses_user_id ON public.resume_analyses(user_id);
CREATE INDEX idx_resume_analyses_created_at ON public.resume_analyses(created_at DESC);