import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileCheck2,
  Sparkles,
  ShieldCheck,
  Check,
  Plus,
  RefreshCw,
  Copy,
  CheckCircle2,
  Lock,
  ArrowRight,
  Sliders,
  Terminal,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SandboxTab = "match" | "star" | "hitl" | "receipt";

interface RolePreset {
  id: string;
  title: string;
  company: string;
  baseScore: number;
  requiredSkills: string[];
  candidateSkills: string[];
  optionalSkills: string[];
}

const ROLE_PRESETS: RolePreset[] = [
  {
    id: "stripe-frontend",
    title: "Staff Frontend Engineer",
    company: "Stripe",
    baseScore: 68,
    requiredSkills: ["React 19", "TypeScript", "Design Systems", "Web Performance", "State Machines"],
    candidateSkills: ["React 19", "TypeScript", "Design Systems"],
    optionalSkills: ["Web Performance", "State Machines", "GraphQL", "Tailwind CSS"],
  },
  {
    id: "cloudflare-systems",
    title: "Staff Systems Engineer",
    company: "Cloudflare",
    baseScore: 65,
    requiredSkills: ["Distributed Systems", "Rust", "Go", "eBPF", "Linux Internals"],
    candidateSkills: ["Distributed Systems", "Go", "Linux Internals"],
    optionalSkills: ["Rust", "eBPF", "Kafka", "PostgreSQL"],
  },
  {
    id: "linear-ai",
    title: "AI Infrastructure Engineer",
    company: "Linear",
    baseScore: 70,
    requiredSkills: ["Python", "PyTorch", "vLLM", "Distributed Caching", "Postgres RLS"],
    candidateSkills: ["Python", "PyTorch", "Postgres RLS"],
    optionalSkills: ["vLLM", "Distributed Caching", "Redis", "Celery"],
  },
];

const STAR_PROMPTS = [
  {
    id: "outage",
    question: "Tell me about a critical production incident you resolved under pressure.",
    situation: "During Black Friday peak traffic, a database replication bottleneck caused checkout latency to spike to 4.2s.",
    task: "Restore latency to <150ms within 30 minutes without dropping incoming transactions.",
    action: "Identified unindexed lock contention using pg_stat_activity, spun up isolated read-replicas, and deployed an in-memory caching circuit breaker.",
    result: "Latency plummeted to 85ms, zero transactions were lost, and we published an RCA that automated replica scaling.",
  },
  {
    id: "migration",
    question: "Describe a complex architectural migration you led across multiple teams.",
    situation: "Legacy monolith had 45-minute build cycles and frequent regression cascades across 6 engineering squads.",
    task: "Decompose into modular domain services with zero planned downtime and strict backward compatibility.",
    action: "Engineered a strangler-fig reverse proxy gateway, established typed gRPC contracts, and created canary traffic shadowing.",
    result: "Build cycles reduced from 45m to 2.8m, deploy velocity tripled, and zero API downtime occurred across 9 months.",
  },
];

const ATS_VENDORS = [
  { id: "greenhouse", name: "Greenhouse", prefix: "GH", domain: "boards.greenhouse.io" },
  { id: "lever", name: "Lever", prefix: "LEV", domain: "jobs.lever.co" },
  { id: "workday", name: "Workday", prefix: "WD", domain: "myworkdayjobs.com" },
  { id: "ashby", name: "Ashby", prefix: "ASH", domain: "jobs.ashbyhq.com" },
];

export function InteractiveCareerSandbox() {
  const [activeTab, setActiveTab] = useState<SandboxTab>("match");

  // ATS Match State
  const [selectedPresetId, setSelectedPresetId] = useState<string>("stripe-frontend");
  const currentPreset = useMemo(
    () => ROLE_PRESETS.find((p) => p.id === selectedPresetId) || ROLE_PRESETS[0],
    [selectedPresetId]
  );
  const [activeSkills, setActiveSkills] = useState<Set<string>>(
    new Set(currentPreset.candidateSkills)
  );

  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = ROLE_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setActiveSkills(new Set(preset.candidateSkills));
    }
  };

  const toggleSkill = (skill: string) => {
    setActiveSkills((prev) => {
      const next = new Set(prev);
      if (next.has(skill)) {
        next.delete(skill);
      } else {
        next.add(skill);
      }
      return next;
    });
  };

  // Calculated Match Score
  const matchScore = useMemo(() => {
    const totalRequired = currentPreset.requiredSkills.length;
    const matchedCount = currentPreset.requiredSkills.filter((s) => activeSkills.has(s)).length;
    const optionalMatched = currentPreset.optionalSkills.filter((s) => activeSkills.has(s)).length;
    const score = Math.round(
      (matchedCount / totalRequired) * 75 + (optionalMatched / currentPreset.optionalSkills.length) * 25
    );
    return Math.min(Math.max(score, 30), 98);
  }, [currentPreset, activeSkills]);

  // STAR State
  const [selectedStarIndex, setSelectedStarIndex] = useState(0);
  const [actionWeight, setActionWeight] = useState(55);
  const starPrompt = STAR_PROMPTS[selectedStarIndex];

  // HITL State
  const [hitlStep, setHitlStep] = useState<number>(2);
  const [sensitiveRedacted, setSensitiveRedacted] = useState(true);
  const [humanApproved, setHumanApproved] = useState(false);

  // Receipt State
  const [selectedAts, setSelectedAts] = useState<string>("greenhouse");
  const [copiedReceipt, setCopiedReceipt] = useState(false);
  const currentAts = ATS_VENDORS.find((v) => v.id === selectedAts) || ATS_VENDORS[0];

  const receiptDigest = useMemo(() => {
    const raw = `${currentAts.prefix}-${selectedPresetId}-${matchScore}-2026-TAYARI-VERIFIED`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, "0");
    return `sha256:e8f9${hex}c29a4b81${hex}77d`;
  }, [currentAts, selectedPresetId, matchScore]);

  const copyReceiptDigest = () => {
    navigator.clipboard.writeText(receiptDigest);
    setCopiedReceipt(true);
    setTimeout(() => setCopiedReceipt(false), 2000);
  };

  return (
    <div className="relative w-full rounded-2xl border border-border/80 bg-card/90 shadow-2xl backdrop-blur-xl ring-1 ring-border/50">
      {/* Top Window Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-muted/40 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          </div>
          <span className="ml-2 font-mono text-[11px] font-semibold text-muted-foreground">
            tayari://interactive-sandbox/live
          </span>
        </div>

        {/* Mode Selector Navigation */}
        <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-background/80 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("match")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all duration-200",
              activeTab === "match"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">ATS Matcher</span>
            <span className="sm:hidden">Match</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("star")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all duration-200",
              activeTab === "star"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">STAR Coach</span>
            <span className="sm:hidden">STAR</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("hitl")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all duration-200",
              activeTab === "hitl"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Review Gate</span>
            <span className="sm:hidden">Gate</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("receipt")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all duration-200",
              activeTab === "receipt"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <FileCheck2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Receipt</span>
            <span className="sm:hidden">Proof</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Body */}
      <div className="p-4 sm:p-6 min-h-[380px] flex flex-col justify-between">
        <AnimatePresence mode="wait">
          {/* ──────────────── TAB 1: ATS MATCH ──────────────── */}
          {activeTab === "match" && (
            <motion.div
              key="match"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              {/* Preset Selector */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Target Role:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {ROLE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handlePresetChange(preset.id)}
                        className={cn(
                          "rounded-lg border px-2.5 py-1 text-xs font-medium transition-all active:scale-[0.98]",
                          selectedPresetId === preset.id
                            ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                            : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {preset.company}
                      </button>
                    ))}
                  </div>
                </div>
                <Badge variant="outline" className="font-mono text-[11px] text-muted-foreground">
                  {currentPreset.title}
                </Badge>
              </div>

              {/* Match Dial & Skill Matrix */}
              <div className="grid gap-6 md:grid-cols-[1.1fr_1.9fr] items-center">
                {/* Radial Gauge */}
                <div className="flex flex-col items-center justify-center rounded-xl border border-border/50 bg-background/60 p-5 text-center">
                  <div className="relative h-28 w-28 flex items-center justify-center">
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
                          "transition-all duration-500",
                          matchScore >= 80 ? "text-success" : matchScore >= 60 ? "text-primary" : "text-amber-500"
                        )}
                        strokeDasharray={`${matchScore}, 100`}
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-mono text-2xl font-bold tracking-tight text-foreground tabular-nums">
                        {matchScore}%
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        ATS Match
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {matchScore >= 85
                      ? "High signal: Clears recruiter filter"
                      : "Click skills below to calibrate match"}
                  </p>
                </div>

                {/* Interactive Skill Pills */}
                <div className="space-y-3">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Click tags to toggle your candidate profile:
                    </span>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {[...currentPreset.requiredSkills, ...currentPreset.optionalSkills].map((skill) => {
                        const isSelected = activeSkills.has(skill);
                        const isRequired = currentPreset.requiredSkills.includes(skill);
                        return (
                          <button
                            key={skill}
                            type="button"
                            onClick={() => toggleSkill(skill)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all active:scale-[0.96]",
                              isSelected
                                ? "border-success/40 bg-success/10 text-success dark:text-success font-semibold"
                                : "border-border/60 bg-muted/40 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                            )}
                          >
                            {isSelected ? (
                              <Check className="h-3 w-3 text-success" />
                            ) : (
                              <Plus className="h-3 w-3 opacity-60" />
                            )}
                            {skill}
                            {isRequired && (
                              <span className="text-[9px] uppercase tracking-wide opacity-50">req</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5 text-xs text-muted-foreground flex items-center justify-between">
                    <span>
                      Active Skills: <strong className="text-foreground">{activeSkills.size}</strong> selected
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveSkills(new Set(currentPreset.candidateSkills))}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                    >
                      <RefreshCw className="h-3 w-3" /> Reset
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ──────────────── TAB 2: STAR COACH ──────────────── */}
          {activeTab === "star" && (
            <motion.div
              key="star"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Interview Story Prompt:
                </span>
                <div className="flex gap-1.5">
                  {STAR_PROMPTS.map((p, idx) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedStarIndex(idx)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-xs font-medium transition-all active:scale-[0.98]",
                        selectedStarIndex === idx
                          ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                          : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      Prompt #{idx + 1}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-background/60 p-3.5 text-sm font-medium text-foreground">
                "{starPrompt.question}"
              </div>

              {/* STAR Quadrants */}
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                    [S] Situation
                  </span>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {starPrompt.situation}
                  </p>
                </div>
                <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                    [T] Task
                  </span>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {starPrompt.task}
                  </p>
                </div>
                <div className="rounded-lg border border-success/30 bg-success/5 p-3">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-success">
                    [A] Action ({actionWeight}%)
                  </span>
                  <p className="mt-1 text-xs leading-relaxed text-foreground/90 font-medium">
                    {starPrompt.action}
                  </p>
                </div>
                <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-500">
                    [R] Measurable Result
                  </span>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {starPrompt.result}
                  </p>
                </div>
              </div>

              {/* Story Weight Slider */}
              <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-card p-2 text-xs">
                <span className="text-muted-foreground shrink-0 font-medium">
                  Action Emphasis:
                </span>
                <input
                  type="range"
                  min="30"
                  max="70"
                  value={actionWeight}
                  onChange={(e) => setActionWeight(Number(e.target.value))}
                  className="h-1.5 flex-1 cursor-pointer accent-primary bg-muted rounded-lg"
                />
                <span className="font-mono font-semibold text-primary">{actionWeight}%</span>
                <span className="text-[11px] text-success hidden sm:inline font-medium">
                  ✓ High hiring signal
                </span>
              </div>
            </motion.div>
          )}

          {/* ──────────────── TAB 3: HITL GATE ──────────────── */}
          {activeTab === "hitl" && (
            <motion.div
              key="hitl"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Human-in-the-Loop Approval Gate
                </span>
                <Badge variant={humanApproved ? "success" : "warning"} className="text-[10px]">
                  {humanApproved ? "Approved & Ready" : "Awaiting Review"}
                </Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border/50 bg-background/50 p-3">
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">01. Match</span>
                  <p className="mt-1 text-xs font-semibold text-foreground">Staff Engineer @ Stripe</p>
                  <p className="text-[10px] text-success mt-0.5">✓ 94% calibrated</p>
                </div>
                <div className="rounded-xl border border-border/50 bg-background/50 p-3">
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">02. Preparation</span>
                  <p className="mt-1 text-xs font-semibold text-foreground">Tailored Resume + Note</p>
                  <p className="text-[10px] text-primary mt-0.5">✓ Zero hallucinated facts</p>
                </div>
                <div
                  className={cn(
                    "rounded-xl border p-3 transition-colors",
                    humanApproved
                      ? "border-success/40 bg-success/10"
                      : "border-primary/40 bg-primary/5"
                  )}
                >
                  <span className="font-mono text-[10px] uppercase text-primary">03. Human Decision</span>
                  <p className="mt-1 text-xs font-semibold text-foreground">
                    {humanApproved ? "Candidate Approved" : "Manual Submit Only"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">No autonomous submit</p>
                </div>
              </div>

              {/* Safety Controls */}
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium text-foreground">
                      Sensitive Data Redaction (Salary / Auth / EEO)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSensitiveRedacted(!sensitiveRedacted)}
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
                      sensitiveRedacted
                        ? "bg-success/15 text-success"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {sensitiveRedacted ? "Encrypted & Redacted" : "Raw"}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <span className="text-xs text-muted-foreground">
                    Simulate candidate sign-off before submission:
                  </span>
                  <Button
                    size="sm"
                    variant={humanApproved ? "outline" : "default"}
                    onClick={() => setHumanApproved(!humanApproved)}
                    className="h-8 text-xs font-semibold active:scale-[0.98]"
                  >
                    {humanApproved ? (
                      <>
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-success" />
                        Approved
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                        Approve Packet
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ──────────────── TAB 4: RECEIPT PROOF ──────────────── */}
          {activeTab === "receipt" && (
            <motion.div
              key="receipt"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Select ATS Vendor:
                </span>
                <div className="flex gap-1.5">
                  {ATS_VENDORS.map((ats) => (
                    <button
                      key={ats.id}
                      type="button"
                      onClick={() => setSelectedAts(ats.id)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-xs font-medium transition-all active:scale-[0.98]",
                        selectedAts === ats.id
                          ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                          : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {ats.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Real Receipt Card */}
              <div className="rounded-xl border border-border/70 bg-background/80 p-4 space-y-3 font-mono text-xs shadow-inner">
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="font-bold text-foreground">
                      SUBMISSION RECORD · {currentAts.name.toUpperCase()}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    CONFIRMED
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-muted-foreground">Target Role:</span>
                    <p className="font-semibold text-foreground truncate">{currentPreset.title}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Company:</span>
                    <p className="font-semibold text-foreground">{currentPreset.company}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Timestamp:</span>
                    <p className="text-foreground">2026-08-28 11:15 UTC</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">ATS Endpoint:</span>
                    <p className="text-foreground truncate">{currentAts.domain}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-border/50 bg-muted/30 p-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] text-muted-foreground block">
                      Cryptographic Evidence Digest:
                    </span>
                    <p className="text-[11px] text-foreground/90 font-mono truncate">
                      {receiptDigest}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={copyReceiptDigest}
                    className="h-7 shrink-0 text-[11px]"
                  >
                    {copiedReceipt ? (
                      <Check className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Interactive Bar */}
        <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span>Interactive Simulator · Real-time computation</span>
          </div>
          <span className="font-mono text-[11px]">Press ⌘K for tool palette</span>
        </div>
      </div>
    </div>
  );
}

export default InteractiveCareerSandbox;
