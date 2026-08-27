-- Self-hosted parity fix: public.saved_searches existed only in the
-- Lovable-managed supabase/migrations/ (20260628062710_*.sql,
-- 20260811064656_*.sql) and was never mirrored into backend/db/migrations/
-- or the self-hosted init bundle. The Job Search page's "Daily alerts" bell
-- (src/components/jobs/SavedSearches.tsx) queries this table directly via
-- supabase-js -- on a self-hosted stack the table did not exist at all, so
-- the feature 404'd for every self-hosted user. This migration brings the
-- canonical schema (net effect of both Lovable migrations, including the
-- authenticated-scoped RLS policy from the second hardening pass) into the
-- self-hosted-tracked migration set.

BEGIN;

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
CREATE POLICY "Users manage their saved searches" ON public.saved_searches
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_saved_searches_updated_at ON public.saved_searches;
CREATE TRIGGER update_saved_searches_updated_at
  BEFORE UPDATE ON public.saved_searches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
