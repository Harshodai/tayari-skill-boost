import { useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle, Eye, LoaderCircle, Lock, Monitor, Pause, RefreshCw, ShieldCheck, Terminal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getBrowserRunControlState, type BrowserControlState } from '@/api/browser';

interface PreviewSafeguard { step: number; action: string; detail: string; }

const previewSafeguards: PreviewSafeguard[] = [
  { step: 1, action: 'Verify an approved job and candidate profile', detail: 'A real run must use the job version and profile the candidate reviewed.' },
  { step: 2, action: 'Verify approved application artifacts', detail: 'A changed resume, cover letter, or answer requires a new review.' },
  { step: 3, action: 'Open a permitted source in an isolated session', detail: 'The product must block unapproved portals and avoid shared browser sessions.' },
  { step: 4, action: 'Hand off sensitive questions', detail: 'Work authorization, disability, demographic, compensation, and legal attestations stay with the candidate.' },
  { step: 5, action: 'Require a candidate-controlled final action', detail: 'A local status update is not proof of an external submission.' },
];

const statusClass: Record<BrowserControlState['status'], string> = {
  queued: 'border-slate-700 bg-slate-800 text-slate-200',
  running: 'border-blue-800 bg-blue-950 text-blue-200',
  completed: 'border-emerald-800 bg-emerald-950 text-emerald-200',
  failed: 'border-red-800 bg-red-950 text-red-200',
  cancelled: 'border-amber-800 bg-amber-950 text-amber-200',
};

export const TayariComputerControlRoom = () => {
  const [showSafetyDetails, setShowSafetyDetails] = useState(false);
  const [runId, setRunId] = useState('');
  const [controlState, setControlState] = useState<BrowserControlState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshControlState = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const normalizedRunId = runId.trim();
    if (!normalizedRunId) {
      setLoadError('Enter a run ID to inspect its durable status.');
      setControlState(null);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      setControlState(await getBrowserRunControlState(normalizedRunId));
    } catch (error) {
      setControlState(null);
      setLoadError(error instanceof Error ? error.message : 'Unable to read browser run state.');
    } finally {
      setIsLoading(false);
    }
  };

  const shownStatus = controlState?.status;
  const stopState = controlState?.cancellation_requested
    ? (controlState.cancellation_acknowledged ? 'Stop acknowledged' : 'Stop requested')
    : 'No stop request';

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 font-sans text-slate-100">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-4 md:flex-row md:items-center">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-extrabold tracking-tight"><Monitor className="h-7 w-7 text-primary" /> Application Assistant Control Room</h1>
          <p className="mt-1 text-sm text-slate-400">Inspect durable, candidate-owned run events and safety status. Live browser streaming remains a separate capability.</p>
        </div>
        <Badge className="w-fit border border-amber-800 bg-amber-950 text-amber-200" variant="secondary"><AlertTriangle className="mr-1 h-3 w-3" /> No live session is implied</Badge>
      </div>

      <Card className="border-amber-800/70 bg-amber-950/30 text-amber-50">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" /><p className="text-sm leading-relaxed">This screen never opens a job site, fills a form, uses account credentials, or submits an application. It shows candidate-owned evidence only; starting or completing a live session still requires permitted sources and candidate-controlled review.</p></div>
          <Button variant="outline" onClick={() => setShowSafetyDetails((visible) => !visible)} aria-expanded={showSafetyDetails} className="shrink-0 border-amber-700 text-amber-100 hover:bg-amber-950">{showSafetyDetails ? 'Hide safety details' : 'View safety details'}</Button>
        </CardContent>
      </Card>

      {showSafetyDetails && <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <SafetyItem icon={<Lock className="h-4 w-4" />} title="Candidate approval" text="A revised profile or artifact must invalidate the previous approval." />
        <SafetyItem icon={<Eye className="h-4 w-4" />} title="Visible activity" text="Durable event history is read from the candidate-owned run ledger, never simulated locally." />
        <SafetyItem icon={<Pause className="h-4 w-4" />} title="Manual handoff" text="The candidate must be able to pause assistance and answer sensitive questions themselves." />
      </div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="overflow-hidden border-slate-800 bg-slate-900 text-slate-100">
            <form onSubmit={refreshControlState} className="flex flex-col gap-2 border-b border-slate-800 bg-slate-950 px-4 py-3 sm:flex-row sm:items-center">
              <div className="flex gap-1.5"><div className="h-3 w-3 rounded-full bg-red-500" /><div className="h-3 w-3 rounded-full bg-amber-500" /><div className="h-3 w-3 rounded-full bg-emerald-500" /></div>
              <label htmlFor="browser-run-id" className="sr-only">Browser run ID</label>
              <Input id="browser-run-id" value={runId} onChange={(event) => setRunId(event.target.value)} placeholder="Paste a browser run ID" className="h-8 flex-1 border-slate-700 bg-slate-900 font-mono text-xs text-slate-100" aria-describedby="browser-run-help" />
              <Button type="submit" size="sm" disabled={isLoading} className="bg-primary hover:bg-primary/90">{isLoading ? <LoaderCircle className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}{isLoading ? 'Loading' : 'Load run'}</Button>
              <Badge className={shownStatus ? statusClass[shownStatus] : 'bg-slate-800 text-slate-300'}>{shownStatus?.toUpperCase() ?? 'OFFLINE'}</Badge>
            </form>
            <div className="flex min-h-80 flex-col justify-center border-b border-slate-800 bg-slate-950 p-6">
              {!controlState && !loadError && <EmptyRunState />}
              {!controlState && loadError && <div role="alert" className="mx-auto max-w-lg rounded border border-red-900 bg-red-950/40 p-4 text-center text-sm text-red-200">{loadError}</div>}
              {controlState && <RunStateSummary state={controlState} stopState={stopState} />}
            </div>
            <p id="browser-run-help" className="bg-slate-900 px-4 py-3 text-xs leading-relaxed text-slate-400">A loaded record shows database-backed state only. It does not prove that a portal received an application or that a remote browser is available.</p>
          </Card>
        </div>

        <Card className="border-slate-800 bg-slate-900 p-4 text-slate-100">
          <CardHeader className="border-b border-slate-800 p-0 pb-3"><CardTitle className="flex items-center gap-2 text-sm font-bold"><Terminal className="h-4 w-4 text-primary" /> Required safety sequence</CardTitle></CardHeader>
          <CardContent className="space-y-3 p-0 pt-3 font-mono text-xs">
            {previewSafeguards.map((safeguard) => <div key={safeguard.step} className="space-y-1 rounded border border-slate-800 bg-slate-950 p-3"><div className="flex items-center justify-between text-slate-500"><span>Gate {safeguard.step}</span><Badge className="bg-slate-800 text-[10px] text-slate-300">REQUIRED</Badge></div><p className="font-semibold text-slate-200">{safeguard.action}</p><p className="leading-relaxed text-slate-400">{safeguard.detail}</p></div>)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

function EmptyRunState() {
  return <div className="mx-auto max-w-lg space-y-3 text-center"><div className="mx-auto w-fit rounded-full bg-slate-900 p-4 text-slate-400"><Monitor className="h-12 w-12" /></div><div><p className="text-sm font-bold text-slate-200">No durable run loaded</p><p className="mt-1 text-xs leading-relaxed text-slate-400">Paste a run ID from an approved workflow to view the event ledger, cancellation acknowledgement, and worker lease status. This is not a browser-sharing surface.</p></div></div>;
}

function RunStateSummary({ state, stopState }: { state: BrowserControlState; stopState: string }) {
  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-100">{state.current_step || 'No current step recorded'}</p><p className="mt-1 font-mono text-xs text-slate-400">Run {state.run_id}</p></div><div className="text-right"><p className="text-2xl font-bold text-primary">{state.progress}%</p><p className="text-xs text-slate-400">durable progress record</p></div></div><div className="grid gap-2 sm:grid-cols-3"><StatusItem label="Cancellation" value={stopState} tone={state.cancellation_requested ? 'amber' : 'slate'} /><StatusItem label="Worker lease" value={state.lease_active ? 'Active' : 'Inactive'} tone={state.lease_active ? 'blue' : 'slate'} /><StatusItem label="Events" value={`${state.events.length} recorded`} tone="slate" /></div><div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recent durable events</p>{state.events.length === 0 ? <p className="rounded border border-slate-800 bg-slate-900 p-3 text-xs text-slate-400">No durable events have been recorded for this run yet.</p> : <div className="max-h-40 space-y-2 overflow-y-auto pr-1">{state.events.map((event) => <div key={event.sequence_no} className="rounded border border-slate-800 bg-slate-900 p-3"><div className="flex items-center justify-between gap-3"><p className="font-mono text-xs font-semibold text-slate-200">{event.event_type}</p><span className="text-[10px] text-slate-500">{formatEventTime(event.created_at)}</span></div><p className="mt-1 break-words font-mono text-[11px] text-slate-400">{formatEventPayload(event.payload)}</p></div>)}</div>}</div></div>;
}

function StatusItem({ label, value, tone }: { label: string; value: string; tone: 'slate' | 'amber' | 'blue' }) {
  const classes = { slate: 'border-slate-800 bg-slate-900 text-slate-300', amber: 'border-amber-900 bg-amber-950/50 text-amber-200', blue: 'border-blue-900 bg-blue-950/50 text-blue-200' };
  return <div className={`rounded border p-3 ${classes[tone]}`}><p className="text-[10px] uppercase tracking-wide opacity-70">{label}</p><p className="mt-1 text-xs font-semibold">{value}</p></div>;
}

function formatEventPayload(payload: Record<string, unknown>) { const rendered = JSON.stringify(payload); return rendered && rendered !== '{}' ? rendered : 'No additional detail'; }
function formatEventTime(value: string) { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString(); }
function SafetyItem({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <Card className="border-slate-800 bg-slate-900 text-slate-100"><CardContent className="flex gap-3 p-4"><span className="text-primary">{icon}</span><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-relaxed text-slate-400">{text}</p></div></CardContent></Card>; }

export default TayariComputerControlRoom;
