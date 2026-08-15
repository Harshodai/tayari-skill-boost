import { Activity, CheckCircle2, Clock3, Link2, RefreshCw, Sparkles } from "lucide-react";
import { OmniSaveActivityEvent } from "@/api/ai";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const eventLabels: Record<string, string> = {
  capture: "Source captured",
  evidence_created: "Evidence card created",
  context_linked: "Career context linked",
  sync_run: "Sync run completed",
};

function formatTime(value: string | null) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function iconFor(eventType: string) {
  if (eventType === "capture") return <Sparkles className="h-4 w-4 text-primary" />;
  if (eventType === "evidence_created") return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (eventType === "context_linked") return <Link2 className="h-4 w-4 text-sky-400" />;
  return <RefreshCw className="h-4 w-4 text-amber-400" />;
}

export function OmniSaveActivityTimeline({
  events,
  loading,
  onRefresh,
}: {
  events: OmniSaveActivityEvent[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}) {
  return (
    <Card className="border-border/70 bg-background/50">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-primary" /> Activity timeline</CardTitle>
          <CardDescription className="mt-1">A private, read-only receipt of what changed in your OmniSaveAI workspace.</CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void onRefresh()} disabled={loading}>
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {loading && events.length === 0 ? (
          <div className="space-y-3" aria-label="Loading activity timeline">
            {[1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-lg bg-muted/50" />)}
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <Clock3 className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No activity yet</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Capture a source, create an evidence card, or run a sync to start your private receipt.</p>
          </div>
        ) : (
          <div className="relative space-y-3 before:absolute before:bottom-3 before:left-[0.95rem] before:top-3 before:w-px before:bg-border/70">
            {events.slice(0, 12).map((event) => (
              <div key={`${event.event_type}-${event.entity_id}-${event.occurred_at}`} className="relative flex gap-3 rounded-lg border border-border/60 bg-card/60 p-3">
                <div className="z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background">{iconFor(event.event_type)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{eventLabels[event.event_type] || event.event_type}</p><Badge variant="outline" className="text-[10px]">{formatTime(event.occurred_at)}</Badge></div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{event.label || "OmniSaveAI workspace event"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
