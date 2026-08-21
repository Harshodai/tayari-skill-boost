import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Bot, CheckCircle2, ChevronRight, FileText, FolderOpen, Globe2, Loader2, Play, RefreshCw, ShieldCheck, Square, TerminalSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch, BackendUnavailableError, createTask, createTaskPlan } from "@/api";
import tayAgentAvatar from "@/assets/tay-agent.png";

type DesktopStatus = Awaited<ReturnType<NonNullable<typeof window.tayariDesktop>["status"]>>;
type LocalFile = { name: string; path: string };

const ACTIONS = [
  { icon: FileText, title: "Tailor materials", description: "Use selected files and a role brief to prepare a reviewed draft." },
  { icon: Globe2, title: "Review browser work", description: "Open the control room to watch browser-assisted steps and stop a run." },
  { icon: ShieldCheck, title: "Keep receipts", description: "Use visible activity and review states instead of hidden application actions." },
];

export default function DesktopAgent() {
  const desktop = window.tayariDesktop;
  const navigate = useNavigate();
  const [status, setStatus] = useState<DesktopStatus | null>(null);
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [task, setTask] = useState("");
  const [running, setRunning] = useState(false);
  const [serviceAction, setServiceAction] = useState<"start" | "stop" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);

  const serviceLabel = useMemo(() => {
    if (!desktop) return "Web workspace";
    if (!status) return "Checking local services";
    if (status.apiReachable) return "Local agent ready";
    if (!status.dockerAvailable) return "Docker Desktop required";
    return "Local services stopped";
  }, [desktop, status]);

  const refreshStatus = async () => {
    if (!desktop) return;
    setStatus(await desktop.status());
  };

  useEffect(() => { void refreshStatus(); }, []);

  const chooseFiles = async () => {
    if (!desktop) {
      setError("File selection is available in the desktop app. Open Job Tayari Desktop to attach local files.");
      return;
    }
    setFiles(await desktop.pickFiles());
  };

  const runTask = async () => {
    const goal = task.trim();
    if (!goal) {
      setError("Describe the work you want Tay to prepare.");
      return;
    }
    setError(null);
    setResult(null);
    setRunning(true);
    try {
      const created = await createTask({
        title: goal.slice(0, 80),
        objective: goal,
      });
      await createTaskPlan(created.id, [
        { id: "review_goal", title: "Review the requested objective", requires_approval: false },
        { id: "prepare_materials", title: "Prepare a draft using approved files", requires_approval: true },
        { id: "human_review", title: "Pause for your approval before browser actions", requires_approval: true },
      ]);
      setResult(created);
      navigate(`/tay/tasks/${created.id}`);
    } catch (caught) {
      setError(caught instanceof BackendUnavailableError
        ? "The local agent service is not reachable. Start local services, then retry."
        : caught instanceof Error ? caught.message : "The agent task could not be started.");
    } finally {
      setRunning(false);
    }
  };

  const controlServices = async (action: "start" | "stop") => {
    if (!desktop) return;
    setServiceAction(action);
    setError(null);
    try {
      if (action === "start") await desktop.startServices();
      else await desktop.stopServices();
      await refreshStatus();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Local service management was unsuccessful.");
    } finally {
      setServiceAction(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#080d1c] text-slate-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-[18%] top-[-18rem] h-[42rem] w-[42rem] rounded-full bg-indigo-500/16 blur-[130px]" />
        <div className="absolute bottom-[-24rem] right-[-10rem] h-[38rem] w-[38rem] rounded-full bg-cyan-400/10 blur-[130px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-[1600px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 backdrop-blur-xl sm:px-5">
          <Link to="/" className="flex items-center gap-3 font-display text-lg font-semibold tracking-tight text-white">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-indigo-300/20 bg-indigo-300/10"><img src={tayAgentAvatar} alt="" className="h-full w-full object-cover object-top" /></span>
            Job Tayari <span className="hidden text-slate-500 sm:inline">Workspace</span>
          </Link>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className={`h-2 w-2 rounded-full ${status?.apiReachable ? "bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,.9)]" : "bg-amber-300"}`} />
            {serviceLabel}
            <button onClick={() => void refreshStatus()} className="ml-1 rounded-md p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white" aria-label="Refresh local service status"><RefreshCw className="h-3.5 w-3.5" /></button>
          </div>
        </header>

        <div className="grid flex-1 gap-5 py-5 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
          <aside className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 backdrop-blur-xl">
            <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Workspace</p>
            <nav className="space-y-1">
              <NavItem to="/tay" icon={Bot} active label="Tay Workspace" />
              <NavItem to="/tay" icon={Globe2} label="Task review" />
              <NavItem to="/answer-bank" icon={ShieldCheck} label="Answer bank" />
              <NavItem to="/resume" icon={FileText} label="Resume studio" />
              <NavItem to="/jobs" icon={TerminalSquare} label="Opportunity desk" />
            </nav>
            <div className="mt-6 rounded-xl border border-indigo-300/15 bg-gradient-to-br from-indigo-300/10 to-cyan-300/5 p-3.5">
              <p className="text-sm font-semibold text-slate-100">Review stays with you.</p>
              <p className="mt-1.5 text-xs leading-5 text-slate-400">Tay prepares work, surfaces activity and routes you to review—not hidden submission.</p>
            </div>
          </aside>

          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 backdrop-blur-xl sm:p-7">
            <div className="flex flex-col gap-6 border-b border-slate-800 pb-7 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-2xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100"><Bot className="h-3.5 w-3.5" /> Tay Agent</div>
                <h1 className="font-display text-3xl font-bold tracking-[-0.04em] text-white sm:text-4xl">A review-first agent workspace with visible boundaries.</h1>
                <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">Bring Job Tayari’s career operations into a focused workspace: files stay selected by you, browser work stays reviewable, and every run has a clear stop point.</p>
              </div>
              <div className="relative mx-auto h-28 w-28 shrink-0 overflow-hidden rounded-[1.5rem] border border-indigo-300/20 bg-gradient-to-b from-indigo-300/10 to-slate-950 shadow-[0_18px_46px_rgba(79,70,229,.23)] sm:mx-0">
                <img src={tayAgentAvatar} alt="Tay, the Job Tayari agent" className="h-full w-full object-cover object-top" />
              </div>
            </div>

            <div className="mt-7 grid gap-3 md:grid-cols-3">
              {ACTIONS.map(({ icon: Icon, title, description }) => <div key={title} className="rounded-xl border border-slate-800 bg-slate-900/55 p-4"><Icon className="h-4 w-4 text-cyan-200" /><p className="mt-3 text-sm font-semibold text-slate-100">{title}</p><p className="mt-1.5 text-xs leading-5 text-slate-400">{description}</p></div>)}
            </div>

            <div className="mt-7 rounded-2xl border border-slate-700/80 bg-[#0b1020] p-4 shadow-inner sm:p-5">
              <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-white">What should Tay prepare?</p><p className="mt-1 text-xs text-slate-500">Agent work runs through the existing authenticated Job Tayari API.</p></div><span className="hidden rounded-full border border-emerald-300/15 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-200 sm:inline">Review-first</span></div>
              <textarea value={task} onChange={(event) => setTask(event.target.value)} placeholder="For example: Prepare a tailored application brief for this role and identify the parts I should review." className="mt-4 min-h-32 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-3.5 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-indigo-300/60 focus:ring-2 focus:ring-indigo-300/15" />
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap gap-2">{files.map((file) => <button key={file.path} onClick={() => void desktop?.revealFile(file.path)} className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white">{file.name}</button>)}<Button type="button" variant="ghost" size="sm" onClick={() => void chooseFiles()} className="text-slate-300 hover:bg-slate-800 hover:text-white"><FolderOpen className="mr-2 h-3.5 w-3.5" />Attach files</Button></div><Button type="button" onClick={() => void runTask()} disabled={running} className="bg-indigo-300 text-slate-950 hover:bg-indigo-200">{running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}{running ? "Preparing…" : "Ask Tay"}</Button></div>
            </div>

            {error && <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm leading-6 text-rose-100"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
            {result && <div className="mt-4 rounded-xl border border-emerald-300/15 bg-emerald-300/5 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-emerald-100"><CheckCircle2 className="h-4 w-4" />Agent run returned a result</div><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs leading-5 text-slate-300">{JSON.stringify(result, null, 2)}</pre></div>}
          </section>

          <aside className="space-y-5">
            <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 backdrop-blur-xl"><p className="text-sm font-semibold text-white">Service status</p><p className="mt-1.5 text-xs leading-5 text-slate-400">The web workspace uses the authenticated JobTayari API. The optional desktop app can launch the local service stack, but setup and permissions remain visible.</p><div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs"><p className="text-slate-500">API endpoint</p><p className="mt-1 break-all font-mono text-slate-200">{status?.apiBaseUrl ?? "Checking…"}</p></div><div className="mt-3 grid grid-cols-2 gap-2"><Button type="button" variant="outline" disabled={!desktop || serviceAction !== null || status?.apiReachable} onClick={() => void controlServices("start")} className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800">{serviceAction === "start" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start"}</Button><Button type="button" variant="outline" disabled={!desktop || serviceAction !== null || !status?.apiReachable} onClick={() => void controlServices("stop")} className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800">{serviceAction === "stop" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Square className="mr-1.5 h-3.5 w-3.5" />Stop</>}</Button></div></section>
            <section className="rounded-2xl border border-amber-300/15 bg-amber-300/5 p-4"><p className="text-sm font-semibold text-amber-100">Before a browser action</p><ol className="mt-3 space-y-2 text-xs leading-5 text-slate-400"><li className="flex gap-2"><span className="font-semibold text-amber-200">01</span>Confirm the target site and role.</li><li className="flex gap-2"><span className="font-semibold text-amber-200">02</span>Watch the browser-review stream.</li><li className="flex gap-2"><span className="font-semibold text-amber-200">03</span>Use the stop control if the work no longer matches your intent.</li></ol><Link to="/tay" className="mt-4 inline-flex items-center text-xs font-semibold text-amber-100 hover:text-white">Open task review <ChevronRight className="ml-1 h-3.5 w-3.5" /></Link></section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function NavItem({ to, icon: Icon, label, active = false }: { to: string; icon: typeof Bot; label: string; active?: boolean }) {
  return <Link to={to} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? "bg-indigo-300/12 text-indigo-100 shadow-[inset_0_0_0_1px_rgba(165,180,252,.14)]" : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"}`}><Icon className="h-4 w-4" />{label}</Link>;
}
