import { Link } from "react-router-dom";
import { ArrowRight, Check, FileSearch, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const CHECKPOINTS = [
  "Choose opportunities with the right context",
  "Review the work before a meaningful action",
  "Keep the record you need for the next decision",
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-background pb-16 pt-24 text-foreground sm:pb-20 sm:pt-28 lg:pb-28 lg:pt-32">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-18rem] h-[46rem] w-[46rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-[-20rem] left-[-12rem] h-[34rem] w-[34rem] rounded-full bg-accent/8 blur-[110px]" />
        <div className="absolute right-[-12rem] top-[24%] h-[28rem] w-[28rem] rounded-full bg-primary/5 blur-[110px]" />
        <div className="absolute inset-0 opacity-[0.25] [background-image:linear-gradient(hsl(var(--border)/0.25)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.25)_1px,transparent_1px)] [background-size:52px_52px] [mask-image:radial-gradient(ellipse_72%_68%_at_50%_32%,black,transparent)]" />
      </div>

      <div className="container relative z-10 mx-auto px-4 sm:px-6">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
          <div className="max-w-2xl text-center lg:text-left">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1.5 text-sm font-medium text-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.08),0_12px_40px_hsl(var(--primary)/0.16)]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Career operations, on your terms
            </div>

            <h1 className="font-display text-balance text-5xl font-bold leading-[0.98] tracking-[-0.055em] text-foreground sm:text-6xl lg:text-7xl">
              Turn a scattered job search into a <span className="text-gradient">deliberate rhythm.</span>
            </h1>

            <p className="mx-auto mt-7 max-w-xl text-balance text-base leading-7 text-muted-foreground sm:text-lg lg:mx-0 lg:pr-6">
              Choose roles with context, prepare work you can stand behind, and keep every meaningful decision visible. Job Tayari helps you move deliberately—not just faster.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Button size="xl" asChild className="group min-w-[190px] shadow-glow transition-all active:scale-[0.98] active:translate-y-0.5">
                <Link to="/auth?mode=signup">
                  Start my career rhythm
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="transition-all active:scale-[0.98] active:translate-y-0.5">
                <Link to="/free-scan">
                  Start with a free ATS scan
                </Link>
              </Button>
            </div>

            <div className="mt-9 grid gap-3 text-left sm:grid-cols-3 lg:max-w-xl lg:grid-cols-1">
              {CHECKPOINTS.map((checkpoint) => (
                <div key={checkpoint} className="flex items-start gap-2.5 text-sm leading-5 text-muted-foreground">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-success/30 bg-success/10 text-success">
                    <Check className="h-3 w-3" />
                  </span>
                  <span>{checkpoint}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[680px] lg:mx-0">
            <div aria-hidden="true" className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-primary/15 via-accent/10 to-success/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-[1.4rem] border border-border/80 bg-card shadow-2xl ring-1 ring-border/60">
              <div className="flex items-center justify-between border-b border-border bg-card/90 px-4 py-3 sm:px-5">
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
                </div>
                <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-success" />
                  Your review loop
                </div>
              </div>

              <div className="relative aspect-video bg-background/90">
                <video
                  className="h-full w-full object-cover motion-reduce:hidden"
                  autoPlay
                  loop
                  muted
                  playsInline
                  aria-label="Animated workflow showing a matched role, candidate review, and a recorded receipt"
                >
                  <source src="/animations/candidate-review-loop.mp4" type="video/mp4" />
                </video>

                <div className="absolute inset-0 hidden items-center justify-center p-6 motion-reduce:flex" aria-label="Candidate review workflow">
                  <StaticWorkflow />
                </div>
              </div>

              <div className="grid gap-3 border-t border-border bg-card/95 p-4 sm:grid-cols-2 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileSearch className="h-4 w-4" /></span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Context before volume</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Start with roles and materials you can genuinely stand behind.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning"><ShieldCheck className="h-4 w-4" /></span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Your decision stays visible</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Review important work instead of relying on a black box.</p>
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
              Sensitive answers and final decisions stay in your hands.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function StaticWorkflow() {
  const steps = [
    { label: "Match", tone: "border-primary/30 bg-primary/10 text-primary" },
    { label: "Review", tone: "border-accent/30 bg-accent/10 text-accent-foreground" },
    { label: "Receipt", tone: "border-warning/30 bg-warning/10 text-warning" },
  ];

  return (
    <div className="grid w-full max-w-lg grid-cols-3 gap-3">
      {steps.map((step, index) => (
        <div key={step.label} className="relative">
          <div className={`rounded-xl border p-3 text-center text-sm font-semibold ${step.tone}`}>{step.label}</div>
          {index < steps.length - 1 && <ArrowRight className="absolute -right-4 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-muted-foreground sm:block" />}
        </div>
      ))}
    </div>
  );
}
