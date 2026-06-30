import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, ArrowRight, AlertCircle } from "lucide-react";
import { getChain, type ChainStage } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

// -------------------------------------------------------------------
// K5 — horizontal 7-stage pipeline strip for the Dashboard.
//
// Polls GET /api/v1/chain/{userId} and renders the Tayari chain
// (resume → optimize → jobs → cover → apply → interview → communicate)
// as a horizontal strip. The current stage is lit; each cell links to its
// existing page. Stages with count > 0 are "reached"; the furthest reached
// stage is "current"; the stage after it is the "next action".
//
// SRP: owns only polling + render. Stage metadata comes from the server
// (single source of truth — OCP: add a stage server-side, it appears here
// with no frontend change). Fault-tolerant: on fetch error renders nothing
// rather than breaking the Dashboard.
// -------------------------------------------------------------------

const CHAIN_POLL_MS = 30000;
const EMPTY_CHAIN: ChainStage[] = [];

export function ChainStrip() {
  const { user } = useAuth();
  const [stages, setStages] = useState<ChainStage[]>(EMPTY_CHAIN);
  const [current, setCurrent] = useState<string>("");
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await getChain(userId);
        if (cancelled) return;
        setStages(res.stages ?? EMPTY_CHAIN);
        setCurrent(res.current_stage ?? "");
        setErrored(false);
      } catch {
        // ponytail: silent degrade — chain is a dashboard nicety, not a critical path.
        if (!cancelled) setErrored(true);
      }
    };

    poll();
    const id = setInterval(poll, CHAIN_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user?.id]);

  if (errored || stages.length === 0) return null;

  const currentIndex = current ? stages.findIndex((s) => s.key === current) : -1;

  return (
    <nav aria-label="Career pipeline" className="mb-6">
      <ol className="flex flex-wrap items-center gap-1 sm:gap-2">
        {stages.map((stage, i) => {
          const reached = stage.count > 0;
          const isCurrent = i === currentIndex;
          const isNext = i === currentIndex + 1;
          return (
            <li key={stage.key} className="flex items-center">
              <Link
                to={stage.href}
                className={cn(
                  "group flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                  isCurrent
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : reached
                    ? "border-success/40 bg-success/5 text-foreground"
                    : isNext
                    ? "border-accent/50 bg-accent/5 text-foreground animate-pulse"
                    : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80"
                )}
                title={`${stage.label}: ${stage.count}`}
              >
                {reached ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                ) : isCurrent ? (
                  <Circle className="w-3.5 h-3.5 text-primary shrink-0 fill-primary/20" />
                ) : (
                  <Circle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{stage.label}</span>
                {reached && (
                  <span className="ml-1 inline-flex items-center justify-center rounded-full bg-success/15 text-success text-[10px] font-semibold px-1.5 min-w-[1.25rem]">
                    {stage.count}
                  </span>
                )}
              </Link>
              {i < stages.length - 1 && (
                <ArrowRight className="w-3 h-3 text-muted-foreground/50 mx-0.5 shrink-0" />
              )}
            </li>
          );
        })}
      </ol>
      {currentIndex >= 0 && currentIndex < stages.length - 1 && (
        <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Next: <span className="font-medium text-foreground">{stages[currentIndex + 1]?.label}</span>
        </p>
      )}
    </nav>
  );
}