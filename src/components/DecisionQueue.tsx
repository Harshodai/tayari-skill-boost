import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  Clock,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  HelpCircle,
  FileCheck,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCareerNextActions } from "@/api";
import type { CareerAction, ActionStatusBadge } from "@/api/types";

export interface DecisionQueueProps {
  className?: string;
  onActionClick?: (action: CareerAction) => void;
}

export const DecisionQueue: React.FC<DecisionQueueProps> = ({
  className = "",
  onActionClick,
}) => {
  const [actions, setActions] = useState<CareerAction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getCareerNextActions();
      const items = Array.isArray(response) ? response : response?.actions || [];
      setActions(items);
    } catch (err: unknown) {
      const msg = err instanceof Error && err.message ? err.message : "Failed to load career next actions";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActions();
  }, []);

  const renderStatusBadge = (status: ActionStatusBadge) => {
    switch (status) {
      case "verified":
        return (
          <Badge variant="success" className="text-[10px] uppercase font-bold tracking-wider gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Verified
          </Badge>
        );
      case "candidate_confirmed":
        return (
          <Badge variant="info" className="text-[10px] uppercase font-bold tracking-wider gap-1">
            <FileCheck className="w-3 h-3" />
            Candidate Confirmed
          </Badge>
        );
      case "inferred":
        return (
          <Badge variant="warning" className="text-[10px] uppercase font-bold tracking-wider gap-1">
            <Sparkles className="w-3 h-3" />
            Inferred
          </Badge>
        );
      case "illustrative":
        return (
          <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider gap-1 text-muted-foreground border-border/80">
            <HelpCircle className="w-3 h-3" />
            Illustrative
          </Badge>
        );
      case "unavailable":
      default:
        return (
          <Badge variant="destructive" className="text-[10px] uppercase font-bold tracking-wider gap-1">
            <AlertTriangle className="w-3 h-3" />
            Unavailable
          </Badge>
        );
    }
  };

  return (
    <Card className={`border border-border shadow-sm ${className}`} data-testid="decision-queue-card">
      <CardHeader className="pb-3 border-b border-border/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                Career Command Center — Decision Queue
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ranked next actions based on your verified application state and ATS telemetry
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchActions}
            disabled={isLoading}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5"
            aria-label="Refresh decision queue"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Error Alert Banner */}
        {error && (
          <div
            className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/10 flex items-start gap-2.5 text-destructive text-xs"
            role="alert"
            data-testid="decision-queue-error"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Unable to load decision queue</p>
              <p className="text-[11px] opacity-90 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !error && (
          <div className="py-8 text-center space-y-3" data-testid="decision-queue-loading">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary" />
            <p className="text-xs text-muted-foreground">Evaluating career actions and ranking priorities...</p>
          </div>
        )}

        {/* Truthful Empty State */}
        {!isLoading && !error && actions.length === 0 && (
          <div
            className="py-10 px-4 text-center rounded-xl border border-dashed border-border/80 bg-muted/20 space-y-3"
            data-testid="decision-queue-empty"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <FileText className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-foreground">No Active Actions Generated</h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Add or optimize your resume to generate personalized career actions
              </p>
            </div>
            <div className="pt-2">
              <Button size="sm" asChild>
                <Link to="/resume" className="gap-1.5 text-xs">
                  Upload or Optimize Resume
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Actions List */}
        {!isLoading && !error && actions.length > 0 && (
          <div className="space-y-3" data-testid="decision-queue-list">
            {actions.map((action) => (
              <div
                key={action.action_id}
                className="p-4 rounded-xl border border-border/60 bg-card hover:border-border hover:bg-muted/30 transition-all space-y-3"
                data-testid={`action-card-${action.action_id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1 flex-1 min-w-[240px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      {renderStatusBadge(action.status_badge)}
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {Math.round(action.confidence * 100)}% confidence
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-foreground pt-0.5">{action.title}</h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="subtle" className="text-xs text-muted-foreground gap-1 border border-border/40 font-mono">
                      <Clock className="w-3 h-3" />
                      {action.effort_estimate_mins} mins
                    </Badge>

                    {action.evidence_url ? (
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs px-3 gap-1 shadow-sm"
                        asChild
                        onClick={() => onActionClick?.(action)}
                      >
                        <Link to={action.evidence_url}>
                          Act Now
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs px-3 gap-1 shadow-sm"
                        onClick={() => onActionClick?.(action)}
                      >
                        Act Now
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Why Now & Required Candidate Action */}
                <div className="space-y-1.5 border-t border-border/40 pt-2.5">
                  <div className="flex items-start gap-1.5 text-xs text-foreground/80">
                    <span className="font-semibold text-primary shrink-0">Why Now:</span>
                    <span className="text-muted-foreground leading-relaxed">{action.why_now}</span>
                  </div>

                  {action.required_action_by_candidate && (
                    <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground shrink-0">Required Action:</span>
                      <span className="leading-relaxed">{action.required_action_by_candidate}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
