-- Self-hosted parity fix (second pass): 5 more tables existed only in the
-- Lovable-managed supabase/migrations/ and were never mirrored here, so
-- these already-shipped, user-facing features 404/500 on every self-hosted
-- deployment even though they work fine on Lovable-hosted Supabase:
--   - contact_messages: the public landing-page contact form
--     (src/components/landing/ContactSection.tsx) -- broken for every
--     visitor, not just logged-in users.
--   - contacts + outreach_messages: the Networking page's full contact/
--     outreach CRUD (src/pages/Networking.tsx).
--   - roadmap_progress: the dashboard's roadmap-step tracker
--     (src/hooks/useDashboardData.ts).
-- Schema mirrors the net effect of the originating Lovable migrations
-- exactly (queried directly via supabase-js/PostgREST, so RLS here is the
-- real, load-bearing security boundary -- not the Go/Python BYPASSRLS
-- path documented in CLAUDE.md's RLS scope note).
--
-- NOT included here: agent_run_steps. Lovable's version FKs to
-- agent_runs(id), but the self-hosted agent_runs table (backend/db/
-- migrations' durable-run-control schema, actively used by Go/Python) has
-- a completely different shape -- primary key run_id, not id, and columns
-- run_type/config/celery_task_id instead of job_title/company/mode/outcome.
-- src/lib/agent/applyAgent.ts and src/pages/ApplyAgent.tsx query agent_runs
-- with .eq("id", runId), so that whole page is ALSO broken on self-hosted
-- today -- but fixing it means reconciling two genuinely different
-- "agent_runs" concepts that evolved separately (a real architecture
-- decision), not a safe mirror-the-migration fix. Flagged, not touched.

BEGIN;

CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  title TEXT,
  company TEXT,
  email TEXT,
  linkedin_url TEXT,
  source TEXT,
  relationship TEXT NOT NULL DEFAULT 'cold',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contacts own" ON public.contacts;
CREATE POLICY "contacts own" ON public.contacts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_contacts_updated ON public.contacts;
CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.outreach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'email',
  kind TEXT NOT NULL DEFAULT 'intro',
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_messages TO authenticated;
GRANT ALL ON public.outreach_messages TO service_role;
ALTER TABLE public.outreach_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "outreach_messages own" ON public.outreach_messages;
CREATE POLICY "outreach_messages own" ON public.outreach_messages FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_outreach_messages_updated ON public.outreach_messages;
CREATE TRIGGER trg_outreach_messages_updated BEFORE UPDATE ON public.outreach_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_outreach_contact ON public.outreach_messages(contact_id);

CREATE TABLE IF NOT EXISTS public.roadmap_progress (
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
DROP POLICY IF EXISTS "roadmap_progress select own" ON public.roadmap_progress;
CREATE POLICY "roadmap_progress select own" ON public.roadmap_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "roadmap_progress insert own" ON public.roadmap_progress;
CREATE POLICY "roadmap_progress insert own" ON public.roadmap_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "roadmap_progress update own" ON public.roadmap_progress;
CREATE POLICY "roadmap_progress update own" ON public.roadmap_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "roadmap_progress delete own" ON public.roadmap_progress;
CREATE POLICY "roadmap_progress delete own" ON public.roadmap_progress FOR DELETE TO authenticated USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_roadmap_progress_updated ON public.roadmap_progress;
CREATE TRIGGER trg_roadmap_progress_updated BEFORE UPDATE ON public.roadmap_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT INSERT ON public.contact_messages TO anon;
GRANT INSERT ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can submit a contact message" ON public.contact_messages;
CREATE POLICY "Anyone can submit a contact message"
  ON public.contact_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(name) > 0 AND length(name) <= 200
    AND length(email) > 0 AND length(email) <= 320
    AND length(message) > 0 AND length(message) <= 5000
  );

COMMIT;
