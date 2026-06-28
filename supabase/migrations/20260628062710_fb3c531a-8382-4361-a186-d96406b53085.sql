DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pipeline_stage') THEN
    CREATE TYPE public.pipeline_stage AS ENUM ('saved','applied','interview','offer','rejected');
  END IF;
END $$;

ALTER TABLE public.saved_jobs
  ADD COLUMN IF NOT EXISTS stage public.pipeline_stage NOT NULL DEFAULT 'saved';

CREATE INDEX IF NOT EXISTS saved_jobs_user_stage_idx ON public.saved_jobs(user_id, stage);

CREATE TABLE IF NOT EXISTS public.saved_searches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query TEXT NOT NULL DEFAULT '',
  location TEXT,
  remote_only BOOLEAN NOT NULL DEFAULT false,
  min_score INTEGER NOT NULL DEFAULT 0,
  alert_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_searches TO authenticated;
GRANT ALL ON public.saved_searches TO service_role;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their saved searches" ON public.saved_searches;
CREATE POLICY "Users manage their saved searches"
  ON public.saved_searches FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_saved_searches_updated_at ON public.saved_searches;
CREATE TRIGGER update_saved_searches_updated_at
  BEFORE UPDATE ON public.saved_searches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();