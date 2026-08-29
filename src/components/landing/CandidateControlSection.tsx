import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  CheckCircle2,
  Eye,
  FileCheck2,
  PauseCircle,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Sparkles,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const WORKFLOW_STEPS = [
  {
    id: "signal",
    label: "01. Signal & Intake",
    short: "Signal",
    description: "Scan target JD for real requirements, eliminating ghost jobs before spending candidate time.",
    icon: Eye,
    tone: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
    detail: "Cross-checks job freshness, hiring manager visibility, and requisition verification.",
  },
  {
    id: "review",
    label: "02. Glass-Box Review",
    short: "Review",
    description: "Prepare resume tailoring & custom cover note without generating fake or unproven credentials.",
    icon: PauseCircle,
    tone: "border-primary/30 bg-primary/10 text-primary",
    detail: "Strict human approval boundary: pauses before sensitive fields (EEO, salary, legal, submission).",
  },
  {
    id: "receipt",
    label: "03. Immutable Receipt",
    short: "Receipt",
    description: "Log ATS confirmation code, timestamped answers, and SHA-256 digest into candidate record.",
    icon: FileCheck2,
    tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    detail: "Audit trail retained in candidate storage; verifiable in your signed-in workspace anytime.",
  },
] as const;

export function CandidateControlSection() {
  const reduceMotion = useReducedMotion();
  const [activeStepIndex, setActiveStepIndex] = useState(1);
  const [viewMode, setViewMode] = useState<"tayari" | "generic">("tayari");

  const activeStep = WORKFLOW_STEPS[activeStepIndex];

  return (
    <section className="relative overflow-hidden border-y border-border bg-slate-950/95 py-20 text-slate-100 sm:py-24 lg:py-32">
      {/* Ambient background glow */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(6,182,212,0.08),transparent_35%),radial-gradient(circle_at_80%_75%,rgba(16,185,129,0.08),transparent_35%)]" />

      <div className="container relative z-10 mx-auto px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          {/* Left Column: Interactive Step Selector */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-cyan-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Human-Controlled Architecture</span>
            </div>

            <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Let AI organize the work. <br />
              <span className="text-cyan-300">Keep the decision with you.</span>
            </h2>

            <p className="mt-5 text-base leading-7 text-slate-300 sm:text-lg">
              Most AI tools promise black-box autopilot—submitting hundreds of generic applications that get ignored or flagged. Job Tayari takes the opposite stance: rigorous preparation with mandatory human review.
            </p>

            {/* Clickable Step Pills */}
            <div className="mt-8 space-y-3">
              {WORKFLOW_STEPS.map((step, idx) => {
                const Icon = step.icon;
                const isSelected = activeStepIndex === idx;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveStepIndex(idx)}
                    className={cn(
                      "w-full flex items-start gap-4 rounded-2xl border p-4 text-left transition-all active:scale-[0.99]",
                      isSelected
                        ? "border-cyan-400/50 bg-slate-900/90 shadow-[0_12px_32px_rgba(2,6,23,0.5)] ring-1 ring-cyan-400/30"
                        : "border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60"
                    )}
                  >
                    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", step.tone)}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">{step.label}</span>
                        {idx === 1 && (
                          <Badge variant="outline" className="border-emerald-400/30 bg-emerald-400/10 text-emerald-300 text-[10px]">
                            Human Gate
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">{step.description}</p>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-cyan-300" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Comparative Interactive Inspector */}
          <div className="relative mx-auto w-full max-w-2xl rounded-2xl border border-slate-800 bg-[#09111E] p-5 shadow-2xl sm:p-7">
            {/* Toggle header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                  Methodology Comparison
                </span>
              </div>

              <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setViewMode("tayari")}
                  className={cn(
                    "rounded-md px-3 py-1 transition-all",
                    viewMode === "tayari"
                      ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-400/30"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  Job Tayari (Deliberate)
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("generic")}
                  className={cn(
                    "rounded-md px-3 py-1 transition-all",
                    viewMode === "generic"
                      ? "bg-destructive/20 text-rose-300 font-bold border border-destructive/30"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  Generic AI Autopilot
                </button>
              </div>
            </div>

            {/* Active Mode Presentation */}
            {viewMode === "tayari" ? (
              <motion.div
                key="tayari-mode"
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="mt-6 space-y-5"
              >
                {/* Active Step Highlight */}
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-cyan-300">
                      ACTIVE PHASE: {activeStep.label.toUpperCase()}
                    </span>
                    <Badge variant="success" className="text-[10px]">
                      Safe & Transparent
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-200 leading-relaxed font-medium">
                    {activeStep.detail}
                  </p>
                </div>

                {/* Scorecards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
                    <span className="text-[10px] uppercase font-mono text-slate-400">Fact Authenticity</span>
                    <p className="mt-1 text-xl font-bold font-mono text-emerald-400">100% Verified</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Strict resume provenance</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
                    <span className="text-[10px] uppercase font-mono text-slate-400">Submission Agency</span>
                    <p className="mt-1 text-xl font-bold font-mono text-cyan-400">Candidate-Owned</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Never clicks submit for you</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
                    <span className="text-[10px] uppercase font-mono text-slate-400">Context Retention</span>
                    <p className="mt-1 text-xl font-bold font-mono text-white">Full History</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">ATS token & answers saved</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
                    <span className="text-[10px] uppercase font-mono text-slate-400">Sensitive Data</span>
                    <p className="mt-1 text-xl font-bold font-mono text-emerald-400">Redacted</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Encrypted at rest</p>
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3.5 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                  <p className="text-xs text-emerald-200">
                    <strong>Result:</strong> Applications are targeted, high-context, and clear the recruiter's first manual screen without spam triggers.
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="generic-mode"
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="mt-6 space-y-5"
              >
                <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-rose-300">
                      BLACK BOX AUTO-SPRAY
                    </span>
                    <Badge variant="destructive" className="text-[10px]">
                      High Account Risk
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-200 leading-relaxed font-medium">
                    Automated scripts spam forms with AI-hallucinated credentials, violating ATS Terms of Service (e.g. LinkedIn §8.2) and risking permanent candidate domain bans.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
                    <span className="text-[10px] uppercase font-mono text-slate-400">Hallucinated Experience</span>
                    <p className="mt-1 text-xl font-bold font-mono text-rose-400">High Risk</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Invents fake projects & metrics</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
                    <span className="text-[10px] uppercase font-mono text-slate-400">Candidate Visibility</span>
                    <p className="mt-1 text-xl font-bold font-mono text-rose-400">Zero</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">No review step before sending</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
                    <span className="text-[10px] uppercase font-mono text-slate-400">ATS Policy Compliance</span>
                    <p className="mt-1 text-xl font-bold font-mono text-rose-400">Violated</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Risks bot detection & block</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
                    <span className="text-[10px] uppercase font-mono text-slate-400">Interview Conversion</span>
                    <p className="mt-1 text-xl font-bold font-mono text-slate-500">&lt; 1%</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Filtered by generic template filters</p>
                  </div>
                </div>

                <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3.5 flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
                  <p className="text-xs text-rose-200">
                    <strong>Warning:</strong> Mass auto-submitting uncalibrated materials degrades candidate reputation across ATS networks.
                  </p>
                </div>
              </motion.div>
            )}

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Audit verified architecture</span>
              <span className="font-mono text-[11px] text-cyan-300">Server-enforced human handoff</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default CandidateControlSection;
