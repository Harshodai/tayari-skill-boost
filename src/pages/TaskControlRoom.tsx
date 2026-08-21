import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, CirclePause, Hand, Play, ShieldAlert, Square, Terminal } from 'lucide-react';
import { TaskControlProvider, useTaskControl } from '@/contexts/TaskControlContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';

const statusCopy: Record<string, string> = {
  draft: 'Task is being prepared.',
  planning: 'Tay is building a plan for review.',
  awaiting_plan_approval: 'Your approval is required before work starts.',
  queued: 'Task is queued for execution.',
  running: 'Task is running within the approved boundary.',
  paused: 'Task is paused; no new actions should start.',
  awaiting_action_approval: 'An action is waiting for your approval.',
  awaiting_takeover: 'Tay needs you to take over the next step.',
  completed: 'Task completed with recorded events.',
  stopped: 'Task stopped by the owner.',
  failed: 'Task failed; inspect the recorded events before retrying.',
};

function TaskView() {
  const { task, plan, artifacts, events, actions, refreshError, approvePlan, rejectPlan, approveAction, denyAction, pause, resume, takeover, stop } = useTaskControl();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!task) return <div className="p-8 text-slate-300">Loading task control room…</div>;

  const run = async (operation: () => Promise<void>, success: string) => {
    setBusy(true);
    setError(null);
    try {
      await operation();
      toast.success(success);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Task operation failed.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const terminal = ['stopped', 'completed', 'failed'].includes(task.status);
  const pendingActions = actions.filter((action) => action.status === 'pending');
  const latestArtifact = artifacts[0] ?? null;
  const resultMarkdown = latestArtifact?.content_type === 'text/markdown' ? latestArtifact.body : null;
  const planSteps = Array.isArray(plan?.steps) ? plan.steps : [];

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Job Tayari control room</p>
            <h1 className="mt-2 text-3xl font-semibold">{task.title}</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">{task.objective}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{task.status}</Badge>
            <Link to="/desktop"><Button variant="outline">New task</Button></Link>
          </div>
        </div>

        {refreshError && (
          <Alert variant="destructive" role="alert">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Task data may be stale</AlertTitle>
            <AlertDescription>{refreshError}. Do not approve or treat an empty result as final until the control room refreshes successfully.</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" role="alert">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Task control failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {plan && (
          <Card className="border-indigo-300/20 bg-indigo-300/5">
            <CardHeader><CardTitle>Proposed plan · version {plan.version}</CardTitle><CardDescription className="text-slate-400">Review these exact steps before approving. The task will only execute the safe draft path after approval.</CardDescription></CardHeader>
            <CardContent><ol className="space-y-2">{planSteps.map((step, index) => { const record = typeof step === 'object' && step !== null ? step as Record<string, unknown> : {}; const title = typeof record.title === 'string' ? record.title : `Plan step ${index + 1}`; const requiresApproval = record.requires_approval === true; return <li key={`${plan.version}-${index}`} className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-300/15 text-xs font-semibold text-indigo-100">{index + 1}</span><div><p className="text-sm font-medium text-slate-100">{title}</p>{requiresApproval && <p className="mt-1 text-xs text-amber-200">Requires review before this step.</p>}</div></li>; })}</ol></CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-slate-800 bg-slate-900/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Terminal className="h-4 w-4 text-cyan-300" /> Execution status</CardTitle>
              <CardDescription className="text-slate-400">{statusCopy[task.status] || 'Task state is recorded by the control plane.'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-800 p-3"><p className="text-xs text-slate-500">Status</p><p className="mt-1 text-sm font-medium">{task.status}</p></div>
                <div className="rounded-lg border border-slate-800 p-3"><p className="text-xs text-slate-500">Task version</p><p className="mt-1 text-sm font-medium">{task.version}</p></div>
                <div className="rounded-lg border border-slate-800 p-3"><p className="text-xs text-slate-500">Updated</p><p className="mt-1 text-sm font-medium">{new Date(task.updated_at).toLocaleString()}</p></div>
              </div>
              <p className="text-sm text-slate-400">Plan approval is durable and owner-scoped. Browser actions remain bounded by policy; final submission, credentials, OTPs, CAPTCHAs, and legal declarations stay outside autonomous execution.</p>
              <div className="flex flex-wrap gap-2">
                {task.status === 'awaiting_plan_approval' && <><Button disabled={busy} onClick={() => void run(approvePlan, 'Plan approved.')}>Approve plan</Button><Button disabled={busy} variant="outline" onClick={() => void run(rejectPlan, 'Plan rejected.')}>Reject plan</Button></>}
                {task.status === 'paused' && <Button disabled={busy} onClick={() => void run(resume, 'Task resumed.') }><Play className="mr-2 h-4 w-4" />Resume</Button>}
                {!terminal && task.status !== 'paused' && <Button disabled={busy} variant="outline" onClick={() => void run(pause, 'Task paused.') }><CirclePause className="mr-2 h-4 w-4" />Pause</Button>}
                {!terminal && <><Button disabled={busy} variant="outline" onClick={() => void run(takeover, 'Takeover requested.') }><Hand className="mr-2 h-4 w-4" />Take over</Button><Button disabled={busy} variant="destructive" onClick={() => void run(stop, 'Task stopped.') }><Square className="mr-2 h-4 w-4" />Stop</Button></>}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/70">
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-amber-300" /> Approval queue</CardTitle><CardDescription className="text-slate-400">{pendingActions.length} action{pendingActions.length === 1 ? '' : 's'} awaiting review.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {actions.length === 0 && <p className="text-sm text-slate-500">No action proposals.</p>}
              {actions.map((action) => <div key={action.id} className="rounded-lg border border-slate-800 p-3"><div className="flex justify-between gap-2"><span className="text-sm font-medium">{action.action_type}</span><Badge variant="outline">{action.status} · {action.risk_tier}</Badge></div>{action.site_origin && <p className="mt-1 break-all text-xs text-slate-500">{action.site_origin}</p>}{action.status === 'pending' && action.risk_tier !== 'submission' && <div className="mt-3 flex gap-2"><Button disabled={busy} size="sm" onClick={() => void run(() => approveAction(action.id), 'Action approved.')}>Approve</Button><Button disabled={busy} size="sm" variant="outline" onClick={() => void run(() => denyAction(action.id), 'Action denied.')}>Deny</Button></div>}{action.status === 'pending' && action.risk_tier === 'submission' && <p className="mt-2 text-xs text-amber-200">Submission remains blocked. Open the site yourself and complete the final step manually.</p>}</div>)}
            </CardContent>
          </Card>
        </div>

        {resultMarkdown && (
          <Card className="border-emerald-300/20 bg-emerald-300/5">
            <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-300" /> {latestArtifact?.title || 'Reviewable draft result'}</CardTitle><CardDescription className="text-slate-400">This durable artifact was produced from the approved objective and plan. It is not evidence of an external action.</CardDescription></CardHeader>
            <CardContent><div className="whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950 p-4 text-sm leading-6 text-slate-200">{resultMarkdown}</div></CardContent>
          </Card>
        )}

        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-300" /> Live task events</CardTitle><CardDescription className="text-slate-400">This timeline is the durable record of planning, execution, approvals, and handoffs.</CardDescription></CardHeader>
          <CardContent><div className="space-y-3">{events.length === 0 && <p className="text-sm text-slate-500">No events recorded yet.</p>}{events.map((event) => <div key={`${event.sequence_no}-${event.event_type}`} className="border-l-2 border-cyan-400/50 pl-3"><p className="text-xs text-cyan-300">#{event.sequence_no} · {event.event_type} · {new Date(event.created_at).toLocaleString()}</p><pre className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-400">{JSON.stringify(event.payload, null, 2)}</pre></div>)}</div></CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function TaskControlRoom() {
  const { taskId } = useParams<{ taskId: string }>();
  if (!taskId) return <div className="p-8">A task ID is required.</div>;
  return <TaskControlProvider taskId={taskId}><TaskView /></TaskControlProvider>;
}
