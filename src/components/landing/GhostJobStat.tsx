import { ShieldCheck, Ghost } from "lucide-react";

const GHOST_JOB_STAT = {
  precision: 1.0,
  recall: 0.933,
  sampleSize: 30,
};

export function GhostJobStat() {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return (
    <section className="py-16 lg:py-20 border-t border-border/40">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground inline-flex items-center gap-2 mb-4">
            <Ghost className="w-3.5 h-3.5" />
            Ghost-job screening — measured, not promised
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4 tracking-tight">
            We screen out 1 in 4 ghost jobs before you waste your time.
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed mb-8">
            Measured: {pct(GHOST_JOB_STAT.precision)} precision, {pct(GHOST_JOB_STAT.recall)} recall on a{" "}
            {GHOST_JOB_STAT.sampleSize}-posting hand-labeled set. The number is reproducible from a
            committed fixture — re-verify via <code className="text-foreground/80">/api/v1/screening/metrics</code> when{" "}
            <code className="text-foreground/80">posting_screen.py</code> changes.
          </p>
          <p className="text-xs text-muted-foreground inline-flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Source: 18–27% of online listings are ghost jobs (Green &amp; Stockton, 2025); 47% of candidates report chasing listings that don't exist.
          </p>
        </div>
      </div>
    </section>
  );
}