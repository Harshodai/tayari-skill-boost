import { useEffect, useState } from "react";
import { RefreshCw, ThumbsUp, Briefcase, Building2, Tag, Clock3, Trash2, ShieldQuestion } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { deleteMemoryControl, getPreferences, listMemoryControls, refreshPreferences, updateMemoryControl, type MemoryControl, type PreferenceProfile } from "@/api";

// -------------------------------------------------------------------
// M4 — preference profile visualization for the Settings page.
//
// Fetches GET /api/v1/preferences (TF-IDF-weighted profile derived from
// feedback signals) and renders preferred roles / companies / signal
// counts / top skill weights. Refresh button force-refreshes the matview.
//
// SRP: owns only fetch + render. Fault-tolerant: renders nothing on error
// (a missing profile is not a Settings-breaking condition).
// -------------------------------------------------------------------

const EMPTY_PROFILE: PreferenceProfile = {
  user_id: "",
  preferred_titles: [],
  preferred_companies: [],
  counts: { liked: 0, applied: 0, skipped: 0 },
  skill_weights: {},
};

const MAX_SKILL_CHIPS = 12;

export function PreferenceProfileCard() {
  const [profile, setProfile] = useState<PreferenceProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [controls, setControls] = useState<MemoryControl[]>([]);
  const [controlAction, setControlAction] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [res, learnedControls] = await Promise.all([getPreferences(), listMemoryControls()]);
        if (!cancelled) {
          setProfile(res ?? EMPTY_PROFILE);
          setControls(learnedControls);
        }
      } catch {
        // ponytail: silent — no profile yet is a normal state for new users.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleControl = async (control: MemoryControl) => {
    setControlAction(control.id);
    try {
      const updated = await updateMemoryControl(control.id, { is_active: !control.is_active });
      setControls((items) => items.map((item) => item.id === updated.id ? updated : item));
      toast.success(updated.is_active ? "Signal restored to your preference profile." : "Signal excluded from future personalization.");
    } catch {
      toast.error("Could not update this preference signal.");
    } finally {
      setControlAction(null);
    }
  };

  const handleDeleteControl = async (control: MemoryControl) => {
    if (!window.confirm("Delete this learned preference signal? It will no longer be used for personalization.")) return;
    setControlAction(control.id);
    try {
      await deleteMemoryControl(control.id);
      setControls((items) => items.filter((item) => item.id !== control.id));
      toast.success("Preference signal deleted.");
    } catch {
      toast.error("Could not delete this preference signal.");
    } finally {
      setControlAction(null);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await refreshPreferences();
      setProfile(res ?? EMPTY_PROFILE);
    } catch {
      // ponytail: this used to fail silently on an explicit Refresh click —
      // the spinner just stopped with no indication whether it worked.
      toast.error("Could not refresh your preference profile. Try again in a moment.");
    } finally {
      setRefreshing(false);
    }
  };

  const hasSignal =
    profile.preferred_titles.length > 0 ||
    profile.preferred_companies.length > 0 ||
    Object.keys(profile.skill_weights).length > 0;

  const topSkills = Object.entries(profile.skill_weights)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SKILL_CHIPS);

  if (loading) {
    return (
      <Card className="animate-fade-in-up">
        <CardHeader>
          <CardTitle>Career Preferences</CardTitle>
          <CardDescription>Learning your taste from your feedback</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-24 bg-muted rounded-lg animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-fade-in-up">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Career Preferences</CardTitle>
          <CardDescription>
            Learned from your likes, applications, and skips
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {!hasSignal ? (
          <div className="text-center py-6">
            <ThumbsUp className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No preference signals yet. Like or apply to jobs in Job Search and we'll learn your taste.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 text-center">
              <SignalStat label="Liked" value={profile.counts.liked} />
              <SignalStat label="Applied" value={profile.counts.applied} />
              <SignalStat label="Skipped" value={profile.counts.skipped} />
            </div>

            {profile.preferred_titles.length > 0 && (
              <PreferenceRow icon={<Briefcase className="w-4 h-4" />} label="Preferred roles">
                {profile.preferred_titles.map((t) => (
                  <Badge key={t} variant="secondary" className="mr-1 mb-1">{t}</Badge>
                ))}
              </PreferenceRow>
            )}

            {profile.preferred_companies.length > 0 && (
              <PreferenceRow icon={<Building2 className="w-4 h-4" />} label="Preferred companies">
                {profile.preferred_companies.map((c) => (
                  <Badge key={c} variant="outline" className="mr-1 mb-1">{c}</Badge>
                ))}
              </PreferenceRow>
            )}

            {topSkills.length > 0 && (
              <PreferenceRow icon={<Tag className="w-4 h-4" />} label="Skill weights (TF-IDF)">
                {topSkills.map(([skill, weight]) => (
                  <Badge
                    key={skill}
                    variant="secondary"
                    className="mr-1 mb-1"
                    title={`weight ${weight}`}
                  >
                    {skill}
                    <span className="ml-1 text-[10px] opacity-60">{weight}</span>
                  </Badge>
                ))}
              </PreferenceRow>
            )}
          </>
        )}

        <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
          <div className="flex items-start gap-2">
            <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">Control what Job Tayari remembers</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Disable a signal when it is stale, or delete it permanently. Disabled and expired signals are excluded from future preference learning.</p>
            </div>
          </div>
          {controls.length > 0 ? (
            <div className="mt-4 space-y-2">
              {controls.slice(0, 8).map((control) => (
                <div key={control.id} className="flex flex-col gap-2 rounded-lg border border-border/50 bg-background/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">{control.job_title || control.feedback_type}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{control.company_name || control.job_id} · {control.feedback_source} · {control.confidence.replace(/_/g, " ")}</p>
                    {control.expires_at && <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"><Clock3 className="h-3 w-3" /> Expires {new Date(control.expires_at).toLocaleDateString()}</p>}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={controlAction === control.id} onClick={() => void handleToggleControl(control)} className="h-8 text-xs">{control.is_active ? "Disable" : "Restore"}</Button>
                    <Button type="button" variant="ghost" size="sm" disabled={controlAction === control.id} onClick={() => void handleDeleteControl(control)} className="h-8 text-xs text-destructive hover:text-destructive"><Trash2 className="mr-1 h-3.5 w-3.5" />Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="mt-3 text-xs text-muted-foreground">No individually learned signals are available yet.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function SignalStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-muted/40 p-2.5 rounded-lg border border-border/50">
      <div className="text-xl font-bold font-mono text-primary">{value}</div>
      <div className="text-[10px] text-muted-foreground font-medium mt-0.5">{label}</div>
    </div>
  );
}

function PreferenceRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
        {icon}
        {label}
      </div>
      <div className="flex flex-wrap">{children}</div>
    </div>
  );
}