import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  FileSearch,
  PenLine,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

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
}

const RHYTHM_STAGES: RhythmStage[] = [
  {
    number: "01",
    title: "Choose intentionally",
    capability: "Job Search",
    description:
      "Bring promising roles into one place, compare the context, and focus your energy before another tab or deadline takes over.",
    impact: "Spend time on opportunities you can genuinely pursue.",
    signal: "Relevant roles, held in context",
    href: "/jobs",
    cta: "Explore job search",
    icon: FileSearch,
    tone: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
  },
  {
    number: "02",
    title: "Prepare with context",
    capability: "Resume Optimizer + Cover Letter",
    description:
      "Turn the role requirements into a focused preparation pass, so your materials remain truthful, relevant, and ready for your review.",
    impact: "Present the evidence of your work without losing your voice.",
    signal: "Materials tailored to the role",
    href: "/resume",
    cta: "Refine a resume",
    icon: PenLine,
    tone: "border-violet-300/20 bg-violet-300/10 text-violet-100",
  },
  {
    number: "03",
    title: "Decide in the open",
    capability: "Reviewable workflows",
    description:
      "Keep sensitive answers, final choices, and important actions visible. Job Tayari can prepare the work; you remain the decision-maker.",
    impact: "Move forward with confidence instead of relying on a black box.",
    signal: "Explicit approval before action",
    href: "/one-shot",
    cta: "See the review loop",
    icon: ClipboardCheck,
    tone: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
  },
  {
    number: "04",
    title: "Learn from the record",
    capability: "Tracker + supported receipts",
    description:
      "Retain the role, the materials, the decision, and—where a workflow returns it—the confirmation. Your next move starts with real context.",
    impact: "Know what happened, then improve the next attempt.",
    signal: "A retraceable career-search record",
    href: "/interview",
    cta: "Open the tracker",
    icon: BarChart3,
    tone: "border-amber-300/20 bg-amber-300/10 text-amber-100",
  },
];

export function CareerOperatingRhythm() {
  return (
    <section
      className="relative overflow-hidden border-y border-border/70 bg-[#07111f] py-20 text-slate-100 sm:py-24 lg:py-32"
      aria-labelledby="operating-rhythm-title"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-16rem] top-[12%] h-[30rem] w-[30rem] rounded-full bg-primary/20 blur-[130px]" />
        <div className="absolute bottom-[-16rem] right-[-8rem] h-[32rem] w-[32rem] rounded-full bg-emerald-400/10 blur-[150px]" />
        <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(148,163,184,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.18)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_78%_62%_at_48%_44%,black,transparent)]" />
      </div>

      <div className="container relative z-10 mx-auto px-4 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:h-fit">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-200" />
              The operating rhythm
            </div>
            <h2 id="operating-rhythm-title" className="mt-6 max-w-xl font-display text-balance text-4xl font-bold leading-[1.02] tracking-[-0.045em] text-white sm:text-5xl">
              Capabilities matter when they change the <span className="text-cyan-200">next decision.</span>
            </h2>
            <p className="mt-6 max-w-lg text-pretty text-base leading-7 text-slate-300 sm:text-lg">
              Job Tayari connects the work that usually lives in disconnected tabs into one deliberate loop. It is not a volume engine; it is a way to make each serious application easier to understand, review, and improve.
            </p>

            <div className="mt-8 rounded-2xl border border-slate-700/80 bg-slate-950/60 p-5 shadow-[0_18px_54px_rgba(2,6,23,0.26)]">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-100">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-white">Automation with a human handoff</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Organise and prepare the work with assistance. Keep sensitive answers and final decisions explicitly yours.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <Button size="lg" asChild className="group bg-cyan-300 text-slate-950 hover:bg-cyan-200">
                <Link to="/auth?mode=signup">
                  Start my career rhythm
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="border-slate-600 bg-slate-950/40 text-slate-100 hover:border-cyan-300/50 hover:bg-slate-900 hover:text-white">
                <Link to="/free-scan">Start with a free scan</Link>
              </Button>
            </div>
          </div>

          <ol className="grid gap-4 sm:gap-5" aria-label="Career operating rhythm stages">
            {RHYTHM_STAGES.map((stage) => {
              const Icon = stage.icon;
              return (
                <li key={stage.number}>
                  <Link
                    to={stage.href}
                    className="group block rounded-[1.35rem] border border-slate-700/80 bg-slate-950/65 p-5 shadow-[0_16px_40px_rgba(2,6,23,0.18)] transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/45 hover:bg-slate-900/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111f] sm:p-6"
                    aria-label={`${stage.title}: ${stage.cta}`}
                  >
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
                      <div className="flex items-center gap-3 sm:block">
                        <span className="font-mono text-xs font-bold tracking-[0.22em] text-slate-500 sm:block">{stage.number}</span>
                        <span className={`flex h-11 w-11 items-center justify-center rounded-xl border sm:mt-4 ${stage.tone}`}>
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{stage.capability}</p>
                            <h3 className="mt-1 font-display text-2xl font-bold tracking-[-0.025em] text-white">{stage.title}</h3>
                          </div>
                          <span className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-cyan-200 transition-transform duration-200 group-hover:translate-x-1">
                            {stage.cta}
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                          </span>
                        </div>
                        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">{stage.description}</p>
                        <div className="mt-5 grid gap-3 border-t border-slate-800 pt-4 sm:grid-cols-[1fr_auto] sm:items-center">
                          <p className="text-sm font-medium text-slate-100">{stage.impact}</p>
                          <p className="inline-flex w-fit items-center rounded-full border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-[11px] font-medium text-slate-400">{stage.signal}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
