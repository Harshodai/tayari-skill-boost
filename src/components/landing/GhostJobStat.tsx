import { ShieldCheck, Ghost } from "lucide-react";

const GHOST_JOB_STAT = {
  precision: 1.0,
  recall: 0.867,
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
            Illustrative screening benchmark — not a production accuracy claim.
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed mb-8">
            Synthetic fixture v2: {pct(GHOST_JOB_STAT.precision)} precision and {pct(GHOST_JOB_STAT.recall)} recall on a{" "}
            {GHOST_JOB_STAT.sampleSize}-posting hand-labeled set. This is a reproducible development benchmark, not a promise about live listings or general model performance. Re-verify via{" "}
            <code className="text-foreground/80">/api/v1/screening/metrics</code> when{" "}
            <code className="text-foreground/80">posting_screen.py</code> changes.
          </p>
          <p className="text-xs text-muted-foreground inline-flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Source: committed synthetic fixture v2. Do not use this card as a customer outcome or market statistic.
          </p>
        </div>
      </div>
    </section>
  );
}