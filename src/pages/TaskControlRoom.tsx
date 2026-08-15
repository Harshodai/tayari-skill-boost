import { Link, useParams } from 'react-router-dom';
import { TaskControlProvider, useTaskControl } from '@/contexts/TaskControlContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

function TaskView() {
  const { task, events, actions, approvePlan, rejectPlan, approveAction, denyAction, takeover, stop } = useTaskControl();
  if (!task) return <div className="p-8 text-slate-300">Loading task control room…</div>;
  const run = async (operation: () => Promise<void>, success: string) => {
    try { await operation(); toast.success(success); } catch (error) { toast.error(error instanceof Error ? error.message : 'Task operation failed.'); }
  };
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Job Tayari control room</p><h1 className="mt-2 text-3xl font-semibold">{task.title}</h1><p className="mt-2 max-w-3xl text-sm text-slate-400">{task.objective}</p></div>
          <div className="flex items-center gap-2"><Badge variant="outline">{task.status}</Badge><Link to="/desktop"><Button variant="outline">Desktop agent</Button></Link></div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-slate-800 bg-slate-900/70"><CardHeader><CardTitle>Task controls</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-slate-400">Plan approval is durable and owner-scoped. Browser actions remain bounded by policy; final submission is disabled.</p><div className="flex flex-wrap gap-2">{task.status === 'awaiting_plan_approval' && <><Button onClick={() => void run(approvePlan, 'Plan approved.')}>Approve plan</Button><Button variant="outline" onClick={() => void run(rejectPlan, 'Plan rejected.')}>Reject plan</Button></>}{!['stopped', 'completed'].includes(task.status) && <><Button variant="outline" onClick={() => void run(takeover, 'Takeover requested.')}>Take over</Button><Button variant="destructive" onClick={() => void run(stop, 'Task stopped.')}>Stop</Button></>}</div></CardContent></Card>
          <Card className="border-slate-800 bg-slate-900/70"><CardHeader><CardTitle>Action proposals</CardTitle></CardHeader><CardContent className="space-y-3">{actions.length === 0 && <p className="text-sm text-slate-500">No action proposals.</p>}{actions.map((action) => <div key={action.id} className="rounded-lg border border-slate-800 p-3"><div className="flex justify-between gap-2"><span className="text-sm font-medium">{action.action_type}</span><Badge variant="outline">{action.status} · {action.risk_tier}</Badge></div>{action.status === 'pending' && action.risk_tier !== 'submission' && <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => void run(() => approveAction(action.id), 'Action approved.')}>Approve</Button><Button size="sm" variant="outline" onClick={() => void run(() => denyAction(action.id), 'Action denied.')}>Deny</Button></div>}</div>)}</CardContent></Card>
        </div>
        <Card className="border-slate-800 bg-slate-900/70"><CardHeader><CardTitle>Live task events</CardTitle></CardHeader><CardContent><div className="space-y-3">{events.length === 0 && <p className="text-sm text-slate-500">No events recorded yet.</p>}{events.map((event) => <div key={`${event.sequence_no}-${event.event_type}`} className="border-l-2 border-cyan-400/50 pl-3"><p className="text-xs text-cyan-300">#{event.sequence_no} · {event.event_type}</p><pre className="mt-1 whitespace-pre-wrap text-xs text-slate-400">{JSON.stringify(event.payload)}</pre></div>)}</div></CardContent></Card>
      </div>
    </main>
  );
}

export default function TaskControlRoom() {
  const { taskId } = useParams<{ taskId: string }>();
  if (!taskId) return <div className="p-8">A task ID is required.</div>;
  return <TaskControlProvider taskId={taskId}><TaskView /></TaskControlProvider>;
}
