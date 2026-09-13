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
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  BUILTIN_PRESETS,
  loadPresets,
  savePresets,
  type AnalyticsPreset,
} from "./analytics/presets";
import { RouteDrilldown } from "./analytics/RouteDrilldown";
import { toast } from "@/hooks/use-toast";

type BreakdownRow = {
  route: string;
  views: number;
  users: number;
  last_seen: string | null;
  total_routes: number;
};

type SortKey = "route" | "views" | "users" | "last_seen";

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

const PAGE_SIZES = [10, 25, 50, 100];

function sinceIso(range: string): string | null {
  if (range === "all") return null;
  return new Date(Date.now() - Number(range) * 86_400_000).toISOString();
}

/**
 * Admin analytics for WS-09 route views.
 *
 * Aggregation, sorting and paging all happen in Postgres (route_analytics_*
 * functions) so the page stays fast no matter how many rows exist. Row-level
 * security still decides whose rows are counted: admins see everyone,
 * everyone else sees only themselves.
 */
export default function RouteInsights() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  const [range, setRange] = useState("30");
  const [routeFilter, setRouteFilter] = useState("");
  const [appliedFilter, setAppliedFilter] = useState("");

  const [sort, setSort] = useState<SortKey>("views");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const [rows, setRows] = useState<BreakdownRow[]>([]);
  const [summary, setSummary] = useState({ total_views: 0, distinct_routes: 0, unique_users: 0 });
  const [totalRoutes, setTotalRoutes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [presets, setPresets] = useState<AnalyticsPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [drillRoute, setDrillRoute] = useState<string | null>(null);

  useEffect(() => {
    setPresets([...BUILTIN_PRESETS, ...loadPresets()]);
  }, []);

  // Debounce free-text filtering so each keystroke doesn't hit the database.
  useEffect(() => {
    const t = setTimeout(() => {
      setAppliedFilter(routeFilter.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [routeFilter]);

  const since = useMemo(() => sinceIso(range), [range]);
  const rangeLabel = RANGES.find((r) => r.value === range)?.label ?? range;

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [{ data: roles }, summaryRes, breakdownRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.rpc("route_analytics_summary", { p_since: since, p_route: appliedFilter }),
        supabase.rpc("route_analytics_breakdown", {
          p_since: since,
          p_route: appliedFilter,
          p_sort: sort,
          p_dir: dir,
          p_limit: pageSize,
          p_offset: page * pageSize,
        }),
      ]);
      if (summaryRes.error) throw summaryRes.error;
      if (breakdownRes.error) throw breakdownRes.error;
      setIsAdmin((roles ?? []).some((r) => r.role === "admin"));
      const s = (summaryRes.data ?? [])[0];
      setSummary({
        total_views: Number(s?.total_views ?? 0),
        distinct_routes: Number(s?.distinct_routes ?? 0),
        unique_users: Number(s?.unique_users ?? 0),
      });
      const data = (breakdownRes.data ?? []) as BreakdownRow[];
      setRows(data.map((r) => ({ ...r, views: Number(r.views), users: Number(r.users) })));
      setTotalRoutes(Number(data[0]?.total_routes ?? 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, since, appliedFilter, sort, dir, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleSort = (key: SortKey) => {
    if (sort === key) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setDir(key === "route" ? "asc" : "desc");
    }
    setPage(0);
  };

  const applyPreset = (id: string) => {
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    setRange(preset.range);
    setRouteFilter(preset.routeFilter);
    setAppliedFilter(preset.routeFilter);
    setPage(0);
  };

  const saveCurrentPreset = () => {
    const name = presetName.trim();
    if (!name) return;
    const next: AnalyticsPreset[] = [
      ...presets.filter((p) => p.name !== name),
      { id: `user-${Date.now()}`, name, range, routeFilter: routeFilter.trim() },
    ];
    setPresets(next);
    savePresets(next);
    setPresetName("");
    toast({ title: "Preset saved", description: `"${name}" is now one click away.` });
  };

  const deletePreset = (id: string) => {
    const next = presets.filter((p) => p.id !== id);
    setPresets(next);
    savePresets(next);
  };

  const exportCsv = () => {
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [
      ["route", "views", "visitors", "last_seen"].join(","),
      ...rows.map((r) => [r.route, r.views, r.users, r.last_seen ?? ""].map(escape).join(",")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `route-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lastPage = Math.max(0, Math.ceil(totalRoutes / pageSize) - 1);
  const userPresets = presets.filter((p) => !p.builtin);

  const SortHeader = ({ label, k, align = "left" }: { label: string; k: SortKey; align?: "left" | "right" }) => (
    <th className={`px-4 py-2 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 hover:text-foreground"
        aria-label={`Sort by ${label}`}
      >
        {label}
        {sort === k &&
          (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );

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
            <CardDescription>Narrow the window, save it as a preset, then export what you see.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[200px_1fr_auto_auto] md:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="range">Time range</Label>
                <Select
                  value={range}
                  onValueChange={(v) => {
                    setRange(v);
                    setPage(0);
                  }}
                >
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
              <Button onClick={exportCsv} disabled={rows.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label>Saved presets</Label>
              <div className="flex flex-wrap gap-2">
                {presets.map((p) => (
                  <span key={p.id} className="inline-flex items-center">
                    <Button size="sm" variant="secondary" onClick={() => applyPreset(p.id)}>
                      {p.name}
                    </Button>
                    {!p.builtin && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        aria-label={`Delete preset ${p.name}`}
                        onClick={() => deletePreset(p.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </span>
                ))}
                {userPresets.length === 0 && (
                  <span className="self-center text-xs text-muted-foreground">
                    Save the current filters to add your own.
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Input
                  className="max-w-xs"
                  placeholder="Name this preset"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveCurrentPreset()}
                />
                <Button variant="outline" onClick={saveCurrentPreset} disabled={!presetName.trim()}>
                  <Save className="mr-2 h-4 w-4" />
                  Save current
                </Button>
              </div>
            </div>
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
                { label: "Page views", value: summary.total_views },
                { label: "Distinct routes", value: summary.distinct_routes },
                { label: "Unique visitors", value: summary.unique_users },
              ].map((kpi) => (
                <Card key={kpi.label}>
                  <CardHeader className="pb-2">
                    <CardDescription>{kpi.label}</CardDescription>
                    <CardTitle className="text-3xl">{kpi.value.toLocaleString()}</CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>

            {rows.length === 0 ? (
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
                    <CardDescription>Views per page on this results page.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={rows.slice(0, 12)} layout="vertical" margin={{ left: 24 }}>
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
                  <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
                    <div>
                      <CardTitle className="text-base">Breakdown</CardTitle>
                      <CardDescription>
                        {totalRoutes.toLocaleString()} routes — sorted and paged in the database.
                      </CardDescription>
                    </div>
                    <Select
                      value={String(pageSize)}
                      onValueChange={(v) => {
                        setPageSize(Number(v));
                        setPage(0);
                      }}
                    >
                      <SelectTrigger className="w-[130px]" aria-label="Rows per page">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZES.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} per page
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardHeader>
                  <CardContent className="overflow-x-auto p-0">
                    <table className="w-full text-sm">
                      <thead className="border-b bg-muted/40 text-muted-foreground">
                        <tr>
                          <SortHeader label="Route" k="route" />
                          <SortHeader label="Views" k="views" align="right" />
                          <SortHeader label="Visitors" k="users" align="right" />
                          <SortHeader label="Last seen" k="last_seen" align="right" />
                          <th className="px-4 py-2 text-right font-medium">Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.route} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="px-4 py-2">
                              <button
                                type="button"
                                className="font-mono text-xs underline-offset-2 hover:underline"
                                onClick={() => setDrillRoute(r.route)}
                              >
                                {r.route}
                              </button>
                            </td>
                            <td className="px-4 py-2 text-right">{r.views.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right">{r.users.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-muted-foreground">
                              {r.last_seen ? new Date(r.last_seen).toLocaleDateString() : "—"}
                            </td>
                            <td className="px-4 py-2 text-right text-muted-foreground">
                              {summary.total_views > 0
                                ? `${((r.views / summary.total_views) * 100).toFixed(1)}%`
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                  <CardContent className="flex items-center justify-between gap-2 border-t pt-4">
                    <span className="text-xs text-muted-foreground">
                      Page {page + 1} of {lastPage + 1}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={page === 0 || loading}
                      >
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                        disabled={page >= lastPage || loading}
                      >
                        Next
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}

        <RouteDrilldown
          route={drillRoute}
          since={since}
          rangeLabel={rangeLabel}
          onClose={() => setDrillRoute(null)}
        />
      </div>
    </AppShell>
  );
}
