import React, { useState, useEffect } from "react";
import { apiFetch } from "@/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Compass, ArrowRight, CheckCircle2, Clock, ThumbsUp, ThumbsDown, Sparkles, Loader2 } from "lucide-react";

export interface ScenarioPlan {
  scenario: string;
  scenario_title: string;
  plan_version: string;
  confidence: "high" | "medium" | "low";
  generated_at: string;
  transferable_skills: Array<{
    skill: string;
    evidence: string;
    confidence: number;
  }>;
  missing_skills: Array<{
    skill: string;
    effort_weeks: number;
    learning_path: string[];
  }>;
  available_roles: Array<{
    title: string;
    count: number;
    fit: number;
  }>;
  next_action: string;
}

const SCENARIOS = [
  { id: "role_change", label: "Role Transition", desc: "Pivot to an adjacent discipline" },
  { id: "seniority_increase", label: "Level Up", desc: "Advance to Senior, Staff, or Lead" },
  { id: "domain_change", label: "Domain Shift", desc: "Move between industries" },
  { id: "return_to_work", label: "Return to Work", desc: "Re-enter the job market" },
  { id: "relocation", label: "Relocation", desc: "Remote or international shift" },
];

interface ScenarioPlannerProps {
  initialPlan?: ScenarioPlan;
}

export const ScenarioPlanner: React.FC<ScenarioPlannerProps> = ({ initialPlan }) => {
  const [selectedScenario, setSelectedScenario] = useState("role_change");
  const [feedbackSent, setFeedbackSent] = useState<string | null>(null);
  const [fetchedPlan, setFetchedPlan] = useState<ScenarioPlan | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (initialPlan) return;
    let active = true;
    setIsLoading(true);
    setFetchError(null);
    apiFetch<ScenarioPlan>("/v1/career/scenario-plan", {
      method: "POST",
      body: JSON.stringify({ scenario: selectedScenario }),
    })
      .then((data) => {
        if (active && data) {
          setFetchedPlan(data);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setFetchedPlan(null);
          setFetchError(err instanceof Error && err.message ? err.message : "Scenario plan unavailable");
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedScenario, initialPlan]);

  const currentPlan = fetchedPlan || initialPlan || null;


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {SCENARIOS.map((sc) => (
          <Button
            key={sc.id}
            variant={selectedScenario === sc.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedScenario(sc.id)}
            className="text-xs h-8 gap-1.5"
          >
            <Compass className="w-3.5 h-3.5" />
            {sc.label}
          </Button>
        ))}
      </div>

      {isLoading && !currentPlan && (
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="py-8 text-center space-y-3">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
            <p className="text-xs text-muted-foreground">Loading scenario plan from the backend...</p>
          </CardContent>
        </Card>
      )}

      {fetchError && !currentPlan && !isLoading && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-6 text-center space-y-2">
            <p className="text-xs font-semibold text-destructive">Scenario plan unavailable</p>
            <p className="text-[11px] text-muted-foreground">{fetchError}</p>
          </CardContent>
        </Card>
      )}

      {!fetchError && !currentPlan && !isLoading && (
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="py-6 text-center">
            <p className="text-xs text-muted-foreground">
              No scenario plan returned by the backend for this scenario yet.
            </p>
          </CardContent>
        </Card>
      )}

      {currentPlan && (
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                {currentPlan.scenario_title} Roadmap
              </CardTitle>
              <CardDescription className="text-xs">
                Version {currentPlan.plan_version} · Grounded against market demand & resume assets
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs text-primary border-primary/30">
              {currentPlan.confidence.toUpperCase()} CONFIDENCE
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 text-sm">
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-xs flex items-start gap-2.5">
            <ArrowRight className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground">Recommended Next Milestone:</span>
              <p className="text-muted-foreground mt-0.5">{currentPlan.next_action}</p>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
              Transferable Core Strengths
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {currentPlan.transferable_skills.map((ts, idx) => (
                <div key={idx} className="p-2.5 rounded-lg border border-border/50 bg-background/50 text-xs">
                  <span className="font-medium text-foreground block truncate">{ts.skill}</span>
                  <span className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{ts.evidence}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
              Strategic Capability Gaps & Learning Path
            </h4>
            <div className="space-y-2.5">
              {currentPlan.missing_skills.map((ms, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-border/50 bg-background/50 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{ms.skill}</span>
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Clock className="w-3 h-3" /> ~{ms.effort_weeks} weeks
                    </Badge>
                  </div>
                  <ul className="space-y-1 pl-4 list-disc text-muted-foreground text-[11px]">
                    {ms.learning_path.map((step, sIdx) => (
                      <li key={sIdx}>{step}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
            <span>Was this scenario roadmap useful?</span>
            {feedbackSent ? (
              <span className="text-emerald-500 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Feedback noted (local only, not sent)
              </span>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setFeedbackSent("useful")} className="h-7 px-2 text-xs gap-1">
                  <ThumbsUp className="w-3.5 h-3.5" /> Useful
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setFeedbackSent("too_hard")} className="h-7 px-2 text-xs gap-1">
                  <ThumbsDown className="w-3.5 h-3.5" /> Too complex
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );
};
