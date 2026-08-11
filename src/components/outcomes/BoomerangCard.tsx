import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertCircle, Radar } from "lucide-react";
import { toast } from "sonner";

/**
 * WS-10 Boomerang mode.
 *
 * Once a user reaches an offer, active job hunting stops and the account is
 * worth nothing — the structural LTV cap of this whole category. Boomerang
 * flips them into passive monitoring instead of churn: their saved searches
 * keep running as alerts, and we keep tracking the market for their title.
 *
 * State lives in `pet_preferences.state.boomerang` (the per-user JSON blob we
 * already sync), and enabling it really does turn on alerts for every saved
 * search — nothing here is cosmetic.
 */
export function BoomerangCard({ userId, offers }: { userId?: string; offers: number }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const prefsQuery = useQuery({
    queryKey: ["boomerang-prefs", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pet_preferences")
        .select("state")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return (data?.state ?? {}) as Record<string, unknown>;
    },
  });

  const searchesQuery = useQuery({
    queryKey: ["boomerang-searches", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_searches")
        .select("id,name,alert_enabled")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const enabled = Boolean((prefsQuery.data as any)?.boomerang?.enabled);
  const searches = searchesQuery.data ?? [];

  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      if (!userId) throw new Error("You need to be signed in.");
      const state = { ...(prefsQuery.data ?? {}) } as Record<string, unknown>;
      state.boomerang = { enabled: next, since: new Date().toISOString() };

      const { error: prefError } = await supabase
        .from("pet_preferences")
        .upsert({ user_id: userId, state }, { onConflict: "user_id" });
      if (prefError) throw prefError;

      if (searches.length) {
        const { error: searchError } = await supabase
          .from("saved_searches")
          .update({ alert_enabled: next })
          .eq("user_id", userId);
        if (searchError) throw searchError;
      }
      return next;
    },
    onSuccess: (next) => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["boomerang-prefs", userId] });
      queryClient.invalidateQueries({ queryKey: ["boomerang-searches", userId] });
      toast.success(next ? "Boomerang mode on — passive monitoring active" : "Boomerang mode off");
    },
    onError: (e: any) => setError(e?.message || "Could not update boomerang mode"),
  });

  if (offers < 1) return null;

  return (
    <Card className="border-emerald-500/30">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg">Boomerang mode</CardTitle>
          <Badge variant="outline" className="border-emerald-500/25 bg-emerald-500/10 text-emerald-600">
            <Radar className="mr-1 h-3.5 w-3.5" /> Offer detected
          </Badge>
        </div>
        <CardDescription>
          You have an offer. Switch off the active hunt and keep a quiet watch on the market —
          your saved searches keep running as alerts so you hear about the next move first.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="boomerang-toggle" className="text-sm font-medium">
              Passive monitoring
            </Label>
            <p className="text-xs text-muted-foreground">
              {searches.length
                ? `Keeps alerts on for ${searches.length} saved search${searches.length === 1 ? "" : "es"}.`
                : "Save a search first and it will be monitored here."}
            </p>
          </div>
          <Switch
            id="boomerang-toggle"
            checked={enabled}
            disabled={toggle.isPending || prefsQuery.isLoading}
            onCheckedChange={(v) => toggle.mutate(v)}
          />
        </div>

        {enabled ? (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {searches.length === 0 ? (
              <li>No saved searches yet — nothing is being monitored.</li>
            ) : (
              searches.map((s: any) => (
                <li key={s.id} className="flex items-center justify-between rounded border px-2 py-1">
                  <span className="truncate">{s.name}</span>
                  <Badge variant="outline" className="ml-2 shrink-0 text-[10px]">
                    {s.alert_enabled ? "watching" : "paused"}
                  </Badge>
                </li>
              ))
            )}
          </ul>
        ) : (
          <Button variant="outline" size="sm" onClick={() => toggle.mutate(true)} disabled={toggle.isPending}>
            Turn on monitoring
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default BoomerangCard;
