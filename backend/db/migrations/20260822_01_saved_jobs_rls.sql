-- Forward hardening for public.saved_jobs.
-- The table is user-owned and must never be visible across authenticated users.
ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_jobs FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.saved_jobs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.saved_jobs TO authenticated;

DROP POLICY IF EXISTS saved_jobs_owner_access ON public.saved_jobs;
CREATE POLICY saved_jobs_owner_access ON public.saved_jobs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
