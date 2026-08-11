/**
 * Saved analytics filter presets.
 *
 * Presets are per-browser (localStorage) so an admin can flip between the
 * handful of windows they actually look at without retyping filters.
 */
export type AnalyticsPreset = {
  id: string;
  name: string;
  range: string;
  routeFilter: string;
  builtin?: boolean;
};

const KEY = "tayari.analytics.presets.v1";

export const BUILTIN_PRESETS: AnalyticsPreset[] = [
  { id: "builtin-7", name: "Last 7 days — all routes", range: "7", routeFilter: "", builtin: true },
  { id: "builtin-30", name: "Last 30 days — all routes", range: "30", routeFilter: "", builtin: true },
  { id: "builtin-pipeline", name: "30d — pipeline & apply", range: "30", routeFilter: "/pipeline", builtin: true },
  { id: "builtin-resume", name: "90d — resume flows", range: "90", routeFilter: "/resume", builtin: true },
];

export function loadPresets(): AnalyticsPreset[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is AnalyticsPreset =>
        !!p && typeof (p as AnalyticsPreset).id === "string" && typeof (p as AnalyticsPreset).name === "string",
    );
  } catch {
    return [];
  }
}

export function savePresets(presets: AnalyticsPreset[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(presets.filter((p) => !p.builtin)));
  } catch {
    /* storage unavailable — presets stay in-memory for this session */
  }
}
