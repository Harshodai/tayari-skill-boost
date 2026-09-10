import { useState } from "react";
import { Loader2, Plus, Radio, RefreshCw, Trash2 } from "lucide-react";
import { SubstackWatch } from "@/api/ai";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function statusLabel(status: string | null) {
  if (!status) return "Not polled yet";
  return { ok: "Synced", failed: "Needs attention" }[status] || status;
}

export function OmniSaveSubstackWatchCard({
  watches,
  onAdd,
  onRemove,
  busy,
}: {
  watches: SubstackWatch[];
  onAdd: (publicationUrl: string) => Promise<void>;
  onRemove: (watchId: string) => Promise<void>;
  busy: boolean;
}) {
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const add = async () => {
    if (!url.trim() || adding) return;
    setAdding(true);
    setMessage(null);
    try {
      await onAdd(url.trim());
      setUrl("");
      setMessage("Publication added — it's checked automatically about every 15 minutes.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That publication couldn't be added.");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (watchId: string) => {
    setRemovingId(watchId);
    try {
      await onRemove(watchId);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Card className="border-border/70 bg-background/50">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2"><Radio className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Watch a Substack publication</CardTitle></div>
            <CardDescription className="mt-1 max-w-2xl text-xs leading-5">Substack is the one source OmniSaveAI can keep in sync without a browser tab open — new posts from a publication you're subscribed to are pulled in automatically, roughly every 15 minutes.</CardDescription>
          </div>
          <Badge variant="outline">Background sync</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") void add(); }}
            placeholder="e.g. https://blog.example.substack.com or the publication's own domain"
            aria-label="Substack publication URL to watch"
            disabled={adding || busy}
          />
          <Button type="button" onClick={() => void add()} disabled={!url.trim() || adding || busy}>
            {adding ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-2 h-3.5 w-3.5" />}Watch
          </Button>
        </div>
        {message && <p className="text-xs text-muted-foreground" role="status">{message}</p>}
        {watches.length > 0 && (
          <div className="space-y-2">
            {watches.map((watch) => (
              <div key={watch.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{watch.publication_url}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <Badge variant={watch.last_poll_status === "failed" ? "destructive" : "outline"} className="gap-1"><RefreshCw className="h-3 w-3" />{statusLabel(watch.last_poll_status)}</Badge>
                    {watch.last_polled_at && <span>last checked {new Date(watch.last_polled_at).toLocaleString()}</span>}
                    <span>{watch.last_ingested_count} post{watch.last_ingested_count === 1 ? "" : "s"} pulled last check</span>
                  </div>
                  {watch.last_poll_error && <p className="mt-1 text-xs text-destructive">{watch.last_poll_error}</p>}
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => void remove(watch.id)} disabled={removingId === watch.id} aria-label={`Stop watching ${watch.publication_url}`}>
                  {removingId === watch.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
