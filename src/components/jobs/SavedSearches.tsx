import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Bell, Trash2, Search, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createJobWatch, deleteJobWatch } from "@/api";
import { suggestScheduleTier } from "@/lib/jobWatchIntelligence";

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  location: string | null;
  remote_only: boolean;
  min_score: number;
  alert_enabled: boolean;
  job_watch_id: string | null;
}

interface Props {
  current: { query: string; location: string; remoteOnly: boolean; minScore: number };
  onApply: (s: SavedSearch) => void;
}

export function SavedSearches({ current, onApply }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["saved-searches", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_searches")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SavedSearch[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Sign in to save searches");
      const trimmed = name.trim() || current.query.trim() || "Untitled search";
      const { error } = await supabase.from("saved_searches").insert({
        user_id: user.id,
        name: trimmed,
        query: current.query,
        location: current.location || null,
        remote_only: current.remoteOnly,
        min_score: current.minScore,
        alert_enabled: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Search saved");
      setName("");
      qc.invalidateQueries({ queryKey: ["saved-searches", user?.id] });
    },
    onError: (e: any) => toast.error(e?.message || "Could not save"),
  });

  // Turning the bell on/off creates or deletes a real, backend-polled
  // job_watches row (the same standing-watch system Settings > Preferences
  // manages) instead of just flipping a column nothing reads server-side —
  // alert_enabled used to be a UI-only flag with zero backend consumer.
  const toggleAlert = useMutation({
    mutationFn: async (s: SavedSearch) => {
      if (!s.alert_enabled) {
        const watch = await createJobWatch({
          query_title: s.query || s.name,
          location: s.location || "Remote",
          schedule_tier: suggestScheduleTier(s.query || s.name),
        });
        const { error } = await supabase
          .from("saved_searches")
          .update({ alert_enabled: true, job_watch_id: watch.watch_id })
          .eq("id", s.id);
        if (error) throw error;
      } else {
        if (s.job_watch_id) {
          await deleteJobWatch(s.job_watch_id).catch(() => {
            // ponytail: the watch may already be gone (e.g. deleted from
            // Settings) — still clear the link so the saved search doesn't
            // point at a dead watch_id forever.
          });
        }
        const { error } = await supabase
          .from("saved_searches")
          .update({ alert_enabled: false, job_watch_id: null })
          .eq("id", s.id);
        if (error) throw error;
      }
    },
    onSuccess: (_data, s) => {
      toast.success(s.alert_enabled ? "Daily alert turned off." : "Daily alert enabled — checked on a schedule that matches this search.");
      qc.invalidateQueries({ queryKey: ["saved-searches", user?.id] });
    },
    onError: () => toast.error("Could not update this alert."),
  });

  const remove = useMutation({
    mutationFn: async (s: SavedSearch) => {
      if (s.job_watch_id) {
        await deleteJobWatch(s.job_watch_id).catch(() => {});
      }
      const { error } = await supabase.from("saved_searches").delete().eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-searches", user?.id] }),
  });

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Saved searches
      </h3>

      <div className="flex gap-2">
        <Input
          placeholder="Name this search…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 text-sm"
          onKeyDown={(e) => e.key === "Enter" && create.mutate()}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8 px-2"
          onClick={() => create.mutate()}
          disabled={create.isPending}
          aria-label="Save current search"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : data.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Save your filters to rerun them or get daily alerts.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {data.map((s) => (
            <li
              key={s.id}
              className="group flex items-center gap-2 rounded-md border border-border/60 px-2 py-1.5 hover:bg-accent/40"
            >
              <button
                onClick={() => onApply(s)}
                className="flex-1 min-w-0 text-left"
              >
                <div className="flex items-center gap-1.5">
                  <Search className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium truncate">{s.name}</span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate ml-4">
                  {[s.query, s.location, s.remote_only && "Remote", s.min_score > 0 && `${s.min_score}%+`]
                    .filter(Boolean)
                    .join(" · ") || "All jobs"}
                </p>
              </button>
              <button
                onClick={() => toggleAlert.mutate(s)}
                disabled={toggleAlert.isPending}
                aria-label="Toggle daily alert"
                className={cn(
                  "p-1 rounded transition-colors",
                  s.alert_enabled ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Bell className="w-3.5 h-3.5" fill={s.alert_enabled ? "currentColor" : "none"} />
              </button>
              <button
                onClick={() => remove.mutate(s)}
                aria-label="Delete saved search"
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
