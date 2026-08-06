import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  ShieldCheck,
  ExternalLink,
  Ban,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAgentRun,
  listAgentRunSteps,
  transitionRun,
  type AgentRunStatus,
} from "@/lib/agent/applyAgent";

const statusTone: Record<AgentRunStatus, string> = {
  queued: "bg-muted text-muted-foreground",
  running: "bg-primary/15 text-primary border-primary/25",
  awaiting_review: "bg-amber-500/15 text-amber-600 border-amber-500/25",
  submitted: "bg-emerald-500/15 text-emerald-600 border-emerald-500/25",
  cancelled: "bg-muted text-muted-foreground",
  failed: "bg-destructive/10 text-destructive border-destructive/25",
};

const statusLabel: Record<AgentRunStatus, string> = {
  queued: "Queued",
  running: "Working",
  awaiting_review: "Awaiting your review",
  submitted: "Submitted by you",
  cancelled: "Cancelled",
  failed: "Failed",
};

/**
 * Glass-Box view of one agent run: every step, every log line, and an explicit
 * human gate. The agent never submits — the user does.
 */
export function AgentLiveView({ runId }: { runId: string }) {
  const queryClient = useQueryClient();
  const logRef = useRef<HTMLDivElement>(null);

  const { data: run } = useQuery({
    queryKey: ["agent-run", runId],
    queryFn: () => getAgentRun(runId),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "running" || s === "queued" ? 1500 : false;
    },
  });

  const { data: steps = [] } = useQuery({
    queryKey: ["agent-run-steps", runId],
    queryFn: () => listAgentRunSteps(runId),
    refetchInterval: run?.status === "running" || run?.status === "queued" ? 1500 : false,
  });

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [steps]);

  const transition = useMutation({
    mutationFn: (action: "submit" | "cancel") => transitionRun(runId, action),
    onSuccess: (_d, action) => {
      toast.success(action === "submit" ? "Marked as submitted" : "Run cancelled");
      queryClient.invalidateQueries({ queryKey: ["agent-run", runId] });
      queryClient.invalidateQueries({ queryKey: ["agent-runs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!run) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          Loading run…
        </CardContent>
      </Card>
    );
  }

  const awaiting = run.status === "awaiting_review";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">
              {run.job_title || "Application"}
              {run.company ? <span className="text-muted-foreground font-normal"> · {run.company}</span> : null}
            </CardTitle>
            <CardDescription>{run.current_step || "Preparing…"}</CardDescription>
          </div>
          <Badge variant="outline" className={statusTone[run.status]}>
            {statusLabel[run.status]}
          </Badge>
        </div>
        <Progress value={run.progress} className="h-1.5" />
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          Human-in-the-loop: this agent prepares and shows its work. It never submits an
          application and never marks a job applied on your behalf.
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <ol className="space-y-3">
          {steps.map((step) => (
            <li key={step.id} className="flex gap-3">
              <div className="pt-0.5">
                {step.status === "done" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : step.status === "running" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : step.status === "failed" ? (
                  <XCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/50" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium">{step.name}</div>
                {step.detail ? (
                  <div className="text-xs text-muted-foreground">{step.detail}</div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Execution log
          </div>
          <div
            ref={logRef}
            className="max-h-72 overflow-y-auto rounded-lg border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap"
          >
            {steps.filter((s) => s.logs).length === 0 ? (
              <span className="text-muted-foreground">No output yet.</span>
            ) : (
              steps
                .filter((s) => s.logs)
                .map((s) => (
                  <div key={s.id} className="mb-3">
                    <span className="text-primary">[{s.name}]</span>
                    {"\n"}
                    {s.logs}
                  </div>
                ))
            )}
          </div>
        </div>

        {run.outcome ? (
          <div className="rounded-lg border bg-card/60 p-3 text-sm">{run.outcome}</div>
        ) : null}

        {awaiting ? (
          <div className="flex flex-wrap gap-2">
            {run.job_url ? (
              <Button asChild>
                <a href={run.job_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> Open posting & submit
                </a>
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={() => transition.mutate("submit")}
              disabled={transition.isPending}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" /> I submitted this
            </Button>
            <Button
              variant="ghost"
              onClick={() => transition.mutate("cancel")}
              disabled={transition.isPending}
            >
              <Ban className="mr-2 h-4 w-4" /> Discard
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default AgentLiveView;
