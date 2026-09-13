import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  BarChart3,
  Layers,
  ArrowUpRight,
  Loader2,
  Plus
} from "lucide-react";
import { toast } from "sonner";

export interface WilsonMetric {
  point_estimate: number;
  point_percentage: number;
  n: number;
  successes: number;
  margin_of_error: number;
  margin_percentage: number;
  lower: number;
  upper: number;
  display: string;
}

export interface OutcomeMetrics {
  match_precision: WilsonMetric;
  artifact_acceptance_rate: WilsonMetric;
  repeat_workflow_rate: WilsonMetric;
  sample_size: number;
  candidate_confirmed_count: number;
  externally_verified_count: number;
  event_type_distribution?: Record<string, number>;
}

export interface OutcomeEvent {
  id: string;
  user_id: string;
  application_run_id?: string | null;
  event_type: "saved" | "rejected" | "applied" | "interviewing" | "declined" | "offer" | "hired";
  is_candidate_confirmed: boolean;
  is_externally_verified: boolean;
  notes?: string | null;
  created_at: string;
}

interface OutcomeTrackerProps {
  initialAnalytics?: OutcomeMetrics;
  initialEvents?: OutcomeEvent[];
  readOnly?: boolean;
}

const DEFAULT_ZERO_METRIC: WilsonMetric = {
  point_estimate: 0,
  point_percentage: 0,
  n: 0,
  successes: 0,
  margin_of_error: 0,
  margin_percentage: 0,
  lower: 0,
  upper: 0,
  display: "0% (n=0, ±0%)",
};

export const OutcomeTracker: React.FC<OutcomeTrackerProps> = ({
  initialAnalytics,
  initialEvents,
  readOnly = false,
}) => {
  const queryClient = useQueryClient();

  const [recordOpen, setRecordOpen] = useState(false);
  const [newEventType, setNewEventType] = useState<OutcomeEvent["event_type"]>("applied");
  const [newNotes, setNewNotes] = useState("");
  const [isCandidateConfirmed, setIsCandidateConfirmed] = useState(true);

  // Analytics query
  const {
    data: analyticsData,
    isLoading: analyticsLoading,
    error: analyticsError,
  } = useQuery({
    queryKey: ["outcome-analytics"],
    queryFn: async () => {
      const res = await apiFetch<{ analytics: OutcomeMetrics }>("/v1/outcomes/analytics");
      return res.analytics;
    },
    initialData: initialAnalytics,
    enabled: !initialAnalytics,
  });

  // Events query
  const {
    data: eventsData,
    isLoading: eventsLoading,
    error: eventsError,
  } = useQuery({
    queryKey: ["outcome-events"],
    queryFn: async () => {
      const res = await apiFetch<{ outcomes: OutcomeEvent[] }>("/v1/outcomes?limit=50");
      return res.outcomes;
    },
    initialData: initialEvents,
    enabled: !initialEvents,
  });

  const recordMutation = useMutation({
    mutationFn: async (payload: {
      event_type: string;
      notes?: string;
      is_candidate_confirmed: boolean;
    }) => {
      return await apiFetch<{ outcome: OutcomeEvent }>("/v1/outcomes", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast.success("Outcome Recorded", {
        description: "Outcome event added to candidate learning loop.",
      });
      setRecordOpen(false);
      setNewNotes("");
      queryClient.invalidateQueries({ queryKey: ["outcome-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["outcome-events"] });
    },
    onError: (err: any) => {
      toast.error("Failed to record outcome", {
        description: err.message || "An error occurred while saving outcome event.",
      });
    },
  });

  const analytics = analyticsData || initialAnalytics || {
    match_precision: DEFAULT_ZERO_METRIC,
    artifact_acceptance_rate: DEFAULT_ZERO_METRIC,
    repeat_workflow_rate: DEFAULT_ZERO_METRIC,
    sample_size: 0,
    candidate_confirmed_count: 0,
    externally_verified_count: 0,
  };

  const events = eventsData || initialEvents || [];

  const handleRecordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    recordMutation.mutate({
      event_type: newEventType,
      notes: newNotes.trim() || undefined,
      is_candidate_confirmed: isCandidateConfirmed,
    });
  };

  return (
    <div className="space-y-6" data-testid="outcome-tracker">
      {/* Error state: surface backend failures explicitly */}
      {(analyticsError || eventsError) && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            {analyticsError ? "Analytics data unavailable" : "Outcome events unavailable"} — metrics shown may be stale.{" "}
            <button
              className="underline font-medium"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["outcome-analytics"] });
                queryClient.invalidateQueries({ queryKey: ["outcome-events"] });
              }}
            >
              Retry
            </button>
          </span>
        </div>
      )}

      {/* Header & Truthful Disclosure */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Outcome Learning Loop
            </h3>
            <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
              Wilson 95% CI
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Truthful, candidate-audited telemetry. Small samples always disclose sample size <span className="font-mono">n</span> and margin of error to prevent fabricated certainty.
          </p>
        </div>

        {!readOnly && (
          <Button
            size="sm"
            onClick={() => setRecordOpen(!recordOpen)}
            className="text-xs gap-1.5 bg-primary text-primary-foreground font-semibold shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Record Outcome Event
          </Button>
        )}
      </div>

      {/* Record Outcome Drawer / Form */}
      {recordOpen && (
        <Card className="border-primary/30 bg-primary/5 p-4 rounded-xl space-y-3">
          <form onSubmit={handleRecordSubmit} className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Log Pipeline Milestone
              </h4>
              <span className="text-[10px] text-muted-foreground">
                Client tokens record candidate-confirmed status
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Milestone Event Type
                </label>
                <select
                  value={newEventType}
                  onChange={(e) => setNewEventType(e.target.value as OutcomeEvent["event_type"])}
                  className="w-full text-xs p-2 rounded-lg border border-border bg-background text-foreground"
                >
                  <option value="saved">Saved / Bookmarked</option>
                  <option value="applied">Applied (Submitted)</option>
                  <option value="interviewing">Interviewing</option>
                  <option value="offer">Offer Received</option>
                  <option value="hired">Hired (Accepted)</option>
                  <option value="declined">Declined</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Notes (Optional context)
                </label>
                <Input
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="e.g. Completed round 2 system design..."
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isCandidateConfirmed}
                  onChange={(e) => setIsCandidateConfirmed(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                />
                <span>Confirm this represents a genuine candidate milestone</span>
              </label>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRecordOpen(false)}
                  className="text-xs h-8"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={recordMutation.isPending}
                  className="text-xs h-8 bg-primary text-primary-foreground font-semibold"
                >
                  {recordMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Save Outcome"
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Card>
      )}

      {/* Verification Status Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 bg-card border-border/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-muted-foreground uppercase">
              Total Telemetry Samples
            </span>
            <Layers className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground" data-testid="total-samples">
              {analytics.sample_size}
            </span>
            <span className="text-xs text-muted-foreground font-mono">events</span>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-muted-foreground uppercase">
              Candidate Confirmed
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400" data-testid="candidate-confirmed-count">
              {analytics.candidate_confirmed_count}
            </span>
            <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-500 bg-emerald-500/10">
              User Verified
            </Badge>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-muted-foreground uppercase">
              Externally Verified
            </span>
            <ShieldCheck className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-primary" data-testid="externally-verified-count">
              {analytics.externally_verified_count}
            </span>
            <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary bg-primary/10">
              Server Cryptographic Proof
            </Badge>
          </div>
        </Card>
      </div>

      {/* Metrics with 95% Wilson Score Confidence Intervals */}
      <div className="space-y-3">
        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
          Calibrated Quality Metrics (Wilson 95% Confidence Intervals)
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Metric 1: Match Precision */}
          <Card className="p-4 bg-card border-border/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                Match Precision
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                Confirmed / Recs
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className="text-xl font-bold font-mono text-foreground"
                data-testid="match-precision-display"
              >
                {analytics.match_precision.display}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground space-y-1">
              <p>
                95% CI: <span className="font-mono text-foreground">
                  [{Math.round(analytics.match_precision.lower * 100)}% – {Math.round(analytics.match_precision.upper * 100)}%]
                </span>
              </p>
              <p className="text-[10px] leading-tight text-muted-foreground/80">
                Proportion of recommended opportunities candidate progressed with.
              </p>
            </div>
          </Card>

          {/* Metric 2: Artifact Acceptance Rate */}
          <Card className="p-4 bg-card border-border/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                Artifact Acceptance
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                Accepted / Total
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className="text-xl font-bold font-mono text-foreground"
                data-testid="artifact-acceptance-display"
              >
                {analytics.artifact_acceptance_rate.display}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground space-y-1">
              <p>
                95% CI: <span className="font-mono text-foreground">
                  [{Math.round(analytics.artifact_acceptance_rate.lower * 100)}% – {Math.round(analytics.artifact_acceptance_rate.upper * 100)}%]
                </span>
              </p>
              <p className="text-[10px] leading-tight text-muted-foreground/80">
                Proportion of generated resumes & letters adopted without discard.
              </p>
            </div>
          </Card>

          {/* Metric 3: Repeat Workflow Rate */}
          <Card className="p-4 bg-card border-border/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                Repeat Workflow Rate
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                Multi-run Sessions
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className="text-xl font-bold font-mono text-foreground"
                data-testid="repeat-workflow-display"
              >
                {analytics.repeat_workflow_rate.display}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground space-y-1">
              <p>
                95% CI: <span className="font-mono text-foreground">
                  [{Math.round(analytics.repeat_workflow_rate.lower * 100)}% – {Math.round(analytics.repeat_workflow_rate.upper * 100)}%]
                </span>
              </p>
              <p className="text-[10px] leading-tight text-muted-foreground/80">
                Candidates who iterate through multiple stages in their journey.
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Outcome Events Audit Log Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
            Auditable Outcome Events ({events.length})
          </h4>
          <span className="text-[10px] text-muted-foreground">
            Owner-scoped • Zero synthetic profiles
          </span>
        </div>

        {events.length === 0 ? (
          <Card className="p-6 text-center border-dashed border-border/70">
            <p className="text-xs text-muted-foreground">
              No outcome events recorded yet. Record your application milestones to populate the learning loop.
            </p>
          </Card>
        ) : (
          <div className="border border-border/70 rounded-xl overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 border-b border-border/60 text-[11px] font-mono uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2.5 px-4">Event Type</th>
                    <th className="py-2.5 px-4">Verification Provenance</th>
                    <th className="py-2.5 px-4">Notes</th>
                    <th className="py-2.5 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {events.map((evt) => (
                    <tr key={evt.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-4">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono uppercase px-2 py-0.5 ${
                            evt.event_type === "offer" || evt.event_type === "hired"
                              ? "border-emerald-500/40 text-emerald-500 bg-emerald-500/10"
                              : evt.event_type === "interviewing"
                              ? "border-blue-500/40 text-blue-500 bg-blue-500/10"
                              : evt.event_type === "applied"
                              ? "border-primary/40 text-primary bg-primary/10"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          {evt.event_type}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4">
                        {evt.is_externally_verified ? (
                          <span className="inline-flex items-center gap-1.5 text-primary font-medium">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Externally Verified
                          </span>
                        ) : evt.is_candidate_confirmed ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Candidate Confirmed
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Unconfirmed</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground max-w-xs truncate">
                        {evt.notes || "—"}
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground font-mono text-[10px]">
                        {evt.created_at ? new Date(evt.created_at).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OutcomeTracker;
