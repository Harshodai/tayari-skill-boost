import { useState, type ReactNode } from 'react';
import { AlertTriangle, Eye, Lock, Monitor, Pause, ShieldCheck, Terminal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface PreviewSafeguard {
  step: number;
  action: string;
  detail: string;
}

const previewSafeguards: PreviewSafeguard[] = [
  { step: 1, action: 'Verify an approved job and candidate profile', detail: 'A real run must use the job version and profile the candidate reviewed.' },
  { step: 2, action: 'Verify approved application artifacts', detail: 'A changed resume, cover letter, or answer requires a new review.' },
  { step: 3, action: 'Open a permitted source in an isolated session', detail: 'The product must block unapproved portals and avoid shared browser sessions.' },
  { step: 4, action: 'Hand off sensitive questions', detail: 'Work authorization, disability, demographic, compensation, and legal attestations stay with the candidate.' },
  { step: 5, action: 'Require a candidate-controlled final action', detail: 'A local status update is not proof of an external submission.' },
];

export const TayariComputerControlRoom = () => {
  const [showSafetyDetails, setShowSafetyDetails] = useState(false);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 font-sans text-slate-100">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-4 md:flex-row md:items-center">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-extrabold tracking-tight"><Monitor className="h-7 w-7 text-indigo-400" /> Application Assistant Control Room</h1>
          <p className="mt-1 text-sm text-slate-400">A transparent preview of the review and safety controls required before a live browser-assisted application run.</p>
        </div>
        <Badge className="w-fit border border-amber-800 bg-amber-950 text-amber-200" variant="secondary"><AlertTriangle className="mr-1 h-3 w-3" /> Preview only — no browser session is connected</Badge>
      </div>

      <Card className="border-amber-800/70 bg-amber-950/30 text-amber-50">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" /><p className="text-sm leading-relaxed">This screen does not visit a job site, fill a form, use account credentials, or submit an application. A live session may start only after an approved run, a permitted source, and a candidate-controlled review are in place.</p></div>
          <Button variant="outline" onClick={() => setShowSafetyDetails((visible) => !visible)} aria-expanded={showSafetyDetails} className="shrink-0 border-amber-700 text-amber-100 hover:bg-amber-950">{showSafetyDetails ? 'Hide safety details' : 'View safety details'}</Button>
        </CardContent>
      </Card>

      {showSafetyDetails && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <SafetyItem icon={<Lock className="h-4 w-4" />} title="Candidate approval" text="A revised profile or artifact must invalidate the previous approval." />
          <SafetyItem icon={<Eye className="h-4 w-4" />} title="Visible activity" text="A future live run must stream verifiable browser-worker events, not simulated progress." />
          <SafetyItem icon={<Pause className="h-4 w-4" />} title="Manual handoff" text="The candidate must be able to pause assistance and answer sensitive questions themselves." />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="overflow-hidden border-slate-800 bg-slate-900 text-slate-100">
            <div className="flex items-center gap-3 border-b border-slate-800 bg-slate-950 px-4 py-2">
              <div className="flex gap-1.5"><div className="h-3 w-3 rounded-full bg-red-500" /><div className="h-3 w-3 rounded-full bg-amber-500" /><div className="h-3 w-3 rounded-full bg-emerald-500" /></div>
              <label htmlFor="live-url-input" className="sr-only">Live browser URL</label>
              <Input id="live-url-input" value="No active browser session" readOnly className="h-7 flex-1 cursor-not-allowed border-slate-800 bg-slate-900 font-mono text-xs text-slate-400" aria-label="No active browser session" />
              <Badge className="bg-slate-800 text-slate-300">OFFLINE</Badge>
            </div>
            <div className="flex aspect-video flex-col items-center justify-center space-y-4 border-b border-slate-800 bg-slate-950 p-8 text-center">
              <div className="rounded-full bg-slate-900 p-4 text-slate-400"><Monitor className="h-12 w-12" /></div>
              <div><p className="text-sm font-bold text-slate-200">No live browser has been started</p><p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-400">This preview never opens a web page, fills a field, or sends a submission. The workspace will show a real session only when the browser worker is connected and the candidate has approved the current application artifacts.</p></div>
              <Button disabled title="A live isolated browser worker is not connected to this preview." className="cursor-not-allowed bg-slate-800 text-slate-400">Live session unavailable</Button>
            </div>
          </Card>
        </div>

        <Card className="border-slate-800 bg-slate-900 p-4 text-slate-100">
          <CardHeader className="border-b border-slate-800 p-0 pb-3"><CardTitle className="flex items-center gap-2 text-sm font-bold"><Terminal className="h-4 w-4 text-indigo-400" /> Required safety sequence</CardTitle></CardHeader>
          <CardContent className="space-y-3 p-0 pt-3 font-mono text-xs">
            {previewSafeguards.map((safeguard) => <div key={safeguard.step} className="space-y-1 rounded border border-slate-800 bg-slate-950 p-3"><div className="flex items-center justify-between text-slate-500"><span>Gate {safeguard.step}</span><Badge className="bg-slate-800 text-[10px] text-slate-300">REQUIRED</Badge></div><p className="font-semibold text-slate-200">{safeguard.action}</p><p className="leading-relaxed text-slate-400">{safeguard.detail}</p></div>)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

function SafetyItem({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <Card className="border-slate-800 bg-slate-900 text-slate-100"><CardContent className="flex gap-3 p-4"><span className="text-indigo-300">{icon}</span><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-relaxed text-slate-400">{text}</p></div></CardContent></Card>;
}

export default TayariComputerControlRoom;
