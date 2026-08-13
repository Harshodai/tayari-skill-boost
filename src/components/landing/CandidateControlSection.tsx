import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { CheckCircle2, Eye, FileCheck2, PauseCircle, ShieldCheck } from "lucide-react";

const WORKFLOW_STEPS = [
  {
    label: "Signal",
    description: "Bring a relevant role into focus before you spend time on it.",
    icon: Eye,
    tone: "border-cyan-300/25 bg-cyan-400/10 text-cyan-100",
  },
  {
    label: "Review",
    description: "Keep the choices, materials, and final decision visible to you.",
    icon: PauseCircle,
    tone: "border-indigo-300/25 bg-indigo-400/10 text-indigo-100",
  },
  {
    label: "Receipt",
    description: "Keep a clear history of what was reviewed and recorded.",
    icon: FileCheck2,
    tone: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
  },
] as const;

export function CandidateControlSection() {
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isInView = useInView(sectionRef, { amount: 0.3, once: false });
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isInView && !reduceMotion) {
      void video.play().catch(() => undefined);
      return;
    }

    video.pause();
  }, [isInView, reduceMotion]);

  useEffect(() => {
    if (!isInView || reduceMotion) return;

    const timer = window.setInterval(() => {
      setActiveStep((current) => (current + 1) % WORKFLOW_STEPS.length);
    }, 1900);

    return () => window.clearInterval(timer);
  }, [isInView, reduceMotion]);

  const reveal = reduceMotion
    ? { initial: false, animate: undefined }
    : {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.28 },
      };

  return (
    <section ref={sectionRef} className="relative overflow-hidden border-y border-slate-800/70 bg-slate-950 py-20 sm:py-24 lg:py-28">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_18%_30%,rgba(34,211,238,0.09),transparent_28%),radial-gradient(circle_at_82%_68%,rgba(16,185,129,0.09),transparent_30%)]" />
      <div className="container relative mx-auto px-4">
        <div className="grid items-center gap-12 lg:grid-cols-[0.88fr_1.12fr] lg:gap-16">
          <motion.div {...reveal} transition={{ duration: 0.55, ease: "easeOut" }}>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-cyan-100">
              <ShieldCheck className="h-3.5 w-3.5" />
              Candidate-controlled workflow
            </div>
            <h2 className="mt-5 max-w-xl text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">
              Let the workflow move. Keep the decision with you.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
              Job Tayari is designed to make each meaningful step easier to inspect, pause, and understand—without turning your search into a black box.
            </p>

            <div className="mt-8 space-y-3">
              {WORKFLOW_STEPS.map((step, index) => {
                const Icon = step.icon;
                const isActive = activeStep === index && !reduceMotion;
                return (
                  <motion.div
                    key={step.label}
                    className={`flex items-start gap-4 rounded-2xl border p-4 transition-colors duration-300 ${
                      isActive ? "border-slate-500/75 bg-slate-900/90 shadow-[0_16px_34px_rgba(2,6,23,0.32)]" : "border-slate-800 bg-slate-900/45"
                    }`}
                    animate={reduceMotion ? undefined : { x: isActive ? 4 : 0 }}
                    transition={{ duration: 0.32, ease: "easeOut" }}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${step.tone}`}>
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <span>
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                        {step.label}
                        {index === 1 && <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200">You decide</span>}
                      </span>
                      <span className="mt-1 block text-sm leading-6 text-slate-400">{step.description}</span>
                    </span>
                    {isActive && <CheckCircle2 className="ml-auto mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          <motion.div
            {...reveal}
            transition={{ duration: 0.65, ease: "easeOut", delay: reduceMotion ? 0 : 0.1 }}
            className="relative mx-auto w-full max-w-3xl"
          >
            <div aria-hidden="true" className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-cyan-300/15 via-indigo-400/10 to-emerald-300/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-[1.55rem] border border-slate-700/80 bg-[#08111F] shadow-[0_28px_90px_rgba(2,6,23,0.48)]">
              <div className="flex items-center justify-between border-b border-slate-800/90 bg-slate-900/80 px-4 py-3 sm:px-5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-400/10 text-cyan-100">T</span>
                  Control path
                </div>
                <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-100">Visible by design</span>
              </div>
              <div className="relative aspect-video">
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover motion-reduce:hidden"
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  aria-hidden="true"
                >
                  <source src="/animations/candidate-control-loop.mp4" type="video/mp4" />
                </video>
                <div className="absolute inset-0 hidden items-center justify-center bg-[#08111F] p-5 motion-reduce:flex">
                  <StaticControlPath />
                </div>
              </div>
              <div className="grid gap-3 border-t border-slate-800 bg-slate-950/90 p-4 sm:grid-cols-3 sm:p-5">
                {WORKFLOW_STEPS.map((step) => (
                  <div key={step.label} className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    {step.label} stays visible
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-4 text-center text-sm leading-6 text-slate-500">
              A clear record supports informed next steps—without promising an outcome you cannot control.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function StaticControlPath() {
  return (
    <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-3">
      {WORKFLOW_STEPS.map((step, index) => {
        const Icon = step.icon;
        return (
          <div key={step.label} className="rounded-xl border border-slate-700 bg-slate-900/85 p-4 text-left">
            <span className={`flex h-8 w-8 items-center justify-center rounded-lg border ${step.tone}`}>
              <Icon className="h-4 w-4" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-100">{step.label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">{index === 1 ? "Your decision remains explicit." : step.description}</p>
          </div>
        );
      })}
    </div>
  );
}
