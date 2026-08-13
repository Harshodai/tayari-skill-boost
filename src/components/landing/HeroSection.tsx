import { Link } from "react-router-dom";
import { ArrowRight, Check, FileSearch, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const CHECKPOINTS = [
  "Choose the opportunities worth your time",
  "Review the work before you move forward",
  "Keep a visible record of each completed action",
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-slate-800 bg-[#080d1c] pb-16 pt-24 text-slate-100 sm:pb-20 sm:pt-28 lg:pb-28 lg:pt-32">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-18rem] h-[46rem] w-[46rem] -translate-x-1/2 rounded-full bg-indigo-500/18 blur-[120px]" />
        <div className="absolute bottom-[-20rem] left-[-12rem] h-[34rem] w-[34rem] rounded-full bg-cyan-400/10 blur-[110px]" />
        <div className="absolute right-[-12rem] top-[24%] h-[28rem] w-[28rem] rounded-full bg-violet-500/12 blur-[110px]" />
        <div className="absolute inset-0 opacity-[0.32] [background-image:linear-gradient(rgba(148,163,184,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.12)_1px,transparent_1px)] [background-size:52px_52px] [mask-image:radial-gradient(ellipse_72%_68%_at_50%_32%,black,transparent)]" />
      </div>

      <div className="container relative z-10 mx-auto px-4 sm:px-6">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
          <div className="max-w-2xl text-center lg:text-left">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-300/10 px-3.5 py-1.5 text-sm font-medium text-indigo-100 shadow-[0_0_0_1px_rgba(129,140,248,.08),0_12px_40px_rgba(79,70,229,.16)]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-300" />
              </span>
              <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
              Candidate-controlled career operations
            </div>

            <h1 className="font-display text-balance text-5xl font-bold leading-[0.98] tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">
              A job search you can <span className="text-transparent [background:linear-gradient(110deg,#a5b4fc_0%,#67e8f9_52%,#5eead4_100%)] [background-clip:text]">inspect</span> before anything goes out.
            </h1>

            <p className="mx-auto mt-7 max-w-xl text-pretty text-base leading-7 text-slate-300 sm:text-lg lg:mx-0 lg:pr-6">
              Tailor your materials, organise your opportunities, and move through every application with visible review steps—not promises you cannot verify.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Button size="xl" asChild className="group min-w-[190px] bg-indigo-400 text-slate-950 shadow-[0_16px_46px_rgba(129,140,248,.3)] transition hover:bg-indigo-300">
                <Link to="/auth?mode=signup">
                  Build my review loop
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="border-slate-600 bg-slate-950/25 text-slate-100 hover:border-slate-400 hover:bg-slate-900">
                <Link to="/free-scan">
                  Try a free ATS scan
                </Link>
              </Button>
            </div>

            <div className="mt-9 grid gap-3 text-left sm:grid-cols-3 lg:max-w-xl lg:grid-cols-1">
              {CHECKPOINTS.map((checkpoint) => (
                <div key={checkpoint} className="flex items-start gap-2.5 text-sm leading-5 text-slate-300">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-400/10 text-emerald-200">
                    <Check className="h-3 w-3" />
                  </span>
                  <span>{checkpoint}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[680px] lg:mx-0">
            <div aria-hidden="true" className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-indigo-400/25 via-cyan-300/10 to-emerald-300/15 blur-3xl" />
            <div className="relative overflow-hidden rounded-[1.4rem] border border-slate-700/80 bg-slate-950/80 shadow-[0_28px_80px_rgba(0,0,0,.38)]">
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/70 px-4 py-3 sm:px-5">
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400/75" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300/75" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/75" />
                </div>
                <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-[11px] font-medium text-slate-400">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                  Review loop active
                </div>
              </div>

              <div className="relative aspect-video bg-[#0b1020]">
                <video
                  className="h-full w-full object-cover motion-reduce:hidden"
                  autoPlay
                  loop
                  muted
                  playsInline
                  aria-label="Animated workflow showing a matched role, candidate review, and recorded receipt"
                >
                  <source src="/animations/candidate-review-loop.mp4" type="video/mp4" />
                </video>

                <div className="absolute inset-0 hidden items-center justify-center p-6 motion-reduce:flex" aria-label="Candidate review workflow">
                  <StaticWorkflow />
                </div>
              </div>

              <div className="grid gap-3 border-t border-slate-800 bg-slate-950/95 p-4 sm:grid-cols-2 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-400/10 text-indigo-200"><FileSearch className="h-4 w-4" /></span>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">Fit before volume</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-400">Start with relevant roles and materials you can stand behind.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-300/10 text-amber-200"><ShieldCheck className="h-4 w-4" /></span>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">Proof, not guesswork</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-400">Keep the workflow visible instead of relying on a black box.</p>
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-3 text-center text-xs leading-5 text-slate-500">
              Sensitive answers and final decisions stay with you.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function StaticWorkflow() {
  const steps = [
    { label: "Match", tone: "border-indigo-300/40 bg-indigo-400/10 text-indigo-100" },
    { label: "Review", tone: "border-cyan-300/40 bg-cyan-400/10 text-cyan-100" },
    { label: "Receipt", tone: "border-amber-300/40 bg-amber-300/10 text-amber-100" },
  ];

  return (
    <div className="grid w-full max-w-lg grid-cols-3 gap-3">
      {steps.map((step, index) => (
        <div key={step.label} className="relative">
          <div className={`rounded-xl border p-3 text-center text-sm font-semibold ${step.tone}`}>{step.label}</div>
          {index < steps.length - 1 && <ArrowRight className="absolute -right-4 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-slate-500 sm:block" />}
        </div>
      ))}
    </div>
  );
}
