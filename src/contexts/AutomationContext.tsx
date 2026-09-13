import { createContext, useCallback, useContext, useMemo, useState, ReactNode, useEffect, useRef } from "react";

export type AutomationStatus = "queued" | "running" | "done" | "failed";

export interface AutomationStep {
  id: string;
  label: string;
  status: AutomationStatus;
  /** Human-readable result or error for this step. */
  detail?: string;
}

export interface AutomationRun {
  id: string;
  title: string;
  context?: string; // e.g. "Senior PM @ Stripe"
  createdAt: number;
  /** "live" = each step called a real backend endpoint. "preview" = animated demo only. */
  mode: "live" | "preview";
  steps: AutomationStep[];
}

/** A single real unit of work in a chain. Throw to fail the step (and stop the chain). */
export interface ChainStep {
  label: string;
  /** Receives the accumulated context from previous steps; may return a detail string. */
  run: (ctx: Record<string, any>) => Promise<string | void>;
  /** When true, a failure is recorded but the chain continues. */
  optional?: boolean;
}

interface AutomationContextValue {
  runs: AutomationRun[];
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  /** Animated preview only — no backend calls. Clearly labelled in the UI. */
  startRun: (input: { title: string; context?: string; steps: string[] }) => string;
  /** Executes real async work step-by-step and reports true status. */
  runChain: (input: {
    title: string;
    context?: string;
    steps: ChainStep[];
  }) => Promise<{ runId: string; ok: boolean; ctx: Record<string, any> }>;
  advanceRun: (runId: string, stepId: string, status: AutomationStatus, detail?: string) => void;
  clearCompleted: () => void;
}

const AutomationCtx = createContext<AutomationContextValue | null>(null);

let runCounter = 0;
const nextId = (prefix: string) => `${prefix}_${Date.now()}_${++runCounter}`;
const MAX_RUNS = 50;

export function AutomationProvider({ children }: { children: ReactNode }) {
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem("automation_runs");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as AutomationRun[];
        // Legacy runs had no mode — they were all simulated.
        setRuns(parsed.map((r) => ({ ...r, mode: r.mode ?? "preview" })));
      } catch {
        /* ignore corrupt cache */
      }
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem("automation_runs", JSON.stringify(runs.slice(0, MAX_RUNS)));
    } catch (e) {
      if (e instanceof DOMException && e.name === "QuotaExceededError") {
        localStorage.setItem("automation_runs", JSON.stringify(runs.slice(0, 20)));
      }
    }
  }, [runs]);

  const patchStep = useCallback(
    (runId: string, stepId: string, patch: Partial<AutomationStep>) => {
      setRuns((prev) =>
        prev.map((r) =>
          r.id !== runId
            ? r
            : { ...r, steps: r.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)) }
        )
      );
    },
    []
  );

  const startRun: AutomationContextValue["startRun"] = useCallback(({ title, context, steps }) => {
    const runId = nextId("run");
    const stepObjs: AutomationStep[] = steps.map((label, i) => ({
      id: `${runId}_s${i}`,
      label,
      status: i === 0 ? "running" : "queued",
    }));
    setRuns((prev) => [
      { id: runId, title, context, createdAt: Date.now(), mode: "preview", steps: stepObjs },
      ...prev,
    ]);
    setIsOpen(true);
    stepObjs.forEach((_, i) => {
      setTimeout(() => {
        setRuns((prev) =>
          prev.map((r) =>
            r.id !== runId
              ? r
              : {
                  ...r,
                  steps: r.steps.map((st, j) => ({
                    ...st,
                    status: j < i ? "done" : j === i ? "running" : st.status,
                  })),
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
  }, []);

  const runChain: AutomationContextValue["runChain"] = useCallback(
    async ({ title, context, steps }) => {
      const runId = nextId("run");
      const stepObjs: AutomationStep[] = steps.map((s, i) => ({
        id: `${runId}_s${i}`,
        label: s.label,
        status: "queued",
      }));
      setRuns((prev) => [
        { id: runId, title, context, createdAt: Date.now(), mode: "live", steps: stepObjs },
        ...prev,
      ]);
      setIsOpen(true);

      const ctx: Record<string, any> = {};
      let ok = true;

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepId = stepObjs[i].id;
        patchStep(runId, stepId, { status: "running", detail: undefined });
        try {
          const detail = await step.run(ctx);
          patchStep(runId, stepId, { status: "done", detail: detail || undefined });
        } catch (err: any) {
          const message =
            err?.message?.toString().slice(0, 160) || "Request failed. Check your connection.";
          patchStep(runId, stepId, { status: "failed", detail: message });
          if (!step.optional) {
            ok = false;
            // Mark remaining steps as skipped/failed so the UI never lies about progress.
            for (let j = i + 1; j < steps.length; j++) {
              patchStep(runId, stepObjs[j].id, { status: "failed", detail: "Skipped" });
            }
            break;
          }
        }
      }
      return { runId, ok, ctx };
    },
    [patchStep]
  );

  const advanceRun: AutomationContextValue["advanceRun"] = useCallback(
    (runId, stepId, status, detail) => patchStep(runId, stepId, { status, detail }),
    [patchStep]
  );

  const value = useMemo<AutomationContextValue>(
    () => ({
      runs,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((v) => !v),
      startRun,
      runChain,
      advanceRun,
      clearCompleted: () =>
        setRuns((prev) =>
          prev.filter((r) => r.steps.some((s) => s.status !== "done" && s.status !== "failed"))
        ),
    }),
    [runs, isOpen, startRun, runChain, advanceRun]
  );

  return <AutomationCtx.Provider value={value}>{children}</AutomationCtx.Provider>;
}

export function useAutomation() {
  const ctx = useContext(AutomationCtx);
  if (!ctx) throw new Error("useAutomation must be used within AutomationProvider");
  return ctx;
}
