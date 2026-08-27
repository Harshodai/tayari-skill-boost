import { useEffect, useState } from "react";
import { Bell, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { createJobWatch, deleteJobWatch, getPreferences, getProfile, listJobWatches, updateJobWatch, type JobWatch } from "@/api";
import { formatNextCheck, isDuplicateWatch, suggestScheduleTier } from "@/lib/jobWatchIntelligence";

// -------------------------------------------------------------------
// Standing job-watch CRUD for the Settings page.
//
// job_watches rows are polled by the Celery beat (autopilot.run_standing_job_
// watches, gated by each row's own schedule_tier interval) with no UI to
// create/edit/pause/delete them before this component existed. Owns fetch +
// create + toggle + delete against GET/POST/PATCH/DELETE /api/v1/watches.
//
// "Adapts to the website": pre-fills the form from the user's saved profile
// (desired_roles/locations) and learned preferences (preferred_titles) the
// same way Job Search's own default search does, instead of starting blank.
// Shares its tier-suggestion/next-check/dedupe logic with the Job Search
// page's "Daily alerts" bell (src/lib/jobWatchIntelligence.ts) so the two
// surfaces behave identically.
// -------------------------------------------------------------------

const TIER_OPTIONS: { value: JobWatch["schedule_tier"]; label: string }[] = [
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

const EMPTY_FORM = { query_title: "", location: "Remote", salary_floor: "100000", schedule_tier: "daily" as JobWatch["schedule_tier"] };

function formatLastChecked(lastRunAt?: string | null): string {
  if (!lastRunAt) return "Never checked yet";
  const date = new Date(lastRunAt);
  if (Number.isNaN(date.getTime())) return "Never checked yet";
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 1) return "Checked just now";
  if (diffMins < 60) return `Checked ${diffMins}m ago`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `Checked ${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `Checked ${diffDays}d ago`;
}

function formatMatchCount(count?: number | null): string | null {
  if (count == null) return null;
  if (count === 0) return "No matches yet";
  return `${count} matching job${count === 1 ? "" : "s"}`;
}

export function JobWatchesCard() {
  const [watches, setWatches] = useState<JobWatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [tierTouched, setTierTouched] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    try {
      const res = await listJobWatches();
      setWatches(res ?? []);
    } catch {
      // ponytail: silent — no watches yet is a normal state for new users.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Prefill from the user's saved profile / learned preferences, same as
  // Job Search's own default query — but only into fields the user hasn't
  // already typed into, so a slow response never clobbers real input.
  useEffect(() => {
    (async () => {
      try {
        const [profile, prefs] = await Promise.all([
          getProfile().catch(() => null),
          getPreferences().catch(() => null),
        ]);
        const suggestedTitle = prefs?.preferred_titles?.[0] || profile?.desired_roles?.[0];
        const suggestedLocation = profile?.locations?.[0];
        setForm((f) => ({
          ...f,
          query_title: f.query_title || suggestedTitle || f.query_title,
          location: f.location === "Remote" && suggestedLocation ? suggestedLocation : f.location,
        }));
      } catch {
        // ponytail: prefill is a convenience, not a requirement — a blank
        // form is a perfectly normal fallback.
      }
    })();
  }, []);

  // Auto-suggest a tier from the title as the user types, until they
  // deliberately pick one themselves — then their choice always wins.
  useEffect(() => {
    if (tierTouched) return;
    setForm((f) => ({ ...f, schedule_tier: suggestScheduleTier(f.query_title) }));
  }, [form.query_title, tierTouched]);

  const handleCreate = async () => {
    const title = form.query_title.trim();
    if (!title) {
      toast.error("Enter a job title to watch for.");
      return;
    }
    const location = form.location.trim() || "Remote";
    if (isDuplicateWatch(watches, title, location)) {
      toast.error(`You already have a standing watch for "${title}" in ${location}.`);
      return;
    }
    setCreating(true);
    try {
      const created = await createJobWatch({
        query_title: title,
        location,
        salary_floor: Number(form.salary_floor) || 100000,
        schedule_tier: form.schedule_tier,
      });
      setWatches((items) => [created, ...items]);
      setForm(EMPTY_FORM);
      setTierTouched(false);
      toast.success(`Watching for "${created.query_title}" — checked ${created.schedule_tier}.`);
    } catch {
      toast.error("Could not create this job watch.");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (watch: JobWatch) => {
    setBusyId(watch.id);
    try {
      const updated = await updateJobWatch(watch.watch_id, { is_active: !watch.is_active });
      setWatches((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      toast.success(updated.is_active ? "Watch resumed." : "Watch paused.");
    } catch {
      toast.error("Could not update this watch.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (watch: JobWatch) => {
    if (!window.confirm(`Stop watching for "${watch.query_title}"? This can't be undone.`)) return;
    setBusyId(watch.id);
    try {
      await deleteJobWatch(watch.watch_id);
      setWatches((items) => items.filter((item) => item.id !== watch.id));
      toast.success("Job watch deleted.");
    } catch {
      toast.error("Could not delete this watch.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <Card className="animate-fade-in-up">
        <CardHeader>
          <CardTitle>Standing Job Watches</CardTitle>
          <CardDescription>Automatically checked on a schedule you choose</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-24 bg-muted rounded-lg animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-fade-in-up">
      <CardHeader>
        <CardTitle>Standing Job Watches</CardTitle>
        <CardDescription>
          Automatically searched on the schedule you pick — no need to check manually
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {watches.length === 0 ? (
          <div className="text-center py-6">
            <Bell className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No standing watches yet. Add one below and we'll check for matching jobs on your schedule.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {watches.map((watch) => {
              const matchLabel = formatMatchCount(watch.last_match_count);
              return (
                <div
                  key={watch.id}
                  className="flex flex-col gap-3 rounded-lg border border-border/60 bg-background/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground truncate">{watch.query_title}</p>
                      <Badge variant="secondary" className="text-[10px]">{watch.schedule_tier}</Badge>
                      {!watch.is_active && <Badge variant="outline" className="text-[10px] text-muted-foreground">Paused</Badge>}
                      {matchLabel && (
                        <Badge variant="outline" className="text-[10px] text-primary border-primary/30">{matchLabel}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {watch.location} · ${watch.salary_floor.toLocaleString()}+ · {formatLastChecked(watch.last_run_at)}
                      {watch.is_active && <> · {formatNextCheck(watch.last_run_at, watch.schedule_tier)}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Switch
                      checked={watch.is_active}
                      disabled={busyId === watch.id}
                      onCheckedChange={() => handleToggleActive(watch)}
                      aria-label={watch.is_active ? "Pause watch" : "Resume watch"}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busyId === watch.id}
                      onClick={() => handleDelete(watch)}
                      className="h-8 text-xs text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Add a standing watch</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="watch-title" className="text-xs">Job title</Label>
              <Input
                id="watch-title"
                placeholder="Senior Backend Engineer"
                value={form.query_title}
                onChange={(e) => setForm({ ...form, query_title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="watch-location" className="text-xs">Location</Label>
              <Input
                id="watch-location"
                placeholder="Remote"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="watch-salary" className="text-xs">Minimum salary</Label>
              <Input
                id="watch-salary"
                type="number"
                min={0}
                step={5000}
                placeholder="100000"
                value={form.salary_floor}
                onChange={(e) => setForm({ ...form, salary_floor: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="watch-tier" className="flex items-center gap-1 text-xs">
                Check frequency
                {!tierTouched && form.query_title.trim() && (
                  <span className="inline-flex items-center gap-0.5 text-primary" title="Suggested from the job title">
                    <Sparkles className="h-3 w-3" /> suggested
                  </span>
                )}
              </Label>
              <Select
                value={form.schedule_tier}
                onValueChange={(value) => {
                  setTierTouched(true);
                  setForm({ ...form, schedule_tier: value as JobWatch["schedule_tier"] });
                }}
              >
                <SelectTrigger id="watch-tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Add Watch
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
