import { Link } from "react-router-dom";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";

const CHECKPOINTS = [
  "Choose opportunities with real hiring context",
  "Review and calibrate before meaningful actions",
  "Retain cryptographic submission receipts",
];

const QUEUE = [
  {
    company: "Stripe",
    role: "Senior Product Engineer",
    meta: "Prepared 2m ago · ATS match 94%",
    state: "done" as const,
  },
  {
    company: "Linear",
    role: "Product Engineer",
    meta: "Scanning the description for fit…",
    state: "active" as const,
  },
  {
    company: "Vercel",
    role: "Frontend Engineer",
    meta: "Next in queue — waiting for your review",
    state: "queued" as const,
  },
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-background pb-20 pt-20 text-foreground sm:pt-24 lg:pb-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.55] [background-image:linear-gradient(hsl(var(--border))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border))_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,black,transparent)]"
      />

      <div className="container relative z-10 mx-auto px-4 sm:px-6">
        {/* ── Headline block ─────────────────────────────── */}
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70 motion-reduce:hidden" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              Career operations, on your terms
            </span>
          </Reveal>

          <Reveal delay={0.06}>
            <h1 className="font-display mt-8 text-balance text-5xl font-bold leading-[0.92] tracking-[-0.045em] sm:text-6xl lg:text-8xl">
              Job search, <span className="text-primary">deliberate.</span>
            </h1>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="mx-auto mt-7 max-w-2xl text-balance text-lg font-medium leading-8 text-muted-foreground sm:text-xl">
              Prepared applications, ATS-honest resumes, and a receipt for every action. You keep the judgment — Job Tayari removes the busywork.
            </p>
          </Reveal>

          <Reveal delay={0.18}>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                size="xl"
                asChild
                className="group w-full min-w-[210px] rounded-2xl text-base font-semibold shadow-glow transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 active:scale-[0.985] sm:w-auto"
              >
                <Link to="/auth?mode=signup">
                  Start my career rhythm
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button
                size="xl"
                variant="secondary"
                asChild
                className="w-full rounded-2xl text-base font-semibold transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.985] sm:w-auto"
              >
                <Link to="/free-scan">Run a free ATS scan</Link>
              </Button>
            </div>
          </Reveal>

          <RevealGroup className="mx-auto mt-10 grid max-w-3xl gap-3 text-left sm:grid-cols-3">
            {CHECKPOINTS.map((checkpoint) => (
              <RevealItem key={checkpoint}>
                <div className="flex items-start gap-2.5 text-sm leading-6 text-muted-foreground">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
                    <Check className="h-3 w-3" />
                  </span>
                  <span>{checkpoint}</span>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>

        {/* ── Product spotlight ──────────────────────────── */}
        <Reveal delay={0.1} y={28} className="mx-auto mt-20 max-w-6xl">
          <div className="group/frame relative rounded-[2.5rem] border border-border bg-secondary p-3 shadow-2xl shadow-foreground/5 transition-transform duration-500 sm:p-6">
            <div className="overflow-hidden rounded-[1.6rem] border border-border bg-background">
              <div className="flex h-12 items-center justify-between border-b border-border px-4">
                <div className="flex gap-2" aria-hidden="true">
                  <span className="h-3 w-3 rounded-full bg-secondary" />
                  <span className="h-3 w-3 rounded-full bg-secondary" />
                  <span className="h-3 w-3 rounded-full bg-secondary" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                  Agent activity log
                </span>
                <span className="w-12" />
              </div>

              <div className="grid min-h-[380px] md:grid-cols-12">
                <aside className="hidden space-y-6 border-r border-border p-6 md:col-span-3 md:block" aria-hidden="true">
                  <div className="space-y-2">
                    <div className="h-2 w-12 rounded-full bg-primary" />
                    <div className="h-2 w-full rounded-full bg-secondary" />
                  </div>
                  <div className="space-y-3 pt-2">
                    {["Pipeline", "Resume", "Receipts", "Outreach"].map((label) => (
                      <div
                        key={label}
                        className="rounded-lg bg-secondary/70 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary"
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                </aside>

                <div className="p-6 sm:p-8 md:col-span-9">
                  <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="font-display text-2xl font-bold tracking-tight">Active search</h2>
                      <p className="text-sm text-muted-foreground">Product Engineer · Remote · US/EU</p>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75 motion-reduce:hidden" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                      </span>
                      Preparing…
                    </span>
                  </div>

                  <RevealGroup className="space-y-3" stagger={0.1}>
                    {QUEUE.map((item) => (
                      <RevealItem key={item.company}>
                        <div
                          className={[
                            "flex items-center justify-between gap-4 rounded-xl border p-4 transition-all duration-300",
                            item.state === "done"
                              ? "border-border bg-card hover:-translate-y-0.5 hover:shadow-md"
                              : item.state === "active"
                                ? "border-border/70 bg-card/60"
                                : "border-border/40 bg-card/30",
                          ].join(" ")}
                        >
                          <div className="flex min-w-0 items-center gap-4">
                            <span
                              className={[
                                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-sm font-bold",
                                item.state === "queued" ? "opacity-40" : "",
                              ].join(" ")}
                              aria-hidden="true"
                            >
                              {item.company[0]}
                            </span>
                            <div className="min-w-0">
                              <p
                                className={[
                                  "truncate font-semibold",
                                  item.state === "done" ? "" : item.state === "active" ? "opacity-70" : "opacity-40",
                                ].join(" ")}
                              >
                                {item.company} — {item.role}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">{item.meta}</p>
                            </div>
                          </div>
                          {item.state === "done" && (
                            <span className="hidden shrink-0 items-center gap-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline sm:inline-flex">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              View receipt
                            </span>
                          )}
                        </div>
                      </RevealItem>
                    ))}
                  </RevealGroup>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
            Illustrative view. Sensitive answers and final submission always stay in your hands.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

export default HeroSection;
