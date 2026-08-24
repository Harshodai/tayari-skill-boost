import React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, HelpCircle, ShieldCheck, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export interface CalibratedFitProps {
  score?: number | null;
  fitBand?: "strong" | "moderate" | "transferable" | "gap_heavy" | "unranked";
  matchedSkills?: string[];
  missingSkills?: string[];
  matchReason?: string;
  isLiveAtSource?: boolean;
  atsProvider?: string | null;
  transitionType?: string | null;
}

export function getFitBand(score: number | null | undefined): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  className: string;
  icon: React.ReactNode;
} {
  if (score === null || score === undefined) {
    return {
      label: "Unranked (AI offline)",
      variant: "outline",
      className: "border-muted-foreground/30 text-muted-foreground bg-muted/20",
      icon: <HelpCircle className="w-3.5 h-3.5 mr-1" />,
    };
  }
  if (score >= 80) {
    return {
      label: `Strong Fit (${score}%)`,
      variant: "default",
      className: "bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      icon: <CheckCircle2 className="w-3.5 h-3.5 mr-1" />,
    };
  }
  if (score >= 65) {
    return {
      label: `Moderate Fit (${score}%)`,
      variant: "secondary",
      className: "bg-blue-600/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      icon: <CheckCircle2 className="w-3.5 h-3.5 mr-1" />,
    };
  }
  if (score >= 50) {
    return {
      label: `Transferable Match (${score}%)`,
      variant: "secondary",
      className: "bg-amber-600/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      icon: <AlertTriangle className="w-3.5 h-3.5 mr-1" />,
    };
  }
  return {
    label: `Skill Gap Heavy (${score}%)`,
    variant: "destructive",
    className: "bg-rose-600/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    icon: <AlertTriangle className="w-3.5 h-3.5 mr-1" />,
  };
}

export function CalibratedFitCard({
  score,
  matchedSkills = [],
  missingSkills = [],
  matchReason,
  isLiveAtSource = true,
  atsProvider,
  transitionType,
}: CalibratedFitProps) {
  const band = getFitBand(score);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`font-mono text-xs px-2.5 py-0.5 flex items-center ${band.className}`}>
            {band.icon}
            {band.label}
          </Badge>
          {isLiveAtSource && (
            <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1">
              <ShieldCheck className="w-3 h-3" /> Live at source
            </Badge>
          )}
          {transitionType === "cross_domain" && (
            <Badge variant="secondary" className="text-[10px] bg-accent/10 text-accent dark:text-accent border-accent/20">
              Cross-Domain Weighting
            </Badge>
          )}
        </div>
        {atsProvider && (
          <span className="text-[11px] text-muted-foreground">
            ATS: <span className="font-medium text-foreground">{atsProvider}</span>
          </span>
        )}
      </div>

      {matchReason && (
        <div className="text-xs text-foreground/80 leading-relaxed flex items-start gap-1.5 bg-muted/40 p-2.5 rounded-md">
          <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
          <span>{matchReason}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="space-y-1.5">
          <div className="font-semibold text-[11px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Verified Skills ({matchedSkills.length})
          </div>
          {matchedSkills.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {matchedSkills.map((s, i) => (
                <Badge key={i} variant="outline" className="text-[10px] bg-emerald-500/5 text-emerald-700 dark:text-emerald-300 border-emerald-500/20">
                  ✓ {s}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">No direct skill overlap identified.</p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[11px] text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Missing Skills ({missingSkills.length})
            </span>
            {missingSkills.length > 0 && (
              <Button variant="link" size="sm" className="h-4 p-0 text-[10px] text-primary" asChild>
                <Link to="/roadmap">Bridge Gaps <ArrowRight className="w-2.5 h-2.5 ml-0.5 inline" /></Link>
              </Button>
            )}
          </div>
          {missingSkills.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {missingSkills.map((s, i) => (
                <Badge key={i} variant="outline" className="text-[10px] bg-amber-500/5 text-amber-700 dark:text-amber-300 border-amber-500/20">
                  + {s}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">No missing prerequisite skills detected.</p>
          )}
        </div>
      </div>
    </div>
  );
}
