CREATE TABLE public.route_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  route TEXT NOT NULL,
  referrer TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.route_views TO authenticated;
GRANT ALL ON public.route_views TO service_role;

ALTER TABLE public.route_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "route_views insert own" ON public.route_views
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "route_views select own" ON public.route_views
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_route_views_user_route ON public.route_views (user_id, route, created_at DESC);