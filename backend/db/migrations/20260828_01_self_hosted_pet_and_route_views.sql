-- 20260828_01_self_hosted_pet_and_route_views.sql
-- Self-hosted parity for pet_preferences, pet_events, and route_views tables.

BEGIN;

CREATE TABLE IF NOT EXISTS public.pet_preferences (
  user_id UUID NOT NULL PRIMARY KEY,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pet_preferences TO authenticated;
GRANT ALL ON public.pet_preferences TO service_role;
ALTER TABLE public.pet_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pet_preferences' AND policyname = 'pet_preferences own'
  ) THEN
    CREATE POLICY "pet_preferences own" ON public.pet_preferences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.pet_events (
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pet_events' AND policyname = 'pet_events insert own'
  ) THEN
    CREATE POLICY "pet_events insert own" ON public.pet_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pet_events' AND policyname = 'pet_events select own'
  ) THEN
    CREATE POLICY "pet_events select own" ON public.pet_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pet_events_user_created ON public.pet_events (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.route_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  route TEXT NOT NULL,
  referrer TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.route_views TO authenticated;
GRANT ALL ON public.route_views TO service_role;
ALTER TABLE public.route_views ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'route_views' AND policyname = 'route_views insert own'
  ) THEN
    CREATE POLICY "route_views insert own" ON public.route_views
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'route_views' AND policyname = 'route_views select own'
  ) THEN
    CREATE POLICY "route_views select own" ON public.route_views
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_route_views_user_route ON public.route_views (user_id, route, created_at DESC);

CREATE OR REPLACE FUNCTION public.route_analytics_summary(
  p_since timestamptz DEFAULT NULL,
  p_route text DEFAULT NULL
)
RETURNS TABLE (total_views bigint, distinct_routes bigint, unique_users bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT count(*)::bigint,
         count(DISTINCT rv.route)::bigint,
         count(DISTINCT rv.user_id)::bigint
  FROM public.route_views rv
  WHERE (p_since IS NULL OR rv.created_at >= p_since)
    AND (p_route IS NULL OR p_route = '' OR rv.route ILIKE '%' || p_route || '%');
$$;

CREATE OR REPLACE FUNCTION public.route_analytics_breakdown(
  p_since timestamptz DEFAULT NULL,
  p_route text DEFAULT NULL,
  p_sort text DEFAULT 'views',
  p_dir text DEFAULT 'desc',
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (route text, views bigint, users bigint, last_seen timestamptz, total_routes bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH agg AS (
    SELECT rv.route AS route,
           count(*)::bigint AS views,
           count(DISTINCT rv.user_id)::bigint AS users,
           max(rv.created_at) AS last_seen
    FROM public.route_views rv
    WHERE (p_since IS NULL OR rv.created_at >= p_since)
      AND (p_route IS NULL OR p_route = '' OR rv.route ILIKE '%' || p_route || '%')
    GROUP BY rv.route
  )
  SELECT a.route, a.views, a.users, a.last_seen, (SELECT count(*)::bigint FROM agg)
  FROM agg a
  ORDER BY
    CASE WHEN lower(p_dir) = 'asc' THEN
      CASE lower(p_sort) WHEN 'route' THEN a.route END END ASC,
    CASE WHEN lower(p_dir) <> 'asc' THEN
      CASE lower(p_sort) WHEN 'route' THEN a.route END END DESC,
    CASE WHEN lower(p_dir) = 'asc' THEN
      CASE lower(p_sort) WHEN 'views' THEN a.views WHEN 'users' THEN a.users END END ASC,
    CASE WHEN lower(p_dir) <> 'asc' THEN
      CASE lower(p_sort) WHEN 'views' THEN a.views WHEN 'users' THEN a.users END END DESC,
    CASE WHEN lower(p_dir) = 'asc' THEN
      CASE lower(p_sort) WHEN 'last_seen' THEN a.last_seen END END ASC,
    CASE WHEN lower(p_dir) <> 'asc' THEN
      CASE lower(p_sort) WHEN 'last_seen' THEN a.last_seen END END DESC,
    a.views DESC
  LIMIT greatest(1, least(coalesce(p_limit, 25), 200))
  OFFSET greatest(0, coalesce(p_offset, 0));
$$;

GRANT EXECUTE ON FUNCTION public.route_analytics_summary(timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.route_analytics_breakdown(timestamptz, text, text, text, integer, integer) TO authenticated;

COMMIT;
