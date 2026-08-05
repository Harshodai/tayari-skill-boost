CREATE TABLE public.pet_preferences (
  user_id UUID NOT NULL PRIMARY KEY,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pet_preferences TO authenticated;
GRANT ALL ON public.pet_preferences TO service_role;
ALTER TABLE public.pet_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pet_preferences own" ON public.pet_preferences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_pet_preferences_updated BEFORE UPDATE ON public.pet_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.pet_events (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event TEXT NOT NULL,
  tab TEXT,
  target TEXT,
  route TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.pet_events TO authenticated;
GRANT ALL ON public.pet_events TO service_role;
ALTER TABLE public.pet_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pet_events insert own" ON public.pet_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pet_events select own" ON public.pet_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_pet_events_user_created ON public.pet_events (user_id, created_at DESC);