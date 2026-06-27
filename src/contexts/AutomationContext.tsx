import { createContext, useCallback, useContext, useMemo, useState, ReactNode, useEffect } from "react";

export type AutomationStatus = "queued" | "running" | "done" | "failed";

export interface AutomationStep {
  id: string;
  label: string;
  status: AutomationStatus;
}

export interface AutomationRun {
  id: string;
  title: string;
  context?: string; // e.g. "Senior PM @ Stripe"
  createdAt: number;
  steps: AutomationStep[];
}

interface AutomationContextValue {
  runs: AutomationRun[];
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  startRun: (input: { title: string; context?: string; steps: string[] }) => string;
  advanceRun: (runId: string, stepId: string, status: AutomationStatus) => void;
  clearCompleted: () => void;
}

const AutomationCtx = createContext<AutomationContextValue | null>(null);

let runCounter = 0;
const nextId = (prefix: string) => `${prefix}_${Date.now()}_${++runCounter}`;

export function AutomationProvider({ children }: { children: ReactNode }) {
  const [runs, setRuns] = useState<AutomationRun[]>([]);
useEffect(() => {
  const saved = localStorage.getItem('automation_runs');
  if (saved) {
    try {
      setRuns(JSON.parse(saved));
    } catch {}
  }
}, []);
useEffect(() => {
  localStorage.setItem('automation_runs', JSON.stringify(runs));
}, [runs]);
  const [isOpen, setIsOpen] = useState(false);

  const startRun: AutomationContextValue["startRun"] = useCallback(({ title, context, steps }) => {
  try {
    const runId = nextId("run");
    const stepObjs: AutomationStep[] = steps.map((label, i) => ({
      id: `${runId}_s${i}`,
      label,
      status: i === 0 ? "running" : "queued",
    }));
    setRuns((prev) => [
      { id: runId, title, context, createdAt: Date.now(), steps: stepObjs },
      ...prev,
    ]);
    setIsOpen(true);
    // simulate progress so the UI feels alive
    stepObjs.forEach((s, i) => {
      setTimeout(() => {
        setRuns((prev) =>
          prev.map((r) =>
            r.id !== runId
              ? r
              : {
                  ...r,
                  steps: r.steps.map((st, j) => {
                    if (j < i) return { ...st, status: "done" };
                    if (j === i) return { ...st, status: "running" };
                    return st;
                  }),
                }
          )
        );
      }, i * 1400);
    });
    setTimeout(() => {
      setRuns((prev) =>
        prev.map((r) =>
          r.id !== runId ? r : { ...r, steps: r.steps.map((st) => ({ ...st, status: "done" })) }
        )
      );
    }, stepObjs.length * 1400 + 600);
    return runId;
    } catch (e) {
      console.error("Failed to start automation run:", e);
      return "";
    }
  }, []);

  const advanceRun: AutomationContextValue["advanceRun"] = useCallback((runId, stepId, status) => {
    setRuns(prev =>
      prev.map(r => {
        if (r.id !== runId) return r;
        const stepExists = r.steps.some(s => s.id === stepId);
        if (!stepExists) return r;
        return { ...r, steps: r.steps.map(s => (s.id === stepId ? { ...s, status } : s)) };
      })
    );
  }, []);

  const value = useMemo<AutomationContextValue>(
    () => ({
      runs,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((v) => !v),
      startRun,
      advanceRun,
      clearCompleted: () =>
        setRuns((prev) => prev.filter((r) => r.steps.some((s) => s.status !== "done"))),
    }),
    [runs, isOpen, startRun, advanceRun]
  );

  return <AutomationCtx.Provider value={value}>{children}</AutomationCtx.Provider>;
}

export function useAutomation() {
  const ctx = useContext(AutomationCtx);
  if (!ctx) throw new Error("useAutomation must be used within AutomationProvider");
  return ctx;
}
