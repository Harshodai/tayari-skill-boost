import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, ArrowRight, Brain, Briefcase, Globe, Zap } from "lucide-react";
import { features as featureFlags } from "@/config/features";
import { cn } from "@/lib/utils";
import { SlideUp } from "@/components/ui/motion";

/* ── LIVE INTERACTIVE MOCKUPS ───────────────────────────────── */

function ResumeScanMockup() {
  const [score, setScore] = useState(35);
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    const runScan = () => {
      setScanning(true);
      setScore(0);
      let val = 0;
      const countInterval = setInterval(() => {
        val += 2;
        if (val >= 94) {
          val = 94;
          clearInterval(countInterval);
          setScanning(false);
        }
        setScore(val);
      }, 30);
    };

    // Periodic interval
    const interval = setInterval(runScan, 9000);
    runScan();

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-[190px] bg-background/50 border border-border/40 rounded-xl overflow-hidden p-4 flex flex-col justify-between shadow-spotlight">
      {/* Laser line scanner */}
      {scanning && (
        <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-success to-transparent animate-pulse animate-float" style={{
          top: '35%'
        }} />
      )}
      <div className="flex items-center justify-between border-b border-border/30 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-destructive/60" />
          <span className="w-2 h-2 rounded-full bg-warning/60" />
          <span className="w-2 h-2 rounded-full bg-success/60" />
        </div>
        <span className="text-[10px] font-mono text-muted-foreground select-none">ats_resume_v2.pdf</span>
      </div>
      <div className="flex gap-4 flex-1 items-center justify-around">
        {/* Progress Gauge */}
        <div className="relative w-20 h-20 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
            <path className="text-muted/20" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            <path className="text-success transition-all duration-300" strokeDasharray={`${score}, 100`} strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          </svg>
          <div className="absolute text-center select-none">
            <span className="text-xl font-bold font-display">{score}%</span>
            <p className="text-[8px] text-muted-foreground uppercase leading-none mt-0.5">Match</p>
          </div>
        </div>
        {/* Keywords checker list */}
        <div className="text-[11px] space-y-1.5 flex-1 max-w-[160px] select-none">
          <div className="flex items-center gap-1.5">
            <span className={cn("w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] border transition-colors", score >= 30 ? "bg-success/15 border-success/30 text-success" : "border-muted-foreground/30 text-transparent")}>✓</span>
            <span className={score >= 30 ? "text-foreground font-medium" : "text-muted-foreground/60"}>React Hooks</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn("w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] border transition-colors", score >= 60 ? "bg-success/15 border-success/30 text-success" : "border-muted-foreground/30 text-transparent")}>✓</span>
            <span className={score >= 60 ? "text-foreground font-medium" : "text-muted-foreground/60"}>TypeScript Typings</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn("w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] border transition-colors", score >= 85 ? "bg-success/15 border-success/30 text-success" : "border-muted-foreground/30 text-transparent")}>✓</span>
            <span className={score >= 85 ? "text-foreground font-medium" : "text-muted-foreground/60"}>Next.js Routing</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CoachMockup() {
  const [messages, setMessages] = useState<Array<{ sender: "ai" | "user"; text: string }>>([]);

  useEffect(() => {
    const dialog = [
      { sender: "ai" as const, text: "Describe a technical challenge you solved." },
      { sender: "user" as const, text: "I migrated our DB, reducing query times by 40%." },
      { sender: "ai" as const, text: "💡 Great! Focus 60% of your story on the specific database indexing steps." }
    ];

    const runDialog = () => {
      setMessages([]);
      let currentStep = 0;
      
      const timer = setInterval(() => {
        currentStep++;
        if (currentStep <= dialog.length) {
          setMessages(dialog.slice(0, currentStep));
        } else {
          clearInterval(timer);
        }
      }, 2500);
      
      return timer;
    };

    const timer = runDialog();
    const interval = setInterval(runDialog, 11000);

    return () => {
      clearInterval(timer);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="w-full h-[180px] bg-background/50 border border-border/40 rounded-xl p-3 flex flex-col justify-end overflow-hidden text-[11px] shadow-spotlight">
      <div className="space-y-2 flex flex-col justify-end">
        {messages.map((m, i) => (
          <div key={i} className={cn(
            "p-2 rounded-lg max-w-[88%] leading-relaxed animate-fade-in-up",
            m.sender === "ai"
              ? "bg-muted text-foreground border border-border/40 self-start"
              : "bg-primary text-primary-foreground ml-auto self-end"
          )}>
            {m.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function JobMatcherMockup() {
  return (
    <div className="w-full h-[180px] bg-background/50 border border-border/40 rounded-xl p-3 flex flex-col gap-2 overflow-hidden text-xs shadow-spotlight select-none">
      <div className="flex items-center justify-between p-2 bg-card border border-border/40 rounded-lg hover:border-primary/30 transition-all">
        <div>
          <p className="font-semibold">Frontend Engineer</p>
          <p className="text-[10px] text-muted-foreground">Stripe • Remote</p>
        </div>
        <Badge variant="success" className="text-[10px] px-2 py-0">94% Match</Badge>
      </div>
      <div className="flex items-center justify-between p-2 bg-card border border-border/40 rounded-lg hover:border-primary/30 transition-all">
        <div>
          <p className="font-semibold">Staff Developer</p>
          <p className="text-[10px] text-muted-foreground">Vercel • Hybrid</p>
        </div>
        <Badge variant="success" className="text-[10px] px-2 py-0">87% Match</Badge>
      </div>
      <div className="flex items-center justify-between p-2 bg-card border border-border/40 rounded-lg opacity-60">
        <div>
          <p className="font-semibold">Systems Architect</p>
          <p className="text-[10px] text-muted-foreground">Linear • Remote</p>
        </div>
        <Badge variant="warning" className="text-[10px] px-2 py-0">63% Match</Badge>
      </div>
    </div>
  );
}

function ExtensionMockup() {
  return (
    <div className="w-full h-[180px] bg-background/50 border border-border/40 rounded-xl overflow-hidden flex flex-col justify-between text-xs shadow-spotlight select-none">
      <div className="bg-muted/50 border-b border-border/40 px-3 py-1.5 flex items-center gap-1.5 shrink-0">
        <span className="w-2 h-2 rounded-full bg-destructive/60" />
        <span className="w-2 h-2 rounded-full bg-warning/60" />
        <span className="w-2 h-2 rounded-full bg-success/60" />
        <div className="flex-1 bg-background/80 rounded border border-border/30 px-2 py-0.5 text-[9px] text-muted-foreground truncate font-mono">
          linkedin.com/jobs/view/108422
        </div>
      </div>
      <div className="flex-1 p-3 flex items-center justify-center">
        <div className="bg-card border border-primary/25 rounded-lg p-2.5 shadow-lg w-full max-w-[170px] animate-bounce-subtle flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary/10 rounded flex items-center justify-center text-primary font-bold text-[10px]">T</div>
            <div className="min-w-0">
              <p className="font-bold text-[10px] truncate leading-tight">Job Detected!</p>
              <p className="text-[8px] text-muted-foreground truncate leading-none">Senior React Dev</p>
            </div>
          </div>
          <Button size="sm" className="w-full text-[9px] py-1 h-6">Save to Tayari</Button>
        </div>
      </div>
    </div>
  );
}

function AutoPilotMockup() {
  const [activeStep, setActiveStep] = useState(0);
  const steps = [
    "Scanning Job Board",
    "Optimizing Resume",
    "Generating Cover Letter",
    "Submitting Application"
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % (steps.length + 1));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-[180px] bg-background/50 border border-border/40 rounded-xl p-4 flex flex-col justify-around text-xs shadow-spotlight select-none">
      <div className="space-y-2.5">
        {steps.map((label, idx) => {
          const isDone = activeStep > idx;
          const isActive = activeStep === idx;
          return (
            <div key={idx} className="flex items-center gap-2.5">
              <span className={cn(
                "w-4 h-4 rounded-full flex items-center justify-center text-[9px] border transition-all duration-300",
                isDone && "bg-success/15 border-success/30 text-success",
                isActive && "bg-primary/15 border-primary/30 text-primary animate-pulse",
                !isDone && !isActive && "border-muted-foreground/30 text-transparent"
              )}>
                {isDone ? "✓" : isActive ? "⚙" : ""}
              </span>
              <span className={cn(
                "transition-all duration-300 text-[11px]",
                isDone && "text-muted-foreground line-through decoration-muted-foreground/45",
                isActive && "text-foreground font-semibold",
                !isDone && !isActive && "text-muted-foreground/40"
              )}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── BENTO GRID SECTION ─────────────────────────────────────── */

export function FeaturesSection() {
  return (
    <section className="py-20 lg:py-28">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <SlideUp>
            <h2 className="text-section font-bold text-foreground mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-muted-foreground text-lg">
              Our suite of automated AI agents and tools handles every step of your application funnel.
            </p>
          </SlideUp>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {/* Card 1: Resume Optimizer (2-column span) */}
          {featureFlags.resumeOptimizer && (
            <SpotlightCard className="md:col-span-2 bg-card/40 border-input flex flex-col">
              <div className="p-6 md:p-8 flex flex-col md:flex-row gap-6 md:items-center h-full justify-between">
                <div className="flex-1 space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold mb-2">Resume Optimizer</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">
                      AI tailors your skills, highlights, and formatting against target job descriptions in real-time, boosting ATS match rates and keyword density instantly.
                    </p>
                  </div>
                  <Button size="sm" asChild className="group">
                    <Link to="/resume">
                      Optimize Resume
                      <ArrowRight className="w-4 h-4 ml-1.5 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </Button>
                </div>
                <div className="w-full md:w-[280px] shrink-0">
                  <ResumeScanMockup />
                </div>
              </div>
            </SpotlightCard>
          )}

          {/* Card 2: AI Interview Coach (1-column span) */}
          {featureFlags.interviewAI && (
            <SpotlightCard className="bg-card/40 border-input flex flex-col justify-between p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Brain className="w-6 h-6" />
                  </div>
                  <Badge variant="secondary">STAR Prep</Badge>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Interview Coach</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Practice interview scenarios with resume-aware behavioral analysis. Real-time feedback guides you on structure.
                  </p>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                <CoachMockup />
                <Button size="sm" variant="outline" asChild className="w-full">
                  <Link to="/interview/prep">Start practice session</Link>
                </Button>
              </div>
            </SpotlightCard>
          )}

          {/* Card 3: Job Matcher */}
          {featureFlags.jobSearch && (
            <SpotlightCard className="bg-card/40 border-input flex flex-col justify-between p-6">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Smart Job Matcher</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Matches roles based on your skills profile, parsing salaries, remote options, and fit metrics.
                  </p>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                <JobMatcherMockup />
                <Button size="sm" variant="outline" asChild className="w-full">
                  <Link to="/jobs">Find matched jobs</Link>
                </Button>
              </div>
            </SpotlightCard>
          )}

          {/* Card 4: Browser Extension */}
          <SpotlightCard className="bg-card/40 border-input flex flex-col justify-between p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Globe className="w-6 h-6" />
                </div>
                <Badge variant="warning" className="bg-warning/10 text-warning border-warning/20">Soon</Badge>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Browser Extension</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Save jobs from LinkedIn, Indeed, and Greenhouse in a single click. Auto-fill application forms instantly.
                </p>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              <ExtensionMockup />
              <Button size="sm" variant="outline" disabled className="w-full">
                Download extension
              </Button>
            </div>
          </SpotlightCard>

          {/* Card 5: AutoPilot Agent */}
          <SpotlightCard className="bg-card/40 border-input flex flex-col justify-between p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Zap className="w-6 h-6 animate-pulse-slow" />
                </div>
                <Badge variant="success">AutoPilot</Badge>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">AutoPilot Agent</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Let AI agents execute the entire application chain: scan, optimize, generate outreach, and submit.
                </p>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              <AutoPilotMockup />
              <Button size="sm" variant="outline" asChild className="w-full">
                <Link to="/jobs">Launch AutoPilot</Link>
              </Button>
            </div>
          </SpotlightCard>
        </div>
      </div>
    </section>
  );
}
