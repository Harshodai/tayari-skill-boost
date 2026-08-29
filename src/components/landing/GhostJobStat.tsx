import { Ghost, ShieldCheck } from "lucide-react";
import { GhostJobDetectorWidget } from "./GhostJobDetectorWidget";

export function GhostJobStat() {
  return (
    <section className="py-20 lg:py-28 border-t border-border/40 bg-background/50">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <p className="text-xs uppercase tracking-[0.2em] text-primary inline-flex items-center gap-2 mb-4 font-semibold">
            <Ghost className="w-3.5 h-3.5" />
            Ghost-Job Screening & Requisition Verification
          </p>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 tracking-tight">
            Illustrative screening benchmark — not a production accuracy claim.
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed mb-6">
            Synthetic fixture v2: 100% precision and 86.7% recall on a 30-posting hand-labeled set. This is a reproducible development benchmark, not a promise about live listings or general model performance. Re-verify via <code className="text-foreground/90 font-mono text-xs">/api/v1/screening/metrics</code> when posting screening logic changes.
          </p>
          <p className="text-xs text-muted-foreground inline-flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            Source: committed synthetic fixture v2. Do not use this card as a customer outcome or market statistic.
          </p>
        </div>

        {/* Live Interactive Screening Widget */}
        <GhostJobDetectorWidget />
      </div>
    </section>
  );
}

export default GhostJobStat;