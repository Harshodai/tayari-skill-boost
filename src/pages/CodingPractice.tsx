import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Code2, Clock3, Play, RotateCcw, Sparkles, Trophy, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Language = "typescript" | "javascript" | "python";
type Result = "passed" | "needs_iteration" | null;

const starter = {
  typescript: `function firstUnique(items: string[]): string | null {\n  // Return the first item that appears exactly once.\n  // Example: ["a", "b", "a", "c"] -> "b"\n  return null;\n}`,
  javascript: `function firstUnique(items) {\n  // Return the first item that appears exactly once.\n  // Example: ["a", "b", "a", "c"] -> "b"\n  return null;\n}`,
  python: `def first_unique(items):\n    # Return the first item that appears exactly once.\n    # Example: ["a", "b", "a", "c"] -> "b"\n    return None`,
};

const storageKey = "tayari-coding-practice-v1";

export default function CodingPractice() {
  const [language, setLanguage] = useState<Language>("typescript");
  const [code, setCode] = useState(starter.typescript);
  const [seconds, setSeconds] = useState(30 * 60);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [completed, setCompleted] = useState(0);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { completed?: number };
      setCompleted(parsed.completed ?? 0);
    } catch {
      // Ignore invalid local practice state.
    }
  }, []);

  useEffect(() => {
    if (!running || seconds <= 0) return;
    const id = window.setInterval(() => setSeconds((current) => current - 1), 1000);
    return () => window.clearInterval(id);
  }, [running, seconds]);

  const time = useMemo(() => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`, [seconds]);

  const changeLanguage = (next: Language) => {
    setLanguage(next);
    setCode(starter[next]);
    setResult(null);
  };

  const reset = () => {
    setCode(starter[language]);
    setSeconds(30 * 60);
    setRunning(false);
    setResult(null);
  };

  const submit = () => {
    const hasImplementation = code.length > starter[language].length + 18;
    const hasReturn = /return\s+(?!null|None)/.test(code);
    const passed = hasImplementation && hasReturn;
    setResult(passed ? "passed" : "needs_iteration");
    if (passed) {
      const nextCompleted = completed + 1;
      setCompleted(nextCompleted);
      window.localStorage.setItem(storageKey, JSON.stringify({ completed: nextCompleted }));
      setRunning(false);
      toast.success("Practice submission passed the starter rubric.");
    } else {
      toast.info("Add the counting and first-unique selection logic, then submit again.");
    }
  };

  return (
    <AppShell>
      <div className="container mx-auto max-w-7xl space-y-8 px-4 py-8 md:py-12">
        <div className="flex flex-col gap-4 border-b border-border/60 pb-6 md:flex-row md:items-end md:justify-between">
          <div><Button asChild variant="ghost" size="sm" className="-ml-3"><Link to="/interview"><ArrowLeft className="mr-2 h-4 w-4" />Back to interview panel</Link></Button><div className="mt-3 flex items-center gap-2"><Badge variant="outline" className="border-orange-500/30 bg-orange-500/10 text-orange-500"><Code2 className="mr-1.5 h-3.5 w-3.5" /> Clash of Code</Badge><Badge variant="secondary">Practice mode</Badge></div><h1 className="mt-3 text-3xl font-bold tracking-tight">Build the answer before the interview.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">A focused coding round with a timer, starter prompt, explicit submission, and a review loop you can repeat before a live session.</p></div>
          <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/70 px-4 py-3"><Trophy className="h-5 w-5 text-orange-500" /><div><p className="text-xs text-muted-foreground">Practice rounds completed</p><p className="text-xl font-semibold">{completed}</p></div></div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
          <div className="space-y-4">
            <Card><CardHeader><CardTitle className="text-base">Round brief</CardTitle><CardDescription>First unique item</CardDescription></CardHeader><CardContent className="space-y-4 text-sm leading-6 text-muted-foreground"><p>Return the first item that appears exactly once while keeping the solution readable and ready to explain aloud.</p><div className="rounded-xl border border-border/60 bg-muted/30 p-4"><p className="font-mono text-xs text-foreground">[&quot;a&quot;, &quot;b&quot;, &quot;a&quot;, &quot;c&quot;] <span className="text-primary">-&gt;</span> &quot;b&quot;</p><p className="mt-2 font-mono text-xs text-foreground">[&quot;x&quot;, &quot;x&quot;] <span className="text-primary">-&gt;</span> null</p></div><div className="flex items-start gap-2 rounded-lg bg-primary/5 p-3 text-xs"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>After submitting, explain your time complexity and one edge case in the interview review.</span></div></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Session controls</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap gap-2">{(Object.keys(starter) as Language[]).map((item) => <Button key={item} variant={language === item ? "default" : "outline"} size="sm" onClick={() => changeLanguage(item)}>{item}</Button>)}</div><div className="flex items-center justify-between rounded-xl border border-border/70 bg-card/70 p-4"><div className="flex items-center gap-3"><Clock3 className="h-5 w-5 text-primary" /><div><p className="text-xs text-muted-foreground">Time remaining</p><p className="font-mono text-xl font-semibold">{time}</p></div></div><Button variant={running ? "secondary" : "default"} size="sm" onClick={() => setRunning((value) => !value)} disabled={seconds === 0}>{running ? "Pause" : "Start timer"}</Button></div><div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={reset}><RotateCcw className="mr-2 h-4 w-4" />Reset round</Button><Button className="flex-1" onClick={submit}><Play className="mr-2 h-4 w-4" />Submit</Button></div></CardContent></Card>
          </div>

          <Card className="overflow-hidden border-border/70"><CardHeader className="border-b border-border/60 bg-muted/20"><div className="flex items-center justify-between gap-3"><div><CardTitle className="text-base">Candidate editor</CardTitle><CardDescription>{language} starter file</CardDescription></div><Label className="sr-only" htmlFor="coding-editor">Code editor</Label><Badge variant="outline">No code is executed remotely</Badge></div></CardHeader><CardContent className="space-y-4 p-4"><Textarea id="coding-editor" value={code} onChange={(event) => setCode(event.target.value)} className="min-h-[430px] resize-y bg-slate-950 font-mono text-sm leading-6 text-slate-100" spellCheck={false} />{result === "passed" && <div className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" /><div><p className="font-semibold text-emerald-700 dark:text-emerald-300">Ready for review</p><p className="mt-1 text-sm text-muted-foreground">The starter rubric passed. Practise explaining the data structure, complexity, and edge cases.</p></div></div>}{result === "needs_iteration" && <div className="flex items-start gap-3 rounded-xl border border-orange-500/25 bg-orange-500/10 p-4"><XCircle className="mt-0.5 h-5 w-5 text-orange-500" /><div><p className="font-semibold text-orange-700 dark:text-orange-300">Keep iterating</p><p className="mt-1 text-sm text-muted-foreground">The practice rubric is looking for a non-placeholder return and a fuller implementation.</p></div></div>}</CardContent></Card>
        </div>
      </div>
    </AppShell>
  );
}
