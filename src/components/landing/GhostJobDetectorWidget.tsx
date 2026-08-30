import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Ghost, ShieldCheck, AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RiskFactor {
  id: string;
  label: string;
  weight: number;
  description: string;
}

const RISK_FACTORS: RiskFactor[] = [
  {
    id: "age",
    label: "Posting Active > 60 Days",
    weight: 28,
    description: "Open positions active for months frequently indicate stale evergreen pipelines.",
  },
  {
    id: "repost",
    label: "Reposted 4+ Times Recently",
    weight: 24,
    description: "Automated repost scripts refreshing the same role without active hiring manager activity.",
  },
  {
    id: "generic",
    label: "Generic Template / No Tech Stack Specifics",
    weight: 18,
    description: "Vague responsibilities that do not map to an existing engineering team.",
  },
  {
    id: "no_manager",
    label: "No Assigned Recruiter or Team Lead",
    weight: 16,
    description: "Postings with zero direct hiring team engagement or verifiable ATS requisition ID.",
  },
  {
    id: "vague_comp",
    label: "Undisclosed or Unrealistic Compensation",
    weight: 14,
    description: "Missing salary bands in jurisdictions where disclosure is legally standard.",
  },
];

export function GhostJobDetectorWidget() {
  const [selectedFactors, setSelectedFactors] = useState<Set<string>>(
    new Set(["age", "repost"])
  );

  const toggleFactor = (id: string) => {
    setSelectedFactors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const resetFactors = () => {
    setSelectedFactors(new Set(["age", "repost"]));
  };

  const riskScore = useMemo(() => {
    let score = 0;
    RISK_FACTORS.forEach((f) => {
      if (selectedFactors.has(f.id)) {
        score += f.weight;
      }
    });
    return Math.min(score, 100);
  }, [selectedFactors]);

  const riskLevel = useMemo(() => {
    if (riskScore >= 60) return { label: "High Ghost Risk", tone: "text-destructive", badge: "destructive" as const, desc: "High probability of resume black hole. Prioritize direct outreach or skip." };
    if (riskScore >= 30) return { label: "Moderate Caution", tone: "text-amber-500", badge: "warning" as const, desc: "Some stale signals present. Verify posting on company careers board before tailoring." };
    return { label: "High Signal Listing", tone: "text-success", badge: "success" as const, desc: "Active hiring requisition with strong candidate responsiveness indicators." };
  }, [riskScore]);

  return (
    <div className="mx-auto max-w-4xl rounded-2xl border border-border/80 bg-card/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Ghost className="h-5 w-5 text-primary" />
            <h3 className="text-xl font-bold tracking-tight text-foreground font-display">
              Interactive Ghost-Job Screening Lab
            </h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Toggle real-world job posting flags to simulate our deterministic screening heuristics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={riskLevel.badge} className="px-3 py-1 text-xs font-semibold">
            {riskLevel.label} ({riskScore}%)
          </Badge>
          <button
            type="button"
            onClick={resetFactors}
            className="rounded-lg border border-border/60 p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Reset flags"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1.3fr_0.9fr] items-center">
        {/* Interactive Checkbox Matrix */}
        <div className="space-y-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Toggle Posting Warning Signs:
          </span>
          <div className="space-y-2">
            {RISK_FACTORS.map((factor) => {
              const isChecked = selectedFactors.has(factor.id);
              return (
                <button
                  key={factor.id}
                  type="button"
                  onClick={() => toggleFactor(factor.id)}
                  className={cn(
                    "w-full flex items-start gap-3 rounded-xl border p-3 text-left transition-all active:scale-[0.99]",
                    isChecked
                      ? "border-amber-500/40 bg-amber-500/10 dark:bg-amber-950/20"
                      : "border-border/50 bg-background/50 hover:bg-muted/40"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold transition-colors",
                      isChecked
                        ? "border-amber-500 bg-amber-500 text-card"
                        : "border-muted-foreground/40 bg-transparent text-transparent"
                    )}
                  >
                    ✓
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground">{factor.label}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground leading-normal">
                      {factor.description}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono font-semibold text-muted-foreground">
                    +{factor.weight}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Risk Gauge & Evaluation */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-muted/20 p-6 text-center space-y-4">
          <div className="relative h-32 w-32 flex items-center justify-center">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-muted/20"
                strokeWidth="3.2"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <motion.path
                className={cn(
                  "transition-all duration-300",
                  riskScore >= 60 ? "text-destructive" : riskScore >= 30 ? "text-amber-500" : "text-success"
                )}
                strokeDasharray={`${riskScore}, 100`}
                strokeWidth="3.2"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-3xl font-bold tracking-tight text-foreground tabular-nums">
                {riskScore}%
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Ghost Risk
              </span>
            </div>
          </div>

          <div className="text-center space-y-1">
            <p className={cn("text-sm font-semibold", riskLevel.tone)}>
              {riskLevel.label}
            </p>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
              {riskLevel.desc}
            </p>
          </div>

          {/* Benchmark Metrics */}
          <div className="w-full pt-3 border-t border-border/40 grid grid-cols-2 gap-2 text-left text-xs">
            <div className="rounded-lg bg-background/60 p-2 border border-border/40">
              <span className="text-[10px] text-muted-foreground block uppercase font-mono">
                Precision (v2)
              </span>
              <span className="font-mono font-bold text-success">100%</span>
            </div>
            <div className="rounded-lg bg-background/60 p-2 border border-border/40">
              <span className="text-[10px] text-muted-foreground block uppercase font-mono">
                Recall (v2)
              </span>
              <span className="font-mono font-bold text-primary">86.7%</span>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-5 text-center text-xs text-muted-foreground leading-relaxed">
        <ShieldCheck className="mr-1 inline-block h-3.5 w-3.5 text-primary align-text-bottom" />
        Evaluated against our synthetic fixture v2 (30 hand-labeled postings). Development benchmark, not an unverified market guarantee.
      </p>
    </div>
  );
}

export default GhostJobDetectorWidget;
