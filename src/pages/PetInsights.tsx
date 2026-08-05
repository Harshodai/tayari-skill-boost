import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { fetchPetEvents, type PetEventRow } from "@/components/pet/petSync";
import { usePetProgress } from "@/components/pet/petProgress";
import { Sparkles } from "lucide-react";

const LABELS: Record<string, string> = {
  pet_opened: "Panel opened",
  pet_closed: "Panel closed",
  pet_dismissed: "Companion hidden",
  tab_opened: "Tab opened",
  tip_shown: "Tip shown",
  action_clicked: "Action clicked",
  topic_opened: "Answer read",
  question_asked: "Question asked",
  tour_step_started: "Tour step started",
  tour_completed: "Tour completed",
  look_changed: "Look changed",
};

function count(rows: PetEventRow[], event: string) {
  return rows.filter((r) => r.event === event).length;
}

/** Engagement + conversion view for Tay, scoped to the signed-in user. */
export default function PetInsights() {
  const { user } = useAuth();
  const [rows, setRows] = useState<PetEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const progress = usePetProgress(user?.id);

  useEffect(() => {
    if (!user?.id) return;
    fetchPetEvents(user.id)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [user?.id]);

  const byEvent = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => map.set(r.event, (map.get(r.event) ?? 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const byTab = useMemo(() => {
    const map = new Map<string, number>();
    rows.filter((r) => r.event === "tab_opened" && r.tab).forEach((r) => map.set(r.tab!, (map.get(r.tab!) ?? 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const topActions = useMemo(() => {
    const map = new Map<string, number>();
    rows.filter((r) => r.event === "action_clicked" && r.target).forEach((r) => map.set(r.target!, (map.get(r.target!) ?? 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [rows]);

  const opens = count(rows, "pet_opened");
  const clicks = count(rows, "action_clicked");
  const conversion = opens ? Math.round((clicks / opens) * 100) : 0;
  const max = Math.max(1, ...byEvent.map(([, n]) => n));

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
        <header className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden /> Companion insights
          </h1>
          <p className="text-sm text-muted-foreground">
            How you use Tay — which tabs you open, which suggestions you act on, and where it moves you forward.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Panel opens", value: opens },
            { label: "Actions taken", value: clicks },
            { label: "Open → action rate", value: `${conversion}%` },
          ].map((s) => (
            <Card key={s.label}>
              <CardHeader className="pb-2">
                <CardDescription>{s.label}</CardDescription>
                <CardTitle className="text-3xl">{s.value}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Interactions</CardTitle>
            <CardDescription>{loading ? "Loading…" : `${rows.length} recorded events`}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {!loading && byEvent.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing yet — open Tay and try a suggestion.</p>
            )}
            {byEvent.map(([event, n]) => (
              <div key={event} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>{LABELS[event] ?? event}</span>
                  <span className="text-muted-foreground">{n}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(n / max) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tabs opened</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {byTab.length === 0 && <p className="text-muted-foreground">No tab activity yet.</p>}
              {byTab.map(([tab, n]) => (
                <div key={tab} className="flex justify-between">
                  <span className="capitalize">{tab}</span>
                  <span className="text-muted-foreground">{n}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Most-used suggestions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {topActions.length === 0 && <p className="text-muted-foreground">No suggestions used yet.</p>}
              {topActions.map(([target, n]) => (
                <div key={target} className="flex justify-between">
                  <span className="truncate">{target}</span>
                  <span className="text-muted-foreground">{n}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Where you are</CardTitle>
            <CardDescription>What Tay uses to personalise its tips</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[
              { label: "Profile", value: progress.hasProfile ? "Done" : "Pending" },
              { label: "Best ATS score", value: progress.bestScore ?? "—" },
              { label: "Saved roles", value: progress.savedJobs },
              { label: "Applications", value: progress.applied },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-semibold">{s.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
