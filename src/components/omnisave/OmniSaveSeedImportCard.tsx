import { useRef, useState } from "react";
import { CheckCircle2, FileUp, Loader2, RefreshCw, UploadCloud } from "lucide-react";
import { OmniSaveSeedJob } from "@/api/ai";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function statusLabel(status: string) {
  return { pending: "Ready", running: "Hydrating", completed: "Complete", partial: "Partial", failed: "Needs retry" }[status] || status;
}

export function OmniSaveSeedImportCard({
  jobs,
  onCreate,
  onHydrate,
  busy,
}: {
  jobs: OmniSaveSeedJob[];
  onCreate: (fileName: string, csvText: string) => Promise<void>;
  onHydrate: (jobId: string) => Promise<void>;
  busy: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRequest = useRef(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState("");
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const chooseFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 5_000_000) {
      setMessage("Choose a CSV smaller than 5 MB.");
      return;
    }
    const request = ++fileRequest.current;
    setReading(true);
    setMessage(null);
    try {
      setSelectedFile(file);
      const text = await file.text();
      if (request !== fileRequest.current) return; // stale read: a newer file was chosen
      setCsvText(text);
    } catch {
      if (request !== fileRequest.current) return;
      setSelectedFile(null);
      setCsvText("");
      setMessage("The CSV could not be read from this device.");
    } finally {
      if (request === fileRequest.current) setReading(false);
    }
  };

  const upload = async () => {
    if (!selectedFile || !csvText) return;
    try {
      await onCreate(selectedFile.name, csvText);
      setSelectedFile(null);
      setCsvText("");
      if (inputRef.current) inputRef.current.value = "";
      setMessage("Seed import created. The first hydration batch is starting.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The seed import could not be created.");
    }
  };

  return (
    <Card className="border-border/70 bg-background/50">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2"><FileUp className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Bring in your existing LinkedIn library</CardTitle></div>
            <CardDescription className="mt-1 max-w-2xl text-xs leading-5">Upload LinkedIn’s saved-items CSV as a safe seed list. OmniSaveAI keeps the original save date, deduplicates URLs, and hydrates the library in resumable batches.</CardDescription>
          </div>
          <Badge variant="outline">CSV seed + browser hydration</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><UploadCloud className="h-5 w-5 text-primary" /><div><p className="text-sm font-medium">Start a resumable import</p><p className="text-xs text-muted-foreground">The CSV contains links and dates; each link is hydrated separately so blocked pages can be retried.</p></div></div>
          <div className="flex flex-wrap gap-2"><input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void chooseFile(event.target.files?.[0])} /><Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={reading || busy}>{reading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <FileUp className="mr-2 h-3.5 w-3.5" />}Choose CSV</Button><Button type="button" size="sm" onClick={() => void upload()} disabled={!selectedFile || !csvText || busy || reading}>{busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="mr-2 h-3.5 w-3.5" />}Import library</Button></div>
        </div>
        {selectedFile && <p className="text-xs text-muted-foreground" role="status">Selected: <span className="font-medium text-foreground">{selectedFile.name}</span> · {Math.round(selectedFile.size / 1024)} KB</p>}
        {message && <p className="text-xs text-muted-foreground" role="status">{message}</p>}
        {jobs.length > 0 && <div className="space-y-2"><p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Import history</p>{jobs.slice(0, 3).map((job) => { const progress = job.total_count ? Math.min(100, Math.round((job.hydrated_count / job.total_count) * 100)) : 0; const canHydrate = job.status !== "completed" && job.status !== "running"; return <div key={job.id} className="rounded-xl border border-border/70 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="text-sm font-medium">{job.file_name}</span><Badge variant={job.status === "completed" ? "default" : "outline"}>{statusLabel(job.status)}</Badge></div>{canHydrate && <Button type="button" variant="outline" size="sm" onClick={() => void onHydrate(job.id)} disabled={busy}><RefreshCw className="mr-2 h-3.5 w-3.5" />Hydrate next batch</Button>}{job.status === "completed" && <CheckCircle2 className="h-4 w-4 text-primary" />}</div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{job.hydrated_count}/{job.total_count} hydrated</span><span>{job.imported_count} imported</span><span>{job.skipped_count} skipped</span><span>{job.failed_count} failed</span></div>{job.last_error && <p className="mt-2 text-xs text-destructive">{job.last_error}</p>}</div>; })}</div>}
      </CardContent>
    </Card>
  );
}
