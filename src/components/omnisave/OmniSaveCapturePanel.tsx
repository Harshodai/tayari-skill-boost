import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, Eye, Loader2, RefreshCw, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";
import { OmniSaveCaptureRun, OmniSaveSyncRun, OmniSaveSyncSettings, SavedArticleItem } from "@/api/ai";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const platforms = [
  { id: "linkedin", label: "LinkedIn", hint: "Saved posts" },
  { id: "medium", label: "Medium", hint: "Reading list" },
  { id: "substack", label: "Substack", hint: "Open feeds" },
  { id: "instagram", label: "Instagram", hint: "Saved activity" },
] as const;

function formatTime(value?: string | null) {
  if (!value) return "Not yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not yet" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function statusLabel(status: string) {
  return { never: "Not synced", queued: "Queued", running: "Syncing", completed: "Healthy", partial: "Partial sync", failed: "Needs attention", cancel_requested: "Stopping", cancelled: "Cancelled", blocked: "Blocked", paused: "Paused" }[status] || status;
}

function diagnosticFor(error?: string | null) {
  const normalized = String(error || "").toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("unknown external action")) {
    return "The browser companion is running an older service worker. Open chrome://extensions, reload the unpacked extension, confirm chrome.runtime.getManifest().version returns 3.2.0, then reload the saved-content tabs.";
  }
  if (normalized.includes("not authenticated") || normalized.includes("authentication")) {
    return "The source tab is not authenticated in the same Chrome profile as the companion. Open the platform's saved-content page, complete sign-in, confirm saved cards are visible, and retry without using an incognito or different profile.";
  }
  if (normalized.includes("no_visible_sources") || normalized.includes("no visible sources")) {
    return "The page loaded but no visible article-shaped links matched the collector rules. Scroll until saved cards render, then verify the page contains supported article links rather than only /saved, /lists, /feed, or other utility URLs.";
  }
  return null;
}

export function OmniSaveCapturePanel({
  settings,
  runs,
  captureRuns = [],
  extensionInstalled,
  onSettingsChange,
  onFullHistoryChange,
  fullHistoryEnabled = false,
  onSyncNow,
  onExport,
  busy,
  sources,
}: {
  settings: OmniSaveSyncSettings | null;
  runs: OmniSaveSyncRun[];
  captureRuns?: OmniSaveCaptureRun[];
  extensionInstalled: boolean;
  onSettingsChange: (next: { enabled: boolean; platforms: string[]; interval_minutes: number }) => Promise<void>;
  onFullHistoryChange?: (enabled: boolean) => Promise<void>;
  fullHistoryEnabled?: boolean;
  onSyncNow: () => Promise<void>;
  onExport: (format: "json" | "markdown" | "csv") => Promise<void>;
  busy: boolean;
  sources: SavedArticleItem[];
}) {
  const [saving, setSaving] = useState(false);
  const [showConsent, setShowConsent] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("omnisave-consent-seen") !== "true";
  });
  const consentPaused = typeof window !== "undefined" && window.localStorage.getItem("omnisave-consent-paused") === "true";
  const enabled = (settings?.enabled ?? false) && !consentPaused;
  const selectedPlatforms = settings?.platforms || platforms.map((platform) => platform.id);
  const [interval, setInterval] = useState(String(settings?.interval_minutes || 60));
  const [message, setMessage] = useState<string | null>(null);
  const [fullHistory, setFullHistory] = useState(Boolean(fullHistoryEnabled));
  const currentStatus = settings?.last_status || "never";
  const latestRun = runs[0];
  const latestCaptureRun = captureRuns[0];
  const latestError = latestCaptureRun?.last_error || settings?.last_error || (latestRun?.errors?.length ? JSON.stringify(latestRun.errors[0]) : null);
  const diagnostic = diagnosticFor(latestError);
  const selectedCount = useMemo(() => selectedPlatforms.length, [selectedPlatforms]);
  const platformHealth = useMemo(() => platforms.map((platform) => {
    const platformSources = sources.filter((source) => source.platform === platform.id);
    const sortedSeen = platformSources.map((source) => source.last_seen_at).filter(Boolean).sort();
    const lastSeen = sortedSeen.length ? sortedSeen[sortedSeen.length - 1] : undefined;
    const pending = platformSources.filter((source) => !source.sync_status || !["synced", "completed", "ready"].includes(source.sync_status.toLowerCase())).length;
    const lastError = platformSources.find((source) => source.last_sync_error)?.last_sync_error;
    return { ...platform, lastSeen, pending, lastError };
  }), [sources]);
  useEffect(() => { if (settings?.interval_minutes) setInterval(String(settings.interval_minutes)); }, [settings?.interval_minutes]);
  useEffect(() => { setFullHistory(Boolean(fullHistoryEnabled)); }, [fullHistoryEnabled]);

  const acknowledgeConsent = () => {
    window.localStorage.setItem("omnisave-consent-seen", "true");
    window.localStorage.removeItem("omnisave-consent-paused");
    setShowConsent(false);
  };

  const keepPaused = () => {
    // Keep paused is a decision, not a dismissal: persist the paused choice
    // locally and force the capture switch off so the in-page capture UI
    // honors the declined consent.
    window.localStorage.setItem("omnisave-consent-seen", "true");
    window.localStorage.setItem("omnisave-consent-paused", "true");
    setShowConsent(false);
    if (enabled) void save(false, selectedPlatforms, interval);
  };

  const save = async (nextEnabled = enabled, nextPlatforms = selectedPlatforms, nextInterval = interval) => {
    setSaving(true);
    setMessage(null);
    const clampedInterval = Math.max(5, Math.min(1440, Number(nextInterval) || 60));
    setInterval(String(clampedInterval));
    try {
      // Explicitly re-enabling after "Keep paused" is itself consent.
      if (nextEnabled) window.localStorage.removeItem("omnisave-consent-paused");
      await onSettingsChange({ enabled: nextEnabled, platforms: nextPlatforms, interval_minutes: clampedInterval });
      setMessage(nextEnabled ? "Automatic capture is on." : "Automatic capture is paused.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save capture settings.");
    } finally {
      setSaving(false);
    }
  };

  const togglePlatform = (platform: string) => {
    const next = selectedPlatforms.includes(platform) ? selectedPlatforms.filter((item) => item !== platform) : [...selectedPlatforms, platform];
    if (next.length) {
      void save(enabled, next, interval);
    } else {
      setMessage("Select at least one platform to capture.");
    }
  };

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-primary/[0.05]">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Capture once. Stay in sync.</CardTitle>
              <Badge variant={enabled ? "default" : "secondary"}>{enabled ? "Automatic" : "Paused"}</Badge>
            </div>
            <CardDescription className="mt-2 max-w-2xl leading-6">
              With your permission, the browser companion reads only visible public links from the saved-content pages you choose. It never receives your passwords and never submits or shares anything.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => void onSyncNow()} disabled={!extensionInstalled || busy}>
              {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
              Sync open saved pages
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void onExport("markdown")} disabled={busy}>
              <Download className="mr-2 h-3.5 w-3.5" /> Export Markdown
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void onExport("json")} disabled={busy}>
              <Download className="mr-2 h-3.5 w-3.5" /> Export JSON
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void onExport("csv")} disabled={busy}>
              <Download className="mr-2 h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5 p-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          {showConsent && <div className="rounded-xl border border-primary/25 bg-primary/[0.06] p-4" role="region" aria-label="Automatic capture privacy explanation"><div className="flex items-start gap-3"><Eye className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="text-sm font-medium">Automatic capture is consented and scoped</p><p className="mt-1 text-xs leading-5 text-muted-foreground">OmniSaveAI reads visible links and supported metadata from the saved-content pages you choose. It never reads passwords, private messages, arbitrary tabs, or unrelated pages, and it never posts or shares for you.</p><div className="mt-3 flex flex-wrap gap-2"><Button type="button" size="sm" onClick={acknowledgeConsent}>I understand</Button><Button type="button" variant="ghost" size="sm" onClick={keepPaused}>Keep paused</Button></div></div></div></div>}
          <div className="flex items-start justify-between gap-4 rounded-xl border border-border/70 bg-background/60 p-4">
            <div>
              <p className="text-sm font-medium">Automatic capture</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Runs in the signed-in browser companion at the interval you select. Disabled by default.</p>
            </div>
            <input aria-label="Enable automatic capture" type="checkbox" checked={enabled} disabled={saving || !extensionInstalled} onChange={(event) => void save(event.target.checked, selectedPlatforms, interval)} className="mt-1 h-5 w-5 accent-primary" />
          </div>
          <div className="flex items-start justify-between gap-4 rounded-xl border border-border/70 bg-background/60 p-4"><div><p className="text-sm font-medium">Full-history capture (beta)</p><p className="mt-1 text-xs leading-5 text-muted-foreground">When enabled, the signed-in companion advances the selected saved-content page in bounded batches, records a resumable checkpoint, and stops at the configured item limit. It does not read passwords, private messages, or unrelated tabs.</p></div><input aria-label="Enable full-history capture" type="checkbox" checked={fullHistory} disabled={saving || !extensionInstalled || !onFullHistoryChange} onChange={async (event) => { const next = event.target.checked; setFullHistory(next); try { await onFullHistoryChange?.(next); setMessage(next ? "Full-history capture enabled for the companion." : "Full-history capture disabled."); } catch (error) { setFullHistory(!next); setMessage(error instanceof Error ? error.message : "Could not update full-history capture."); } }} className="mt-1 h-5 w-5 accent-primary" /></div>
          {!extensionInstalled && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100"><p>Connect the JobTayari browser companion to pull the authenticated saved libraries you have open in Medium, LinkedIn, or Substack. Public URL import remains available below.</p><Button asChild type="button" size="sm" variant="outline" className="mt-3 border-amber-300/40 bg-transparent text-amber-100 hover:bg-amber-200/10"><a href="/extension-onboarding">Connect browser companion</a></Button></div>}
          <div>
            <div className="mb-2 flex items-center justify-between gap-3"><p className="text-sm font-medium">Sources to watch</p><span className="text-xs text-muted-foreground">{selectedCount} selected</span></div>
            <div className="grid gap-2 sm:grid-cols-2">
              {platforms.map((platform) => {
                const selected = selectedPlatforms.includes(platform.id);
                return <button key={platform.id} type="button" onClick={() => togglePlatform(platform.id)} disabled={saving || !extensionInstalled} className={`rounded-xl border p-3 text-left transition-colors ${selected ? "border-primary/40 bg-primary/[0.08]" : "border-border/70 bg-background/50 opacity-70"}`}><div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{platform.label}</span>{selected && <CheckCircle2 className="h-4 w-4 text-primary" />}</div><span className="mt-1 block text-xs text-muted-foreground">{platform.hint}</span></button>;
              })}
            </div>
          </div>
          <div className="flex items-end gap-3"><div className="max-w-[180px] flex-1"><label htmlFor="omnisave-sync-interval" className="text-xs font-medium">Sync interval (minutes)</label><Input id="omnisave-sync-interval" type="number" min={5} max={1440} value={interval} onChange={(event) => setInterval(event.target.value)} onBlur={() => void save(enabled, selectedPlatforms, interval)} className="mt-2" /></div><p className="pb-2 text-xs leading-5 text-muted-foreground">The companion checks only the supported saved-content pages currently open in your browser.</p></div>
          {message && <p className="text-xs text-muted-foreground" role="status">{message}</p>}
        </div>
        <div className="space-y-3">
          <div className="rounded-xl border border-border/70 bg-background/60 p-4"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /><p className="text-sm font-medium">Sync health</p></div><p className="mt-3 text-2xl font-semibold">{statusLabel(currentStatus)}</p><p className="mt-1 text-xs text-muted-foreground">Last completed: {formatTime(settings?.last_completed_at)}</p>{latestError && <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{latestError}</p>}{diagnostic && <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100"><p className="font-semibold">What to check</p><p className="mt-1">{diagnostic}</p></div>}</div>
          <div className="rounded-xl border border-border/70 bg-background/60 p-4"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><p className="text-sm font-medium">Recent capture</p></div>{latestRun ? <div className="mt-3 space-y-2 text-xs text-muted-foreground"><div className="flex justify-between gap-3"><span>{latestRun.trigger_type} run</span><Badge variant="outline">{statusLabel(latestRun.status)}</Badge></div><div className="flex justify-between gap-3"><span>Imported</span><span className="font-medium text-foreground">{latestRun.imported_count}</span></div><div className="flex justify-between gap-3"><span>Skipped</span><span>{latestRun.skipped_count}</span></div><div className="flex justify-between gap-3"><span>Failed</span><span>{latestRun.failed_count}</span></div><p className="pt-1">Started {formatTime(latestRun.started_at)}</p></div> : <p className="mt-3 text-xs leading-5 text-muted-foreground">No sync runs yet. Open a saved-content page and choose Sync open saved pages.</p>}{latestCaptureRun && <div className="mt-4 border-t border-border/60 pt-3"><div className="flex justify-between gap-3"><span>Full-history {latestCaptureRun.platform}</span><Badge variant="outline">{statusLabel(latestCaptureRun.status)}</Badge></div><div className="mt-2 grid grid-cols-2 gap-2"><span>Pages {latestCaptureRun.page_count}</span><span>Found {latestCaptureRun.discovered_count}</span><span>Imported {latestCaptureRun.imported_count}</span><span>Failed {latestCaptureRun.failed_count}</span></div>{latestCaptureRun.last_error && <p className="mt-2 text-destructive">{latestCaptureRun.last_error}</p>}</div>}</div>
          <div className="rounded-xl border border-border/70 bg-background/60 p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">Platform health</p><Badge variant="outline">{platformHealth.filter((item) => item.pending > 0).length} needs review</Badge></div><div className="mt-3 space-y-2">{platformHealth.map((item) => <div key={item.id} className="rounded-lg border border-border/60 p-2.5"><div className="flex items-center justify-between gap-2 text-xs"><span className="font-medium">{item.label}</span><span className="text-muted-foreground">{item.pending} pending</span></div><p className="mt-1 text-[11px] text-muted-foreground">Last success: {item.lastSeen ? formatTime(item.lastSeen) : "Not yet"}</p>{item.lastError && <p className="mt-1 truncate text-[11px] text-destructive" title={item.lastError}>{item.lastError}</p>}</div>)}</div></div>
        </div>
      </CardContent>
    </Card>
  );
}
