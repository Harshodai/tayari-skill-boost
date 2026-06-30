import { useEffect, useState } from "react";
import { Brain } from "lucide-react";
import { Link } from "react-router-dom";
import { getPreferences, type PreferenceProfile } from "@/api";

// -------------------------------------------------------------------
// M4 — Dashboard surfacing of the memory layer.
//
// The preference profile (TF-IDF from likes/applies/skips) is the one
// moat zero competitors have — but it was invisible. This compact badge
// shows "AI remembers: …" on the Dashboard so users see the AI is
// learning them. Full breakdown lives in Settings (PreferenceProfileCard).
//
// SRP: fetch + one-line render. Fault-tolerant: renders null when there
// are no signals yet (new users) or the fetch fails. Never throws.
// ponytail: compact variant of PreferenceProfileCard — same fetch, fewer
// pixels. Add a richer rendering only if Dashboard engagement data says
// users want more here.
// -------------------------------------------------------------------

const EMPTY_PROFILE: PreferenceProfile = {
  user_id: "",
  preferred_titles: [],
  preferred_companies: [],
  counts: { liked: 0, applied: 0, skipped: 0 },
  skill_weights: {},
};
const MAX_REMEMBERED_TERMS = 3;

export function MemoryBadge() {
  const [profile, setProfile] = useState<PreferenceProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getPreferences();
        if (!cancelled) setProfile(res ?? EMPTY_PROFILE);
      } catch {
        // ponytail: silent — no profile yet is normal; badge just stays hidden.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!profile) return null;

  const terms = [
    ...profile.preferred_titles,
    ...profile.preferred_companies,
  ].slice(0, MAX_REMEMBERED_TERMS);
  const signalCount =
    profile.counts.liked + profile.counts.applied + profile.counts.skipped;

  // Hide until the AI has actually learned something — an empty "AI
  // remembers: nothing" badge is worse than no badge.
  if (terms.length === 0 && signalCount === 0) return null;

  const remembered = terms.length > 0
    ? terms.join(" · ")
    : `${signalCount} job signal${signalCount === 1 ? "" : "s"}`;

  return (
    <Link
      to="/settings"
      className="group flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/60 animate-fade-in-up"
      title="Your AI memory — managed in Settings"
    >
      <Brain className="w-3.5 h-3.5 text-primary shrink-0" />
      <span>
        <span className="font-medium text-foreground">AI remembers:</span>{" "}
        {remembered}
      </span>
    </Link>
  );
}