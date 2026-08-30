import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  FileSearch,
  PenLine,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RhythmStage {
  number: string;
  title: string;
  capability: string;
  description: string;
  impact: string;
  signal: string;
  href: string;
  cta: string;
  icon: LucideIcon;
  tone: string;
  badgeTone: string;
  previewMetrics: { label: string; value: string; desc: string }[];
}

const RHYTHM_STAGES: RhythmStage[] = [
  {
    number: "01",
    title: "Choose intentionally",
    capability: "Smart Job Discovery",
    description:
      "Bring high-signal postings into focus, filter out ghost listings, and compare requirements against your core strengths before applying.",
    impact: "Spend energy only on opportunities you can genuinely pursue.",
    signal: "Relevant roles, verified freshness",
    href: "/jobs",
    cta: "Explore job search",
    icon: FileSearch,
    tone: "border-primary/30 bg-primary/10 text-primary",
    badgeTone: "border-primary/30 bg-primary/10 text-primary",
    previewMetrics: [
      { label: "Stale Postings Filtered", value: "86.7%", desc: "Ghost-job heuristic rejection" },
      { label: "Fit Calibration", value: "Exact", desc: "Maps skills to ATS keywords" },
    ],
  },
  {
    number: "02",
    title: "Prepare with context",
    capability: "Resume & Note Calibration",
    description:
      "Tailor your resume and targeted cover note directly to the role requirements while strictly preserving your authentic facts and voice.",
    impact: "Present tangible evidence of your engineering impact.",
    signal: "Role-specific alignment, zero hallucination",
    href: "/resume",
    cta: "Refine a resume",
    icon: PenLine,
    tone: "border-primary/30 bg-primary/10 text-primary",
    badgeTone: "border-primary/30 bg-primary/10 text-primary",
    previewMetrics: [
      { label: "ATS Scan Clearance", value: ">90%", desc: "Standard parser formatting" },
      { label: "Provenance Check", value: "Pass", desc: "100% facts from user record" },
    ],
  },
  {
    number: "03",
    title: "Decide in the open",
    capability: "Human Approval Gate",
    description:
      "Keep sensitive data, final choices, and submission actions strictly in your hands. Job Tayari prepares the materials; you remain the sole decision maker.",
    impact: "Proceed with confidence instead of delegating to a risky black box.",
    signal: "Explicit candidate authorization",
    href: "/one-shot",
    cta: "See review loop",
    icon: ClipboardCheck,
    tone: "border-success/30 bg-success/10 text-success",
    badgeTone: "border-success/30 bg-success/10 text-success",
    previewMetrics: [
      { label: "Autonomous Submit", value: "Disabled", desc: "Candidate clicks final submit" },
      { label: "Sensitive Data", value: "Encrypted", desc: "Salary & legal fields protected" },
    ],
  },
  {
    number: "04",
    title: "Learn from the record",
    capability: "Tracker & Submission Receipts",
    description:
      "Retain the exact role, customized resume snapshot, answers, and cryptographic ATS confirmation. Every next attempt starts with real context.",
    impact: "Turn job searching into a measurable, compounding discipline.",
    signal: "Verifiable career search ledger",
    href: "/interview",
    cta: "Open the tracker",
    icon: BarChart3,
    tone: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    badgeTone: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    previewMetrics: [
      { label: "Receipt Ledger", value: "SHA-256", desc: "Immutable confirmation proof" },
      { label: "Search Retraceability", value: "100%", desc: "Full history of past variants" },
    ],
  },
];

export function CareerOperatingRhythm() {
  const [selectedStageIdx, setSelectedStageIdx] = useState(0);
  const activeStage = RHYTHM_STAGES[selectedStageIdx];
  const ActiveIcon = activeStage.icon;

  return (
    <section
      className="relative overflow-hidden border-y border-border bg-[#07111F] py-20 text-foreground sm:py-24 lg:py-32"
      aria-labelledby="operating-rhythm-title"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-16rem] top-[12%] h-[30rem] w-[30rem] rounded-full bg-primary/20 blur-[130px]" />
        <div className="absolute bottom-[-16rem] right-[-8rem] h-[32rem] w-[32rem] rounded-full bg-success/10 blur-[150px]" />
        <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(148,163,184,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.18)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_78%_62%_at_48%_44%,black,transparent)]" />
      </div>

      <div className="container relative z-10 mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            The Operating Rhythm
          </div>
          <h2
            id="operating-rhythm-title"
            className="mt-5 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl"
          >
            Capabilities that change your <span className="text-primary">next decision.</span>
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
            Job Tayari connects the work that usually scatters across 40 browser tabs into one continuous, high-agency loop.
          </p>
        </div>

        {/* Interactive Stage Stepper */}
        <div className="mt-12 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 max-w-5xl mx-auto">
          {RHYTHM_STAGES.map((stage, idx) => {
            const isSelected = selectedStageIdx === idx;
            const StepIcon = stage.icon;
            return (
              <button
                key={stage.number}
                type="button"
                onClick={() => setSelectedStageIdx(idx)}
                className={cn(
                  "flex flex-col items-start rounded-xl border p-3.5 text-left transition-all active:scale-[0.98]",
                  isSelected
                    ? "border-primary/50 bg-card shadow-lg ring-1 ring-primary/30"
                    : "border-border/80 bg-secondary/60 hover:bg-card hover:border-border"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-mono text-xs font-bold text-muted-foreground">{stage.number}</span>
                  <StepIcon className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                </div>
                <span className="mt-2 text-xs font-semibold text-foreground truncate w-full">{stage.title}</span>
                <span className="text-[10px] text-muted-foreground truncate w-full">{stage.capability}</span>
              </button>
            );
          })}
        </div>

        {/* Active Stage Detailed Interactive Card */}
        <div className="mt-8 max-w-5xl mx-auto rounded-2xl border border-border/80 bg-secondary/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStage.number}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] items-center"
            >
              {/* Left Details */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl border", activeStage.tone)}>
                    <ActiveIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <Badge variant="outline" className={cn("text-[10px] font-mono", activeStage.badgeTone)}>
                      STAGE {activeStage.number} · {activeStage.capability}
                    </Badge>
                    <h3 className="text-2xl font-bold text-foreground font-display mt-0.5">
                      {activeStage.title}
                    </h3>
                  </div>
                </div>

                <p className="text-base leading-relaxed text-muted-foreground">
                  {activeStage.description}
                </p>

                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    {activeStage.impact}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground pl-6">
                    Signal: <strong className="text-foreground">{activeStage.signal}</strong>
                  </p>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <Button size="lg" asChild className="bg-primary text-muted hover:bg-primary font-semibold active:scale-[0.98]">
                    <Link to={activeStage.href}>
                      {activeStage.cta}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild className="border-border bg-card text-foreground hover:bg-muted">
                    <Link to="/auth?mode=signup">Create Account</Link>
                  </Button>
                </div>
              </div>

              {/* Right Metrics Panel */}
              <div className="rounded-xl border border-border bg-[#09111F] p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <span className="font-mono text-xs font-bold text-muted-foreground uppercase">
                    Execution Metrics
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-success font-mono">
                    <ShieldCheck className="h-3.5 w-3.5" /> Verified
                  </span>
                </div>

                <div className="space-y-3">
                  {activeStage.previewMetrics.map((metric) => (
                    <div key={metric.label} className="rounded-lg border border-border/80 bg-card p-3 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-foreground block">{metric.label}</span>
                        <span className="text-[10px] text-muted-foreground">{metric.desc}</span>
                      </div>
                      <span className="font-mono text-base font-bold text-primary">{metric.value}</span>
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                  Real deterministic heuristics running locally in your workspace.
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

export default CareerOperatingRhythm;
