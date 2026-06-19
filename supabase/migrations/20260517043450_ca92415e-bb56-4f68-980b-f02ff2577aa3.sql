
CREATE TABLE public.saved_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  url TEXT,
  notes TEXT,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_jobs select own" ON public.saved_jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "saved_jobs insert own" ON public.saved_jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_jobs update own" ON public.saved_jobs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_jobs delete own" ON public.saved_jobs FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_saved_jobs_user ON public.saved_jobs(user_id, saved_at DESC);
CREATE TRIGGER trg_saved_jobs_updated BEFORE UPDATE ON public.saved_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.roadmap_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  roadmap_slug TEXT NOT NULL,
  step_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, roadmap_slug, step_key)
);
ALTER TABLE public.roadmap_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roadmap_progress select own" ON public.roadmap_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "roadmap_progress insert own" ON public.roadmap_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "roadmap_progress update own" ON public.roadmap_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "roadmap_progress delete own" ON public.roadmap_progress FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_roadmap_progress_updated BEFORE UPDATE ON public.roadmap_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  transcript JSONB,
  score INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "interview_sessions select own" ON public.interview_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "interview_sessions insert own" ON public.interview_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "interview_sessions update own" ON public.interview_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "interview_sessions delete own" ON public.interview_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_interview_sessions_user ON public.interview_sessions(user_id, created_at DESC);
CREATE TRIGGER trg_interview_sessions_updated BEFORE UPDATE ON public.interview_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.blog_posts (title, slug, excerpt, content, category, tags, is_featured, is_success_story, read_time_minutes, author_name, published_at) VALUES
('How to Tailor Your Resume to Any Job Description', 'tailor-resume-job-description',
  'Stop sending generic resumes. Learn the 5-step framework to match your resume to any job posting and land more interviews.',
  E'# Tailoring Your Resume\n\nA tailored resume gets 3x more callbacks.\n\n## 1. Decode the Job Description\n## 2. Mirror the Language\n## 3. Reorder for Impact',
  'resume-tips', ARRAY['resume','ats','job-search'], true, false, 6, 'Tayari Team', now() - interval '2 days'),
('Mastering the System Design Interview', 'mastering-system-design-interview',
  'A practical playbook for software engineers preparing for the dreaded system design round at top tech companies.',
  E'# System Design Mastery\n\n## Framework\n1. Clarify requirements\n2. Estimate scale\n3. Define APIs\n4. Sketch data model\n5. Identify bottlenecks',
  'interview-prep', ARRAY['system-design','interviews'], true, false, 9, 'Tayari Team', now() - interval '5 days'),
('From Bootcamp to FAANG: Priya''s 9-Month Journey', 'bootcamp-to-faang-priya',
  'Priya went from a non-CS background to a Senior SWE offer at a top-tier company using Tayari. Here is her exact roadmap.',
  E'# Priya''s Story\n\nIn April, Priya was a marketing analyst. Nine months later she signed an offer at $215K base.\n\n## What worked\n- LeetCode daily\n- Weekly mock interviews\n- 14 resume iterations',
  'success-stories', ARRAY['career-change','faang','success'], true, true, 7, 'Tayari Team', now() - interval '1 days'),
('5 Career Roadmaps to Plan Your Next 12 Months', 'career-roadmaps-12-months',
  'Whether you want to become a Staff Engineer, switch to ML, or go indie — pick the roadmap that fits your goals.',
  E'# Pick Your Roadmap\n\n## 1. IC to Staff Engineer\n## 2. Backend to ML\n## 3. Engineer to Founder',
  'career-tips', ARRAY['career','planning','growth'], false, false, 8, 'Tayari Team', now() - interval '8 days'),
('Why Most Applications Get Filtered Out by ATS', 'ats-filter-jobs',
  'Applicant Tracking Systems reject 75% of resumes before a human ever sees them. Here is how to beat them.',
  E'# Beating the ATS\n\n## Do\n- Use standard section headings\n- Single-column layouts\n- Match JD keywords\n\n## Don''t\n- Use tables or columns\n- Embed text in images',
  'resume-tips', ARRAY['ats','resume','tips'], false, false, 5, 'Tayari Team', now() - interval '12 days');
