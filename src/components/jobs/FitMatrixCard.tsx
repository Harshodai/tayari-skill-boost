import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp, ShieldCheck, Sparkles, Clock } from "lucide-react";

export interface FitMatrixData {
  hard_constraints?: {
    pass: boolean;
    reason: string;
  };
  skill_alignment?: {
    score: number;
    strong_skills: string[];
    missing_skills: string[];
    evidence: string;
  };
  experience_relevance?: {
    score: number;
    summary: string;
    evidence_links?: string[];
  };
  seniority_alignment?: {
    result: "under" | "aligned" | "over" | "unknown";
    basis: string;
  };
  evidence_strength?: {
    level: "high" | "medium" | "low";
    source_count: number;
  };
  freshness?: {
    state: "current" | "aging" | "expired" | "unknown";
    last_checked: string;
  };
  risk_flags?: Array<{ type: string; detail: string }>;
  recommendation?: {
    action: "strong_match" | "weak_match" | "do_not_apply";
    why: string;
    what_would_change: string;
  };
}

interface FitMatrixCardProps {
  fitMatrix: FitMatrixData;
  className?: string;
}

export const FitMatrixCard: React.FC<FitMatrixCardProps> = ({ fitMatrix, className = "" }) => {
  const [expanded, setExpanded] = useState(false);

  const hardPass = fitMatrix.hard_constraints?.pass;
  const skillScore = fitMatrix.skill_alignment?.score ?? 0;
  const seniority = fitMatrix.seniority_alignment?.result ?? "unknown";
  const freshness = fitMatrix.freshness?.state ?? "unknown";
  const recAction = fitMatrix.recommendation?.action;
  const hasRecommendation = !!recAction;

  const seniorityProgressMap: Record<"aligned" | "over" | "under" | "unknown", number> = {
    aligned: 100,
    over: 85,
    under: 45,
    unknown: 0,
  };

  const freshnessVariant: Record<string, { label: string; color: string }> = {
    current: { label: "Current (<48h)", color: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10" },
    aging: { label: "Aging (2-7d)", color: "text-amber-500 border-amber-500/30 bg-amber-500/10" },
    expired: { label: "Stale / Expired", color: "text-destructive border-destructive/30 bg-destructive/10" },
    unknown: { label: "Unverified Age", color: "text-muted-foreground border-border" },
  };

  const recColors = {
    strong_match: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    weak_match: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    do_not_apply: "bg-destructive/10 text-destructive border-destructive/30",
  } as const;

  const recLabel = recAction ? recAction.replace("_", " ") : "Unassessed";

  return (
    <div className={`p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm shadow-sm space-y-3 ${className}`}>
      {/* Header Recommendation & Constraints */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`font-semibold capitalize px-2.5 py-0.5 ${hasRecommendation ? recColors[recAction] : "text-muted-foreground border-border"}`}>
            {recLabel}
          </Badge>
          {hardPass === true ? (
            <Badge variant="outline" className="text-[11px] text-emerald-500 border-emerald-500/30 gap-1">
              <CheckCircle2 className="w-3 h-3" /> Hard Constraints Passed
            </Badge>
          ) : hardPass === false ? (
            <Badge variant="destructive" className="text-[11px] gap-1">
              <XCircle className="w-3 h-3" /> Constraint Mismatch
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[11px] text-muted-foreground gap-1">
              <XCircle className="w-3 h-3" /> Constraints Unverified
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-[10px] gap-1 ${freshnessVariant[freshness]?.color || ""}`}>
            <Clock className="w-3 h-3" />
            {freshnessVariant[freshness]?.label || "Verified"}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            {expanded ? "Less details" : "Why this fit?"}
            {expanded ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
          </Button>
        </div>
      </div>

      {/* Primary Scores Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Skill Overlap</span>
            <span className="font-semibold text-foreground">{skillScore}%</span>
          </div>
          <Progress value={skillScore} className="h-1.5" />
        </div>
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Seniority</span>
            <span className="font-semibold capitalize text-foreground">{seniority}</span>
          </div>
          <Progress
            value={seniorityProgressMap[seniority] ?? 0}
            className="h-1.5"
            aria-label="Seniority alignment"
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Evidence Level</span>
            <span className="font-semibold capitalize text-foreground">
              {fitMatrix.evidence_strength?.level ?? "Unverified"}
            </span>
          </div>
          <Progress
            value={
              fitMatrix.evidence_strength?.level === "high"
                ? 100
                : fitMatrix.evidence_strength?.level === "medium"
                ? 65
                : 35
            }
            className="h-1.5"
          />
        </div>
      </div>

      {/* Risk Flags if any */}
      {fitMatrix.risk_flags && fitMatrix.risk_flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {fitMatrix.risk_flags.map((rf, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
            >
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              {rf.detail}
            </span>
          ))}
        </div>
      )}

      {/* Expandable Evidence & Answers */}
      {expanded && (
        <div className="pt-3 border-t border-border/50 text-xs space-y-2.5 text-muted-foreground animate-in fade-in-50 duration-150">
          <div>
            <span className="font-semibold text-foreground flex items-center gap-1 mb-0.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Why this role?
            </span>
            <p className="pl-4">{fitMatrix.recommendation?.why || "No fit rationale returned by the backend for this role."}</p>
          </div>

          {fitMatrix.skill_alignment && (
            <div className="pl-4 space-y-1">
              {fitMatrix.skill_alignment.strong_skills.length > 0 && (
                <p>
                  <strong className="text-foreground">Matched Skills:</strong>{" "}
                  {fitMatrix.skill_alignment.strong_skills.join(", ")}
                </p>
              )}
              {fitMatrix.skill_alignment.missing_skills.length > 0 && (
                <p>
                  <strong className="text-foreground">Missing Requirements:</strong>{" "}
                  {fitMatrix.skill_alignment.missing_skills.join(", ")}
                </p>
              )}
            </div>
          )}

          <div>
            <span className="font-semibold text-foreground flex items-center gap-1 mb-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" /> What would change the fit?
            </span>
            <p className="pl-4">{fitMatrix.recommendation?.what_would_change || "No calibration guidance returned by the backend for this role."}</p>
          </div>
        </div>
      )}
    </div>
  );
};
