CREATE OR REPLACE FUNCTION public.route_analytics_summary(
  p_since timestamptz DEFAULT NULL,
  p_route text DEFAULT NULL
)
RETURNS TABLE (total_views bigint, distinct_routes bigint, unique_users bigint)
LANGUAGE sql
STABLE
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