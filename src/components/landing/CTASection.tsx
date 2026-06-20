import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  return (
    <section className="py-20 lg:py-32 relative overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        <div className="relative max-w-5xl mx-auto rounded-3xl overflow-hidden border border-border/50 bg-card/40 backdrop-blur-xl">
          {/* Animated gradient backdrop */}
          <div className="absolute inset-0 bg-mesh opacity-90" />
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-gradient-to-r from-primary/30 via-accent/20 to-secondary/30 blur-3xl pointer-events-none" />

          <div className="relative px-6 py-20 lg:py-28 text-center">
            <h2 className="font-display text-4xl md:text-6xl font-bold text-foreground mb-6 tracking-tight leading-[1.05]">
              Stop applying.
              <br />
              <span className="text-gradient">Start landing.</span>
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Join thousands of engineers who replaced spray-and-pray with strategy.
              Free to start — no credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="xl" variant="glow" asChild className="min-w-[200px] shadow-glow">
                <Link to="/auth?mode=signup">
                  Get started free
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/contact">Talk to us</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
