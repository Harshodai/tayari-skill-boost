import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  return (
    <section className="py-20 lg:py-32 relative overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        <div className="relative max-w-5xl mx-auto rounded-3xl overflow-hidden border border-border/60 bg-card/60 backdrop-blur-xl">
          {/* Subtle gradient backdrop */}
          <div className="absolute inset-0 bg-mesh opacity-80" />
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-primary/10 blur-3xl pointer-events-none" />

          <div className="relative px-6 py-20 lg:py-28 text-center">
            <h2 className="font-display text-balance text-4xl md:text-6xl font-bold text-foreground mb-6 tracking-tight leading-[1.05]">
              Make the next move
              <br />
              <span className="text-gradient">one you can stand behind.</span>
            </h2>
            <p className="text-balance text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Start with one clear signal, then build a career-search rhythm around context, preparation, review, and learning. Begin free; plan limits and provider costs are shown before use.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="xl" asChild className="min-w-[200px] font-semibold active:scale-[0.98]">
                <Link to="/auth?mode=signup">
                  Start my career rhythm
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="active:scale-[0.98]">
                <Link to="/free-scan">Start with a free scan</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

