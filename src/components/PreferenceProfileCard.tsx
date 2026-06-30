import { useEffect, useState } from "react";
import { RefreshCw, ThumbsUp, Briefcase, Building2, Tag } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getPreferences, refreshPreferences, type PreferenceProfile } from "@/api";

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getPreferences();
        if (!cancelled) setProfile(res ?? EMPTY_PROFILE);
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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await refreshPreferences();
      setProfile(res ?? EMPTY_PROFILE);
    } catch {
      // ignore — toast not warranted for a Settings nicety
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