import { useState, useRef, useEffect, type FormEvent, type ReactNode } from 'react';
import { AlertCircle, AlertTriangle, Eye, LoaderCircle, Lock, Monitor, Pause, Play, Radio, RefreshCw, ShieldAlert, ShieldCheck, Square, Terminal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  fetchComputerReplay,
  getBrowserRunControlState,
  terminateComputerRun,
  streamComputerRun,
  type BrowserControlState,
  type ComputerLiveEvent,
} from '@/api/browser';


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
  const [targetUrl, setTargetUrl] = useState('https://boards.greenhouse.io/');
  const [controlState, setControlState] = useState<BrowserControlState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Live SSE stream states
  const [isStreaming, setIsStreaming] = useState(false);
  const [liveEvents, setLiveEvents] = useState<ComputerLiveEvent[]>([]);
  const [latestScreenshot, setLatestScreenshot] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [latestConfidence, setLatestConfidence] = useState<number | null>(null);
  const [pauseRequired, setPauseRequired] = useState<{ field_name?: string; field_label?: string; reason?: string } | null>(null);
  const [visionAnnotation, setVisionAnnotation] = useState<{ x: number; y: number; width: number; height: number; confidence: number; source: string; action_kind: string; label?: string } | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isTerminating, setIsTerminating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Clear live state when runId changes to prevent stale events leaking into new streams
  useEffect(() => {
    setLiveEvents([]);
    setLatestScreenshot(null);
    setCurrentUrl(null);
    setLatestConfidence(null);
    setPauseRequired(null);
    setVisionAnnotation(null);
    setStreamError(null);
    setIsStreaming(false);
  }, [runId]);

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

  const handleLiveEvent = (event: ComputerLiveEvent) => {
    setLiveEvents((prev) => {
      // Store compact summary only — NOT base64 data — to avoid memory bloat
      const compact = { type: event.type, step_index: event.step_index, ts: event.ts, payload: { url: (event.payload as any)?.url } };
      return [compact as any, ...prev].slice(0, 100);
    });
          if (event.type === 'screenshot') {
            const payload = event.payload;
            const shot = typeof payload === 'object' && payload !== null
              ? ((payload as Record<string, unknown>).data || (payload as Record<string, unknown>).screenshot || '')
              : String(payload || '');
            if (shot) setLatestScreenshot(String(shot));
          } else if (event.type === 'url') {
            const payload = event.payload;
            const u = typeof payload === 'object' && payload !== null
              ? ((payload as Record<string, unknown>).url || '')
              : String(payload || '');
            if (u) setCurrentUrl(String(u));
          } else if (event.type === 'confidence') {
            const payload = event.payload;
            const conf = typeof payload === 'object' && payload !== null
              ? ((payload as Record<string, unknown>).confidence ?? (payload as Record<string, unknown>).score)
              : null;
            if (typeof conf === 'number') setLatestConfidence(conf);
          } else if (event.type === 'visual_action') {
            const payload = typeof event.payload === 'object' && event.payload !== null
              ? (event.payload as Record<string, unknown>)
              : null;
            const annotation = payload !== null
              ? ((payload.annotation as Record<string, unknown>) || payload)
              : null;
            if (annotation && typeof (annotation as Record<string, unknown>).x === 'number' && typeof (annotation as Record<string, unknown>).y === 'number') {
              const a = annotation as Record<string, unknown>;
              setVisionAnnotation({
                x: Number(a.x),
                y: Number(a.y),
                width: Number(a.width ?? 0),
                height: Number(a.height ?? 0),
                confidence: Number(a.confidence ?? 0),
                source: String(a.source ?? 'vision-fallback'),
                action_kind: String(a.action_kind ?? 'click'),
                label: typeof a.label === 'string' ? a.label : undefined,
              });
            }
            const snap = payload !== null ? (payload as Record<string, unknown>).snapshot_jpeg : null;
            if (typeof snap === 'string' && snap) setLatestScreenshot(`data:image/jpeg;base64,${snap}`);
          } else if (event.type === 'pause_required') {
            const payload = typeof event.payload === 'object' && event.payload !== null
              ? (event.payload as { field_name?: string; field_label?: string; reason?: string })
              : { field_label: String(event.payload) };
            setPauseRequired(payload);
            setIsStreaming(false);
          } else if (event.type === 'complete') {
            setIsStreaming(false);
          } else if (event.type === 'error') {
            const payload = event.payload;
            const err = typeof payload === 'object' && payload !== null
              ? ((payload as Record<string, unknown>).message || (payload as Record<string, unknown>).error)
              : String(payload);
            setStreamError(String(err || 'Stream error occurred.'));
            setIsStreaming(false);
          }
  };

  const startStream = async () => {
    const normalizedRunId = runId.trim();
    if (!normalizedRunId) {
      setLoadError('Enter a run ID to connect the live stream.');
      return;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsStreaming(true);
    setStreamError(null);
    setPauseRequired(null);

    // ponytail: resume from last step so disconnects never lose visibility
    try {
      const lastStep = liveEvents.reduce((m, e) => Math.max(m, e.step_index), 0);
      const replay = await fetchComputerReplay(normalizedRunId, lastStep);
      replay.events.forEach(handleLiveEvent);
    } catch {
      // ponytail: replay is best-effort; the live stream stays the source of truth
    }
    if (controller.signal.aborted) return;

    const connectStream = () =>
      streamComputerRun(normalizedRunId, handleLiveEvent, { url: targetUrl.trim() || undefined, signal: controller.signal });
    try {
      await connectStream();
    } catch (err) {
      if (!controller.signal.aborted) {
        // ponytail: one 1s retry covers transient gateway blips; user re-clicks after that
        await new Promise((r) => setTimeout(r, 1000));
        if (!controller.signal.aborted) {
          try {
            await connectStream();
          } catch (retryErr) {
            if (!controller.signal.aborted) {
              setStreamError(retryErr instanceof Error ? retryErr.message : 'Live stream connection failed.');
            }
          }
        }
      }
    } finally {
      setIsStreaming(false);
    }
  };

  const handleStopRun = async () => {
    const normalizedRunId = runId.trim();
    if (!normalizedRunId) return;
    setIsTerminating(true);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    try {
      await terminateComputerRun(normalizedRunId);
      setIsStreaming(false);
      setStreamError('Worker terminated via hard kill switch.');
      await refreshControlState();
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : 'Failed to terminate run.');
    } finally {
      setIsTerminating(false);
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
          <p className="mt-1 text-sm text-slate-400">Live isolated browser worker proof & durable candidate-owned run controls.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="w-fit border border-emerald-800 bg-emerald-950 text-emerald-200" variant="secondary">
            <Radio className="mr-1 h-3 w-3 animate-pulse text-emerald-400" /> ATS allowlist: boards.greenhouse.io
          </Badge>
          {isStreaming && (
            <Badge className="border-blue-800 bg-blue-950 text-blue-200">
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-400 animate-ping" /> LIVE
            </Badge>
          )}
        </div>
      </div>

      {/* Human Handoff Notification Banner */}
      {pauseRequired && (
        <Alert variant="destructive" className="border-amber-600 bg-amber-950/80 text-amber-100" role="alert">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <AlertTitle className="text-base font-bold text-amber-200">
            Candidate Takeover Required (Human Handoff)
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-2 text-sm text-amber-100">
            <p>
              <strong className="font-semibold text-white">
                Sensitive field detected: {pauseRequired.field_label || pauseRequired.field_name || 'Protected Field'}
              </strong>
              {pauseRequired.reason ? ` — ${pauseRequired.reason}` : ''}
            </p>
            <p className="leading-relaxed text-amber-200/90">
              Automation has frozen execution to protect your sensitive data (such as passwords, SSN, compensation, sponsorship, EEO, or demographic details). Please take over and complete this field directly in the browser session. Tayari will never autonomously fill or submit sensitive information.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {streamError && (
        <Alert variant="destructive" role="alert" className="border-red-800 bg-red-950/50 text-red-200">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Stream Notice</AlertTitle>
          <AlertDescription>{streamError}</AlertDescription>
        </Alert>
      )}

      <Card className="border-amber-800/70 bg-amber-950/30 text-amber-50">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" /><p className="text-sm leading-relaxed">This screen connects to an isolated browser worker enforcing the boards.greenhouse.io allowlist. Sensitive questions trigger candidate takeover; stopping the run triggers a 5-second hard kill switch terminating the browser instance.</p></div>
          <Button variant="outline" onClick={() => setShowSafetyDetails((visible) => !visible)} aria-expanded={showSafetyDetails} className="shrink-0 border-amber-700 text-amber-100 hover:bg-amber-950">{showSafetyDetails ? 'Hide safety details' : 'View safety details'}</Button>
        </CardContent>
      </Card>

      {showSafetyDetails && <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <SafetyItem icon={<Lock className="h-4 w-4" />} title="ATS Origin Allowlist" text="Execution is strictly restricted to boards.greenhouse.io. All other domains are rejected with 403 Forbidden." />
        <SafetyItem icon={<Pause className="h-4 w-4" />} title="HITL Sensitive Guard" text="Sensitive fields (passwords, SSN, salary, sponsorship, EEO) freeze the loop and require candidate takeover." />
        <SafetyItem icon={<ShieldAlert className="h-4 w-4" />} title="5s Hard Kill Switch" text="The Stop button immediately terminates the ephemeral browser context within a 5-second deadline." />
      </div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="overflow-hidden border-slate-800 bg-slate-900 text-slate-100">
            <div className="flex flex-col gap-2 border-b border-slate-800 bg-slate-950 p-4 space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex gap-1.5"><div className="h-3 w-3 rounded-full bg-red-500" /><div className="h-3 w-3 rounded-full bg-amber-500" /><div className="h-3 w-3 rounded-full bg-emerald-500" /></div>
                <Input
                  id="browser-run-id"
                  value={runId}
                  onChange={(event) => {
                    setRunId(event.target.value);
                    // Clear run-scoped state so stale data from a previous run never bleeds in
                    setLatestScreenshot(null);
                    setCurrentUrl(null);
                    setVisionAnnotation(null);
                    setLiveEvents([]);
                  }}
                  placeholder="Run ID (e.g. greenhouse-proof-run-1)"
                  className="h-8 flex-1 border-slate-700 bg-slate-900 font-mono text-xs text-slate-100"
                />
                <Button type="button" size="sm" onClick={() => void refreshControlState()} disabled={isLoading} className="bg-slate-800 hover:bg-slate-700 text-slate-200">
                  {isLoading ? <LoaderCircle className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
                  {isLoading ? 'Loading' : 'Load state'}
                </Button>
                <Badge className={shownStatus ? statusClass[shownStatus] : 'bg-slate-800 text-slate-300'}>{shownStatus?.toUpperCase() ?? 'IDLE'}</Badge>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center pt-2 border-t border-slate-800">
                <Input
                  id="browser-target-url"
                  value={targetUrl}
                  onChange={(event) => setTargetUrl(event.target.value)}
                  placeholder="ATS URL (boards.greenhouse.io only)"
                  className="h-8 flex-1 border-slate-700 bg-slate-900 font-mono text-xs text-slate-100"
                />
                <Button type="button" size="sm" onClick={startStream} disabled={isStreaming || !runId.trim()} className="bg-primary hover:bg-primary/90">
                  {isStreaming ? <LoaderCircle className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}
                  {isStreaming ? 'Streaming' : 'Start / Connect Stream'}
                </Button>
                <Button type="button" size="sm" variant="destructive" onClick={handleStopRun} disabled={isTerminating || !runId.trim()}>
                  {isTerminating ? <LoaderCircle className="mr-1 h-4 w-4 animate-spin" /> : <Square className="mr-1 h-4 w-4" />}
                  {isTerminating ? 'Stopping' : 'Stop / Cancel'}
                </Button>
              </div>
            </div>

            {/* Live Browser Display (Screenshot or Empty View) */}
            <div className="flex min-h-80 flex-col justify-center border-b border-slate-800 bg-slate-950 p-6">
              {currentUrl && (
                <div className="mb-3 flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300">
                  <span className="font-mono truncate">URL: {currentUrl}</span>
                  {latestConfidence !== null && (
                    <Badge variant="outline" className="text-[10px]">Confidence: {Math.round(latestConfidence * 100)}%</Badge>
                  )}
                </div>
              )}

              {latestScreenshot ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-400">Live Browser View</p>
                  <div className="relative w-full overflow-hidden rounded border border-slate-800 bg-black">
                    <img
                      src={latestScreenshot.startsWith('data:') ? latestScreenshot : `data:image/png;base64,${latestScreenshot}`}
                      alt="Live Browser Snapshot"
                      className="w-full object-contain max-h-96"
                    />
                    {visionAnnotation && (
                      <div
                        className="pointer-events-none absolute rounded border-2 border-amber-400"
                        style={{
                          left: `${Math.max(0, Math.min(1, visionAnnotation.x)) * 100}%`,
                          top: `${Math.max(0, Math.min(1, visionAnnotation.y)) * 100}%`,
                          width: visionAnnotation.width > 0 ? `${visionAnnotation.width * 100}%` : '24px',
                          height: visionAnnotation.height > 0 ? `${visionAnnotation.height * 100}%` : '24px',
                          transform: 'translate(-50%, -50%)',
                        }}
                        title={`vision fallback, confidence ${Math.round(visionAnnotation.confidence * 100)}%`}
                      >
                        <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-amber-500 px-1 text-[10px] font-bold text-black">
                          vision fallback, confidence {Math.round(visionAnnotation.confidence * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                  {visionAnnotation && (
                    <p className="text-[11px] text-amber-200/90">
                      vision fallback · {visionAnnotation.action_kind} · confidence {Math.round(visionAnnotation.confidence * 100)}%{visionAnnotation.label ? ` · ${visionAnnotation.label}` : ''}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {!controlState && !loadError && <EmptyRunState />}
                  {!controlState && loadError && <div role="alert" className="mx-auto max-w-lg rounded border border-red-900 bg-red-950/40 p-4 text-center text-sm text-red-200">{loadError}</div>}
                  {controlState && <RunStateSummary state={controlState} stopState={stopState} />}
                </>
              )}
            </div>

            {/* Live Events Stream List */}
            {liveEvents.length > 0 && (
              <div className="p-4 bg-slate-950 border-b border-slate-800 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-2">
                  <Radio className="h-3 w-3 text-emerald-400 animate-pulse" /> Live Event Stream ({liveEvents.length} events)
                </p>
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {liveEvents.map((ev, idx) => (
                    <div key={`${ev.step_index}-${idx}`} className="rounded border border-slate-800 bg-slate-900 p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] uppercase font-mono">{ev.type}</Badge>
                          <span className="font-mono text-slate-300">Step {ev.step_index}</span>
                        </div>
                        <span className="text-[10px] text-slate-500">{new Date(ev.ts).toLocaleTimeString()}</span>
                      </div>
                      <pre className="mt-1 text-[11px] font-mono text-slate-400 whitespace-pre-wrap break-words">
                        {typeof ev.payload === 'object' ? JSON.stringify(ev.payload, null, 2) : String(ev.payload)}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p id="browser-run-help" className="bg-slate-900 px-4 py-3 text-xs leading-relaxed text-slate-400">
              The live isolated worker is bound to boards.greenhouse.io. Any sensitive field pauses execution for candidate takeover; the kill switch terminates the session within 5s.
            </p>
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
