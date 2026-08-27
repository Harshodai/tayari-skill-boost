// Shared logic between the two "get notified about new jobs" surfaces on the
// site: the Settings > Preferences "Standing Job Watches" card and the Job
// Search page's "Daily alerts" bell on a saved search. Keeping the tier
// heuristic, next-check math, and dedupe check in one place means both
// surfaces behave identically instead of drifting into two separate,
// slightly-different implementations of the same idea.

export type ScheduleTier = "hourly" | "daily" | "weekly";

// Mirrors backend/python/app/tasks/automation.py's TIER_INTERVALS exactly —
// keep both in sync if either changes.
export const TIER_INTERVAL_MS: Record<ScheduleTier, number> = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

const URGENT_PATTERNS = [/\burgent\b/i, /\bimmediate(ly)?\b/i, /\basap\b/i, /hiring now/i, /start(ing)? (now|immediately)/i];
const SENIOR_PATTERNS = [/\bstaff\b/i, /\bprincipal\b/i, /\bdistinguished\b/i, /\bdirector\b/i, /\bvp\b/i, /\bvice president\b/i, /head of/i, /\bexecutive\b/i, /\bchief\b/i];

/**
 * Suggests a check frequency from the job title alone. Openings phrased as
 * urgent/immediate hires churn fast (hourly is worth the noise); senior/exec
 * roles open rarely and stay open longer (weekly is enough); everything else
 * defaults to daily. This is a plain heuristic, not a model — it's meant to
 * save a click for the common case, not to be always right; the tier picker
 * next to it is always available to override.
 */
export function suggestScheduleTier(title: string): ScheduleTier {
  const trimmed = title.trim();
  if (!trimmed) return "daily";
  if (URGENT_PATTERNS.some((re) => re.test(trimmed))) return "hourly";
  if (SENIOR_PATTERNS.some((re) => re.test(trimmed))) return "weekly";
  return "daily";
}

/**
 * Human-readable "next check" estimate from last_run_at + the watch's own
 * tier interval — pure client-side math against data the API already
 * returns, no extra request needed. An unrecognized tier falls back to the
 * daily interval, matching the backend's own fallback.
 */
export function formatNextCheck(lastRunAt: string | null | undefined, tier: string): string {
  // A watch that has never run is always due on the next beat tick (matches
  // run_standing_job_watches: last_run_at IS NULL always fires) — it never
  // waits out a fresh full interval from "now".
  if (!lastRunAt) return "Checking soon";

  const interval = TIER_INTERVAL_MS[tier as ScheduleTier] ?? TIER_INTERVAL_MS.daily;
  const baseMs = new Date(lastRunAt).getTime();
  if (Number.isNaN(baseMs)) return "Checking soon";
  const diffMs = baseMs + interval - Date.now();
  if (diffMs <= 0) return "Checking soon";

  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `Next check in ~${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Next check in ~${hours}h`;
  const days = Math.round(hours / 24);
  return `Next check in ~${days}d`;
}

/**
 * True if an existing watch already covers the same title+location (case-
 * insensitive, whitespace-trimmed, "" treated as "remote" like the backend
 * default) — used to warn before creating a near-duplicate standing watch.
 */
export function isDuplicateWatch(
  existing: Array<{ query_title: string; location: string }>,
  title: string,
  location: string
): boolean {
  const normTitle = title.trim().toLowerCase();
  const normLocation = (location || "remote").trim().toLowerCase();
  return existing.some(
    (w) =>
      w.query_title.trim().toLowerCase() === normTitle &&
      (w.location || "remote").trim().toLowerCase() === normLocation
  );
}
