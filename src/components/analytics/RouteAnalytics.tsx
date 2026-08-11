import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { USE_SELF_HOSTED } from "@/api";

/**
 * WS-09: route-entry analytics.
 *
 * Records one row per signed-in page entry so dead routes can be identified
 * and deleted with evidence instead of opinion. Anonymous visits are not
 * recorded, and a failed write is never allowed to affect navigation.
 */
export function RouteAnalytics() {
  const location = useLocation();
  const { user } = useAuth();
  const lastRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id || USE_SELF_HOSTED) return;
    const route = location.pathname;
    const key = `${user.id}:${route}`;
    if (lastRef.current === key) return;
    const previous = lastRef.current;
    lastRef.current = key;

    void supabase
      .from("route_views")
      .insert({
        user_id: user.id,
        route,
        referrer: previous ? previous.split(":").slice(1).join(":") : null,
      })
      .then(() => undefined, () => undefined);
  }, [location.pathname, user?.id]);

  return null;
}

export default RouteAnalytics;
