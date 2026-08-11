import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { AlertTriangle, Download, RefreshCw, ShieldCheck } from "lucide-react";

type RouteView = {
  id: string;
  user_id: string;
  route: string;
  referrer: string | null;
  created_at: string;
};

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function toCsv(rows: RouteView[]) {
  const header = ["route", "referrer", "user_id", "viewed_at"];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const body = rows.map((r) =>
    [r.route, r.referrer ?? "", r.user_id, r.created_at].map((v) => escape(String(v))).join(","),
  );
  return [header.join(","), ...body].join("\n");
}

/**
 * Admin analytics for WS-09 route views.
 *
 * Admins (public.user_roles) see every recorded page entry; everyone else sees
 * only their own rows, enforced by row-level security rather than the client.
 */
export default function RouteInsights() {
  const { user } = useAuth();
  const [rows, setRows] = useState<RouteView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [range, setRange] = useState("30");
  const [routeFilter, setRouteFilter] = useState("");

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [{ data: roles }, viewsResult] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        (() => {
          let q = supabase
            .from("route_views")
            .select("id,user_id,route,referrer,created_at")
            .order("created_at", { ascending: false })
            .limit(5000);
          if (range !== "all") q = q.gte("created_at", isoDaysAgo(Number(range)));
          return q;
        })(),
      ]);
      if (viewsResult.error) throw viewsResult.error;
      setIsAdmin((roles ?? []).some((r) => r.role === "admin"));
      setRows((viewsResult.data ?? []) as RouteView[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, range]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = routeFilter.trim().toLowerCase();
    return needle ? rows.filter((r) => r.route.toLowerCase().includes(needle)) : rows;
  }, [rows, routeFilter]);

  const byRoute = useMemo(() => {
    const map = new Map<string, { views: number; users: Set<string> }>();
    filtered.forEach((r) => {
      const entry = map.get(r.route) ?? { views: 0, users: new Set<string>() };
      entry.views += 1;
      entry.users.add(r.user_id);
      map.set(r.route, entry);
    });
    return [...map.entries()]
      .map(([route, v]) => ({ route, views: v.views, users: v.users.size }))
      .sort((a, b) => b.views - a.views);
  }, [filtered]);

  const uniqueUsers = useMemo(() => new Set(filtered.map((r) => r.user_id)).size, [filtered]);

  const exportCsv = () => {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `route-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <div className="container mx-auto space-y-6 px-4 py-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Route analytics</h1>
            <p className="text-muted-foreground">
              Which pages actually get used — evidence for what to keep and what to cut.
            </p>
          </div>
          <Badge variant={isAdmin ? "default" : "secondary"} className="gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            {isAdmin ? "Admin — all users" : "Your activity only"}
          </Badge>
        </header>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
            <CardDescription>Narrow the window, then export exactly what you see.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[200px_1fr_auto_auto] md:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="range">Time range</Label>
              <Select value={range} onValueChange={setRange}>
                <SelectTrigger id="range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RANGES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="route">Route contains</Label>
              <Input
                id="route"
                placeholder="/pipeline"
                value={routeFilter}
                onChange={(e) => setRouteFilter(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-destructive/40">
            <CardContent className="flex items-center gap-3 py-4 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span>{error}</span>
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => void load()}>
                Try again
              </Button>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { label: "Page views", value: filtered.length },
                { label: "Distinct routes", value: byRoute.length },
                { label: "Unique visitors", value: uniqueUsers },
              ].map((kpi) => (
                <Card key={kpi.label}>
                  <CardHeader className="pb-2">
                    <CardDescription>{kpi.label}</CardDescription>
                    <CardTitle className="text-3xl">{kpi.value.toLocaleString()}</CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>

            {filtered.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="font-medium">No route views in this window</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Views are recorded as signed-in users navigate. Widen the range or clear the route filter.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Top routes</CardTitle>
                    <CardDescription>Views per page in the selected window.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={byRoute.slice(0, 12)} layout="vertical" margin={{ left: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                        <XAxis type="number" allowDecimals={false} className="text-xs" />
                        <YAxis type="category" dataKey="route" width={140} className="text-xs" />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 8,
                            color: "hsl(var(--popover-foreground))",
                          }}
                        />
                        <Bar dataKey="views" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Breakdown</CardTitle>
                    <CardDescription>{byRoute.length} routes</CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto p-0">
                    <table className="w-full text-sm">
                      <thead className="border-b bg-muted/40 text-left">
                        <tr>
                          <th className="px-4 py-2 font-medium">Route</th>
                          <th className="px-4 py-2 text-right font-medium">Views</th>
                          <th className="px-4 py-2 text-right font-medium">Visitors</th>
                          <th className="px-4 py-2 text-right font-medium">Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {byRoute.map((r) => (
                          <tr key={r.route} className="border-b last:border-0">
                            <td className="px-4 py-2 font-mono text-xs">{r.route}</td>
                            <td className="px-4 py-2 text-right">{r.views}</td>
                            <td className="px-4 py-2 text-right">{r.users}</td>
                            <td className="px-4 py-2 text-right text-muted-foreground">
                              {((r.views / filtered.length) * 100).toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
