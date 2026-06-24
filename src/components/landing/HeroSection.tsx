import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, FileText, CheckCircle2, TrendingUp } from "lucide-react";
import { CountUp } from "@/components/ui/count-up";
import { useState } from "react";

const ROLES = [
  {
    company: "Stripe",
    role: "Senior Frontend Engineer",
    score: "94",
    keywords: "47",
    keywordsSuffix: "/50",
    applied: "128",
    hint: "3 missing — added inline",
    keywordsHint: "Ready for submission",
    appliedHint: "32 active conversations",
    url: "stripe",
  },
  {
    company: "Vercel",
    role: "Staff Backend Engineer",
    score: "87",
    keywords: "41",
    keywordsSuffix: "/50",
    applied: "184",
    hint: "9 missing — auto-adjusted",
    keywordsHint: "Ready for submission",
    appliedHint: "45 active conversations",
    url: "vercel",
  },
  {
    company: "Figma",
    role: "Staff Product Designer",
    score: "96",
    keywords: "49",
    keywordsSuffix: "/50",
    applied: "96",
    hint: "1 missing — perfect match",
    keywordsHint: "Ready for submission",
    appliedHint: "18 active conversations",
    url: "figma",
  },
];

export function HeroSection() {
  const [selectedRoleIdx, setSelectedRoleIdx] = useState(0);
  const currentRole = ROLES[selectedRoleIdx];

  return (
    <section className="relative pt-24 pb-20 lg:pt-32 lg:pb-28 overflow-hidden bg-mesh">
      {/* Decorative grid */}
      <div className="absolute inset-0 bg-grid opacity-60 pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border/60 bg-card/40 backdrop-blur-sm text-sm font-medium text-muted-foreground mb-8 animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Now with Hermes AI Agent</span>
          </div>

          {/* Headline — Apple/Stripe scale */}
          <h1 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-bold text-foreground mb-8 tracking-tight leading-[1.02] animate-fade-in-up">
            The career platform
            <br />
            <span className="text-gradient">built for outcomes.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up animation-delay-200">
            Optimize your resume against any job description, prep with an AI interview coach,
            and let agents handle the application grind — all in one workspace.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12 animate-fade-in-up animation-delay-300">
            <Button size="xl" variant="glow" asChild className="min-w-[200px] shadow-glow">
              <Link to="/auth?mode=signup">
                Start free
                <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button size="lg" variant="ghost" asChild className="text-foreground/80 hover:text-foreground">
              <Link to="/resume">
                Try Resume Optimizer →
              </Link>
            </Button>
          </div>

          {/* Role selector tabs */}
          <div className="flex justify-center gap-2.5 mb-6 animate-fade-in-up animation-delay-400">
            {ROLES.map((role, idx) => (
              <button
                key={role.company}
                onClick={() => setSelectedRoleIdx(idx)}
                className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all duration-300 ${
                  selectedRoleIdx === idx
                    ? "bg-primary text-primary-foreground border-primary shadow-glow scale-105"
                    : "glass hover:bg-muted/80 text-muted-foreground border-border/60"
                }`}
              >
                {role.company}
              </button>
            ))}
          </div>

          {/* Product preview card — Stripe-style floating mock */}
          <div className="relative max-w-4xl mx-auto animate-fade-in-up animation-delay-500">
            <div className="absolute -inset-x-8 -inset-y-4 bg-gradient-to-r from-primary/20 via-accent/10 to-secondary/20 blur-3xl opacity-50 pointer-events-none" />
            <div className="relative rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-2xl overflow-hidden">
              {/* Mock browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-muted/30">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-destructive/60" />
                  <span className="w-3 h-3 rounded-full bg-warning/60" />
                  <span className="w-3 h-3 rounded-full bg-success/60" />
                </div>
                <div className="flex-1 mx-4 px-3 py-1 rounded-md bg-background/60 border border-border/40 text-xs text-muted-foreground text-center font-mono truncate transition-all">
                  tayari.app / resume / {currentRole.url}
                </div>
              </div>
              {/* Mock content */}
              <div key={selectedRoleIdx} className="grid md:grid-cols-3 gap-4 p-6 text-left animate-fade-in">
                <MockTile
                  icon={<FileText className="w-4 h-4" />}
                  label="Match Score"
                  value={currentRole.score}
                  suffix="%"
                  hint={`vs. ${currentRole.role}`}
                  accent="text-success"
                />
                <MockTile
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  label="ATS Keywords"
                  value={currentRole.keywords}
                  suffix={currentRole.keywordsSuffix}
                  hint={currentRole.hint}
                  accent="text-primary"
                />
                <MockTile
                  icon={<TrendingUp className="w-4 h-4" />}
                  label="Roles Applied"
                  value={currentRole.applied}
                  suffix=""
                  hint={currentRole.appliedHint}
                  accent="text-accent"
                />
              </div>
            </div>
          </div>

          {/* Stat strip */}
          <div className="grid grid-cols-3 gap-8 mt-20 max-w-3xl mx-auto">
            <Stat end={10} suffix="K+" label="Resumes Optimized" />
            <Stat end={85} suffix="%" label="Interview Rate Lift" />
            <Stat end={500} suffix="+" label="Offers Landed" />
          </div>
        </div>
      </div>
    </section>
  );
}

function MockTile({
  icon, label, value, suffix, hint, accent,
}: { icon: React.ReactNode; label: string; value: string; suffix: string; hint: string; accent: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/60 p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-3">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`font-display text-3xl font-bold ${accent}`}>
        {value}<span className="text-lg opacity-70">{suffix}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{hint}</p>
    </div>
  );
}

function Stat({ end, suffix, label }: { end: number; suffix: string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-display text-3xl md:text-4xl font-bold text-foreground flex justify-center items-center">
        <CountUp end={end} suffix={suffix} duration={2.5} />
      </div>
      <div className="text-muted-foreground text-xs md:text-sm mt-1 tracking-wide">{label}</div>
    </div>
  );
}
