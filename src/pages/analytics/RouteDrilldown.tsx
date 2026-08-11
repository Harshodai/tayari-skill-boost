import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, ChevronLeft, ChevronRight, Download } from "lucide-react";

export type DrilldownEvent = {
  id: string;
  user_id: string;
  route: string;
  referrer: string | null;
  created_at: string;
};

const PAGE_SIZE = 25;

/**
 * Drill-down: the exact route_views rows behind one aggregated route,
 * paged on the server so a hot route with 100k hits stays cheap.
 */
export function RouteDrilldown({
  route,
  since,
  rangeLabel,
  onClose,
}: {
  route: string | null;
  since: string | null;
  rangeLabel: string;
  onClose: () => void;
}) {
  const [events, setEvents] = useState<DrilldownEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(0);
  }, [route, since]);

  const load = useCallback(async () => {
    if (!route) return;
    setLoading(true);
    setError(null);
    try {
      let q = supabase
        .from("route_views")
        .select("id,user_id,route,referrer,created_at", { count: "exact" })
        .eq("route", route)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (since) q = q.gte("created_at", since);
      const { data, error: err, count } = await q;
      if (err) throw err;
      setEvents((data ?? []) as DrilldownEvent[]);
      setTotal(count ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load events.");
    } finally {
      setLoading(false);
    }
  }, [route, since, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportCsv = () => {
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [
      ["route", "user_id", "referrer", "viewed_at"].join(","),
      ...events.map((e) => [e.route, e.user_id, e.referrer ?? "", e.created_at].map(escape).join(",")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `route-events-${route?.replace(/\W+/g, "-")}-p${page + 1}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  return (
    <Dialog open={!!route} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm">{route}</span>
            <Badge variant="secondary">{rangeLabel}</Badge>
          </DialogTitle>
          <DialogDescription>
            {total.toLocaleString()} recorded event{total === 1 ? "" : "s"} for this route and window.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span>{error}</span>
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        ) : loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No events in this window.</p>
        ) : (
          <div className="max-h-[50vh] overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b bg-muted/60 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Viewed at</th>
                  <th className="px-3 py-2 font-medium">Visitor</th>
                  <th className="px-3 py-2 font-medium">Referrer</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono text-xs">{e.user_id.slice(0, 8)}…</td>
                    <td className="max-w-[16rem] truncate px-3 py-2 text-muted-foreground">
                      {e.referrer || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {lastPage + 1}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={events.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export page
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              disabled={page >= lastPage || loading}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
