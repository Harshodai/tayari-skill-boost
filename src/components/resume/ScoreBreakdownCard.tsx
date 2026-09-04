import React, { useState } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Sparkles,
  Briefcase,
  Award,
  TrendingUp,
  Target,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ScoreBreakdown } from "@/types/resume";

export interface ScoreBreakdownCardProps {
  breakdown?: ScoreBreakdown | null;
  className?: string;
}

export const ScoreBreakdownCard: React.FC<ScoreBreakdownCardProps> = ({
  breakdown,
  className = "",
}) => {
  const [showStuffingDetails, setShowStuffingDetails] = useState(false);
  const [showRationaleDetails, setShowRationaleDetails] = useState(true);

  if (!breakdown) {
    return (
      <Card className={`border border-border/60 ${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-muted-foreground" />
            Trust-First ATS Score Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Run an ATS analysis or resume optimization to view transparent scoring dimensions.
          </p>
        </CardContent>
      </Card>
    );
  }

  const {
    structural_ats = 0,
    semantic_fit = 0,
    experience_relevance = 0,
    achievement_quality = 0,
    seniority_alignment = "unknown",
    keyword_coverage = 0,
    keyword_stuffing_penalty: rawPenalty = null,
    unsupported_claims_count = 0,
    confidence_band = "medium",
    human_rationale = "",
  } = breakdown;

  // Null-safe penalty object — API may omit or null any field
  const keyword_stuffing_penalty = {
    count: rawPenalty?.count ?? 0,
    penalty_points: rawPenalty?.penalty_points ?? 0,
    flagged_keywords: rawPenalty?.flagged_keywords ?? [],
  };

  const getConfidenceBadgeVariant = (band: string) => {
    switch (band?.toLowerCase()) {
      case "high":
        return "success";
      case "medium":
        return "warning";
      case "low":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getSeniorityBadgeVariant = (alignment: string | number) => {
    if (typeof alignment === "number") {
      return alignment >= 75 ? "success" : alignment >= 50 ? "warning" : "destructive";
    }
    switch (alignment?.toLowerCase()) {
      case "aligned":
        return "success";
      case "under":
        return "warning";
      case "over":
        return "info";
      default:
        return "secondary";
    }
  };

  const formatSeniorityText = (alignment: string | number) => {
    if (typeof alignment === "number") return `${alignment}% Match`;
    return alignment.charAt(0).toUpperCase() + alignment.slice(1);
  };

  const dimensions = [
    {
      id: "structural_ats",
      name: "Structural ATS",
      value: structural_ats,
      icon: FileText,
      description: "Formatting compliance, single-column parsing, and section completeness",
    },
    {
      id: "semantic_fit",
      name: "Semantic Fit",
      value: semantic_fit,
      icon: Sparkles,
      description: "Contextual phrase alignment and n-gram overlap with the job description",
    },
    {
      id: "experience_relevance",
      name: "Experience Relevance",
      value: experience_relevance,
      icon: Briefcase,
      description: "Direct career progression, work history depth, and action-verb strength",
    },
    {
      id: "achievement_quality",
      name: "Achievement Quality",
      value: achievement_quality,
      icon: Award,
      description: "Quantified metrics, numerical results, and STAR bullet impact",
    },
    {
      id: "keyword_coverage",
      name: "Keyword Coverage",
      value: keyword_coverage,
      icon: Target,
      description: "Hard technical skills and essential requirements found in resume",
    },
  ];

  return (
    <TooltipProvider>
      <Card className={`border border-border/80 shadow-sm ${className}`} data-testid="score-breakdown-card">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  Trust-First Score Breakdown
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Multi-dimensional ATS verification with anti-stuffing enforcement
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={getConfidenceBadgeVariant(confidence_band)} className="text-xs px-2.5 py-0.5 uppercase tracking-wider font-bold">
                {confidence_band} Confidence
              </Badge>

              {unsupported_claims_count > 0 ? (
                <Badge variant="destructive" className="text-xs px-2.5 py-0.5">
                  {unsupported_claims_count} Unverified Claim{unsupported_claims_count > 1 ? "s" : ""}
                </Badge>
              ) : (
                <Badge variant="subtle" className="text-xs px-2.5 py-0.5 text-muted-foreground border border-border/40">
                  0 Unverified Claims
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-5">
          {/* Dimensions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dimensions.map((dim) => {
              const Icon = dim.icon;
              return (
                <div
                  key={dim.id}
                  className="p-3.5 rounded-xl border border-border/50 bg-card/60 hover:bg-muted/30 transition-colors space-y-2"
                  data-testid={`dimension-${dim.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-xs font-semibold text-foreground">{dim.name}</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Info about ${dim.name}`}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs">
                          {dim.description}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <span className="text-xs font-mono font-bold tabular-nums text-foreground">
                      {Math.round(dim.value)}%
                    </span>
                  </div>
                  <Progress value={dim.value} size="sm" colorScheme="auto" />
                </div>
              );
            })}

            {/* Seniority Alignment Card */}
            <div
              className="p-3.5 rounded-xl border border-border/50 bg-card/60 hover:bg-muted/30 transition-colors flex items-center justify-between"
              data-testid="dimension-seniority_alignment"
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-foreground block">Seniority Alignment</span>
                  <span className="text-[11px] text-muted-foreground">Title and years calibration</span>
                </div>
              </div>
              <Badge variant={getSeniorityBadgeVariant(seniority_alignment)} className="text-xs px-2.5 py-0.5 font-bold">
                {formatSeniorityText(seniority_alignment)}
              </Badge>
            </div>
          </div>

          {/* Keyword Stuffing Warning or Clean Status */}
          {keyword_stuffing_penalty.penalty_points > 0 ? (
            <div
              className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3"
              data-testid="keyword-stuffing-penalty"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-destructive">
                        Keyword Stuffing Penalty Applied
                      </h4>
                      <Badge variant="destructive" className="text-xs font-mono font-bold">
                        -{keyword_stuffing_penalty.penalty_points} pts
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      ATS algorithms and technical recruiters penalize unnatural keyword repetition.
                      Keywords appearing &gt;3 times verbatim across bullets reduce diagnostic ranking.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  aria-label={showStuffingDetails ? `Hide (${keyword_stuffing_penalty.flagged_keywords.length}) stuffed keyword details` : `Review (${keyword_stuffing_penalty.flagged_keywords.length}) stuffed keyword details`}
                  aria-expanded={showStuffingDetails}
                  onClick={() => setShowStuffingDetails(!showStuffingDetails)}

                  className="text-xs font-medium text-destructive hover:underline flex items-center gap-1 shrink-0"
                >
                  {showStuffingDetails ? "Hide" : "Review"} ({keyword_stuffing_penalty.flagged_keywords.length})
                  {showStuffingDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {showStuffingDetails && keyword_stuffing_penalty.flagged_keywords.length > 0 && (
                <div className="border-t border-destructive/20 pt-3 space-y-2.5">
                  <span className="text-[11px] font-semibold text-destructive uppercase tracking-wider">
                    Flagged Terms & Verbatim Usage:
                  </span>
                  <div className="space-y-2">
                    {keyword_stuffing_penalty.flagged_keywords.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-background/80 border border-destructive/20 rounded-lg p-2.5 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-destructive">
                            "{item.keyword}"
                          </span>
                          <span className="text-muted-foreground tabular-nums">
                            {item.count} occurrences across bullets
                          </span>
                        </div>
                        {item.example && (
                          <p className="text-[11px] text-muted-foreground italic truncate">
                            Example: "{item.example}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              className="rounded-xl border border-success/30 bg-success/5 p-3.5 flex items-center justify-between gap-3"
              data-testid="keyword-stuffing-clean"
            >
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-success">
                    Zero Keyword Stuffing Detected
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Natural keyword distribution verified across all experience bullets.
                  </p>
                </div>
              </div>
              <Badge variant="success" className="text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider shrink-0">
                Clean Scan
              </Badge>
            </div>
          )}

          {/* Human Rationale Callout */}
          {human_rationale && (
            <div className="border border-border/50 rounded-xl p-4 bg-muted/20 space-y-2" data-testid="human-rationale-section">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Scoring Rationale & Recommendations
                  </span>
                </div>
                <button
                  type="button"
                  aria-label={showRationaleDetails ? "Collapse scoring rationale" : "Expand scoring rationale"}
                  aria-expanded={showRationaleDetails}
                  onClick={() => setShowRationaleDetails(!showRationaleDetails)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {showRationaleDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {showRationaleDetails && (
                <p className="text-xs text-foreground/90 leading-relaxed pt-1">
                  {human_rationale}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};
