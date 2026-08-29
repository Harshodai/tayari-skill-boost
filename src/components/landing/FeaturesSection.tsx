import { useState } from "react";
import { Link } from "react-router-dom";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, ArrowRight, Brain, Briefcase, Globe, Zap, Sparkles } from "lucide-react";
import { features as featureFlags } from "@/config/features";
import { cn } from "@/lib/utils";
import { SlideUp } from "@/components/ui/motion";

/* ── INTERACTIVE MOCKUPS ───────────────────────────────── */

function InteractiveResumeScanMockup() {
  const [score, setScore] = useState(94);
  const [activeKeyword, setActiveKeyword] = useState<string>("React 19 Hooks");

  const keywords = [
    { name: "React 19 Hooks", weight: 94 },
    { name: "TypeScript Strict", weight: 91 },
    { name: "Distributed Cache", weight: 88 },
  ];

  return (
    <div className="relative w-full h-[200px] bg-background/60 border border-border/50 rounded-xl overflow-hidden p-4 flex flex-col justify-between shadow-spotlight backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-border/30 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-destructive/60" />
          <span className="w-2 h-2 rounded-full bg-warning/60" />
          <span className="w-2 h-2 rounded-full bg-success/60" />
        </div>
        <span className="text-[10px] font-mono text-muted-foreground select-none">
          senior_engineer_ats_v3.pdf
        </span>
      </div>

      <div className="flex gap-4 flex-1 items-center justify-around">
        {/* Radial Gauge */}
        <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-muted/20"
              strokeWidth="3.2"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className="text-emerald-500 transition-all duration-500"
              strokeDasharray={`${score}, 100`}
              strokeWidth="3.2"
              strokeLinecap="round"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <div className="absolute text-center select-none">
            <span className="text-xl font-bold font-mono tabular-nums text-foreground">{score}%</span>
            <p className="text-[8px] text-muted-foreground uppercase leading-none mt-0.5">Match</p>
          </div>
        </div>

        {/* Interactive Keywords selector */}
        <div className="text-[11px] space-y-1.5 flex-1 max-w-[170px] select-none">
          {keywords.map((kw) => (
            <button
              key={kw.name}
              type="button"
              onClick={() => {
                setActiveKeyword(kw.name);
                setScore(kw.weight);
              }}
              className={cn(
                "w-full flex items-center justify-between p-1.5 rounded-lg border text-left transition-all active:scale-[0.98]",
                activeKeyword === kw.name
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500 font-semibold"
                  : "border-border/40 bg-background/40 text-muted-foreground hover:bg-muted"
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-500 font-bold">✓</span>
                <span className="truncate">{kw.name}</span>
              </div>
              <span className="font-mono text-[9px] opacity-70">{kw.weight}%</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function InteractiveCoachMockup() {
  const [activeTopic, setActiveTopic] = useState<"system" | "behavioral" | "incident">("incident");

  const dialogs = {
    incident: {
      q: "How did you manage a critical database degradation?",
      a: "Identified read-lock contention, diverted traffic to read-replicas, and deployed query caching.",
      tip: "💡 Emphasize the 45ms latency reduction and post-incident runbook creation.",
    },
    system: {
      q: "How would you design a high-throughput event ingestion pipeline?",
      a: "Partitioned Kafka topics with idempotent consumers and Redis deduplication buffers.",
      tip: "💡 Highlight backpressure handling and end-to-end telemetry instrumentation.",
    },
    behavioral: {
      q: "Tell me about a disagreement with an engineering lead.",
      a: "Created a side-by-side benchmark prototype to compare memory profiles objectively.",
      tip: "💡 Focus on how data-driven prototypes defused tension and aligned the roadmap.",
    },
  };

  const currentDialog = dialogs[activeTopic];

  return (
    <div className="w-full h-[200px] bg-background/60 border border-border/50 rounded-xl p-3 flex flex-col justify-between overflow-hidden text-[11px] shadow-spotlight backdrop-blur-sm">
      {/* Interactive Topics */}
      <div className="flex gap-1 border-b border-border/30 pb-2">
        <button
          type="button"
          onClick={() => setActiveTopic("incident")}
          className={cn(
            "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
            activeTopic === "incident" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-muted"
          )}
        >
          Incident
        </button>
        <button
          type="button"
          onClick={() => setActiveTopic("system")}
          className={cn(
            "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
            activeTopic === "system" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-muted"
          )}
        >
          Architecture
        </button>
        <button
          type="button"
          onClick={() => setActiveTopic("behavioral")}
          className={cn(
            "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
            activeTopic === "behavioral" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-muted"
          )}
        >
          Behavioral
        </button>
      </div>

      <div className="space-y-1.5 my-1">
        <div className="p-2 rounded-lg bg-muted text-foreground border border-border/40 max-w-[92%]">
          <p className="font-semibold text-primary text-[10px]">Interviewer:</p>
          {currentDialog.q}
        </div>
        <div className="p-2 rounded-lg bg-emerald-500/10 text-foreground border border-emerald-500/20 max-w-[92%] ml-auto">
          <p className="font-semibold text-emerald-500 text-[10px]">{currentDialog.tip}</p>
        </div>
      </div>
    </div>
  );
}

function InteractiveJobMatcherMockup() {
  const [filter, setFilter] = useState<"all" | "staff" | "systems">("all");

  const jobs = [
    { title: "Staff Frontend Engineer", company: "Stripe", type: "staff", match: 94, tags: "Remote • TypeScript" },
    { title: "Distributed Systems Lead", company: "Cloudflare", type: "systems", match: 91, tags: "Hybrid • Rust/Go" },
    { title: "AI Infrastructure Specialist", company: "Linear", type: "staff", match: 88, tags: "Remote • Python/vLLM" },
  ];

  const filteredJobs = jobs.filter((j) => filter === "all" || j.type === filter);

  return (
    <div className="w-full h-[200px] bg-background/60 border border-border/50 rounded-xl p-3 flex flex-col justify-between overflow-hidden text-xs shadow-spotlight backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-border/30 pb-2">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
              filter === "all" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-muted"
            )}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter("staff")}
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
              filter === "staff" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-muted"
            )}
          >
            Staff
          </button>
          <button
            type="button"
            onClick={() => setFilter("systems")}
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
              filter === "systems" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-muted"
            )}
          >
            Systems
          </button>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">{filteredJobs.length} active</span>
      </div>

      <div className="space-y-1.5 overflow-y-auto">
        {filteredJobs.map((job) => (
          <div
            key={job.title}
            className="flex items-center justify-between p-2 bg-card border border-border/40 rounded-lg hover:border-primary/30 transition-all cursor-pointer"
          >
            <div>
              <p className="font-semibold text-foreground text-[11px] leading-tight">{job.title}</p>
              <p className="text-[10px] text-muted-foreground">{job.company} · {job.tags}</p>
            </div>
            <Badge variant="success" className="text-[10px] font-mono tabular-nums px-2 py-0">
              {job.match}%
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function InteractiveExtensionMockup() {
  const [saved, setSaved] = useState(false);

  return (
    <div className="w-full h-[200px] bg-background/60 border border-border/50 rounded-xl overflow-hidden flex flex-col justify-between text-xs shadow-spotlight backdrop-blur-sm select-none">
      <div className="bg-muted/50 border-b border-border/40 px-3 py-1.5 flex items-center gap-1.5 shrink-0">
        <span className="w-2 h-2 rounded-full bg-destructive/60" />
        <span className="w-2 h-2 rounded-full bg-warning/60" />
        <span className="w-2 h-2 rounded-full bg-success/60" />
        <div className="flex-1 bg-background/80 rounded border border-border/30 px-2 py-0.5 text-[9px] text-muted-foreground truncate font-mono">
          linkedin.com/jobs/view/9284102
        </div>
      </div>
      <div className="flex-1 p-3 flex items-center justify-center">
        <div className="bg-card border border-primary/25 rounded-xl p-3 shadow-lg w-full max-w-[210px] flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-xs">
              T
            </div>
            <div className="min-w-0">
              <p className="font-bold text-xs text-foreground truncate">Staff Role Detected</p>
              <p className="text-[9px] text-muted-foreground truncate">Stripe · Remote</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setSaved(!saved)}
            className={cn(
              "w-full text-[10px] py-1 h-7 font-semibold transition-all active:scale-[0.98]",
              saved ? "bg-emerald-600 text-white hover:bg-emerald-500" : ""
            )}
          >
            {saved ? (
              <>
                <span className="mr-1">✓</span> Saved to Workspace
              </>
            ) : (
              "Save to Job Tayari"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function InteractiveAutoPilotMockup() {
  const [activeStep, setActiveStep] = useState(2);
  const steps = [
    "Scanning Job Board",
    "Optimizing Resume",
    "Generating Cover Letter",
    "Preparing Submission for Review",
  ];

  return (
    <div className="w-full h-[200px] bg-background/60 border border-border/50 rounded-xl p-4 flex flex-col justify-between text-xs shadow-spotlight backdrop-blur-sm select-none">
      <div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground/80 font-mono">
        Illustrative workflow · no application submitted
      </div>

      <div className="space-y-1.5 my-1">
        {steps.map((label, idx) => {
          const isDone = activeStep > idx;
          const isActive = activeStep === idx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveStep(idx)}
              className={cn(
                "w-full flex items-center gap-2.5 p-1.5 rounded-lg text-left transition-colors",
                isActive ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/40"
              )}
            >
              <span
                className={cn(
                  "w-4 h-4 rounded-full flex items-center justify-center text-[9px] border transition-all duration-300",
                  isDone && "bg-emerald-500/20 border-emerald-500/40 text-emerald-500",
                  isActive && "bg-primary/20 border-primary/40 text-primary font-bold",
                  !isDone && !isActive && "border-muted-foreground/30 text-transparent"
                )}
              >
                {isDone ? "✓" : isActive ? "⚙" : ""}
              </span>
              <span
                className={cn(
                  "text-[11px] font-medium",
                  isDone && "text-muted-foreground line-through opacity-70",
                  isActive && "text-foreground font-semibold",
                  !isDone && !isActive && "text-muted-foreground/50"
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── BENTO GRID SECTION ─────────────────────────────────────── */

export function FeaturesSection() {
  return (
    <section className="py-20 lg:py-28 border-t border-border/40">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <SlideUp>
            <h2 className="text-section font-bold text-foreground mb-4 font-display text-balance tracking-tight text-3xl sm:text-4xl lg:text-5xl">
              The tools behind better next decisions
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg text-balance">
              Each workspace does a distinct job in your career-search rhythm: make the work clearer, reduce repeat effort, and leave the meaningful call with you.
            </p>
          </SlideUp>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {/* Card 1: Resume Optimizer (2-column span) */}
          {featureFlags.resumeOptimizer && (
            <SpotlightCard className="md:col-span-2 bg-card/60 border-border/60 flex flex-col backdrop-blur-md">
              <div className="p-6 md:p-8 flex flex-col md:flex-row gap-6 md:items-center h-full justify-between">
                <div className="flex-1 space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold mb-2 font-display text-foreground">
                      ATS Resume Optimizer
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">
                      Compare your resume against target roles, surface gaps worth checking, and refine the details before you decide what represents your experience.
                    </p>
                  </div>
                  <Button size="sm" asChild className="group font-semibold active:scale-[0.98]">
                    <Link to="/resume">
                      Review my resume
                      <ArrowRight className="w-4 h-4 ml-1.5 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </Button>
                </div>
                <div className="w-full md:w-[290px] shrink-0">
                  <InteractiveResumeScanMockup />
                </div>
              </div>
            </SpotlightCard>
          )}

          {/* Card 2: AI Interview Coach (1-column span) */}
          <SpotlightCard className="bg-card/60 border-border/60 flex flex-col justify-between p-6 backdrop-blur-md">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <Brain className="w-6 h-6" />
                </div>
                <Badge variant="secondary" className="font-mono text-xs">STAR Prep</Badge>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2 font-display text-foreground">Interview Coach</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Practice structured behavioral and system architecture answers with real-time feedback on impact quantification.
                </p>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              <InteractiveCoachMockup />
              <Button size="sm" variant="outline" asChild className="w-full font-semibold active:scale-[0.98]">
                <Link to="/interview/prep">Start practice session</Link>
              </Button>
            </div>
          </SpotlightCard>

          {/* Card 3: Smart Job Matcher */}
          {featureFlags.jobSearch && (
            <SpotlightCard className="bg-card/60 border-border/60 flex flex-col justify-between p-6 backdrop-blur-md">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2 font-display text-foreground">Smart Job Matcher</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Aggregate real postings across Greenhouse, Lever, Workday, and Ashby while filtering ghost listings automatically.
                  </p>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                <InteractiveJobMatcherMockup />
                <Button size="sm" variant="outline" asChild className="w-full font-semibold active:scale-[0.98]">
                  <Link to="/jobs">Find matched jobs</Link>
                </Button>
              </div>
            </SpotlightCard>
          )}

          {/* Card 4: Browser Extension */}
          <SpotlightCard className="bg-card/60 border-border/60 flex flex-col justify-between p-6 backdrop-blur-md">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <Globe className="w-6 h-6" />
                </div>
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 text-xs">Installed</Badge>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2 font-display text-foreground">Browser Extension</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Capture roles on LinkedIn, Indeed, and company job boards with one click, preserving full JD context in your private workspace.
                </p>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              <InteractiveExtensionMockup />
              <Button size="sm" variant="outline" asChild className="w-full font-semibold active:scale-[0.98]">
                <Link to="/settings">Open extension options</Link>
              </Button>
            </div>
          </SpotlightCard>

          {/* Card 5: AutoPilot */}
          <SpotlightCard className="bg-card/60 border-border/60 flex flex-col justify-between p-6 backdrop-blur-md">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <Badge variant="success" className="text-xs">Human Gate</Badge>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2 font-display text-foreground">AutoPilot</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Let assistance organise the preparation work—scan, optimise, and draft—while preserving a review step before an important action.
                </p>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              <InteractiveAutoPilotMockup />
              <Button size="sm" variant="outline" asChild className="w-full font-semibold active:scale-[0.98]">
                <Link to="/jobs/autopilot">Explore the preparation flow</Link>
              </Button>
            </div>
          </SpotlightCard>
        </div>
      </div>
    </section>
  );
}

export default FeaturesSection;
