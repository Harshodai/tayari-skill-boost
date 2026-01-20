import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { CountUp } from "@/components/ui/count-up";
import { GradientOrb } from "@/components/ui/gradient-orb";

export function HeroSection() {
  return (
    <section className="relative py-20 lg:py-32 overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <GradientOrb variant="primary" size="sm" delay="none" className="top-20 left-10 opacity-40" />
        <GradientOrb variant="secondary" size="md" delay="short" className="bottom-20 right-10 opacity-40" />
        <GradientOrb variant="accent" size="lg" delay="long" className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20" />

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03] pointer-events-none" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8 animate-fade-in">
            <Sparkles className="w-4 h-4" />
            AI-Powered Career Preparation
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-hero font-bold text-foreground mb-6 animate-fade-in-up">
            Land Your Dream
            <span className="block mt-2">
              <AnimatedGradientText>Software Engineering Job</AnimatedGradientText>
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            Optimize your resume with AI, practice coding interviews, and discover personalized job matches. Everything you need to accelerate your tech career.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            <Button size="xl" variant="glow" asChild>
              <Link to="/auth?mode=signup">
                Get Started Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/resume">
                Try Resume Optimizer
              </Link>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 mt-16 pt-8 border-t border-border/50 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
            <div className="text-center group hover:-translate-y-1 transition-transform duration-300">
              <div className="text-3xl md:text-4xl font-bold text-foreground flex justify-center items-center">
                <CountUp end={10} suffix="K+" duration={2.5} />
              </div>
              <div className="text-muted-foreground text-sm mt-1">Resumes Optimized</div>
            </div>
            <div className="text-center group hover:-translate-y-1 transition-transform duration-300">
              <div className="text-3xl md:text-4xl font-bold text-foreground flex justify-center items-center">
                <CountUp end={85} suffix="%" duration={2.5} delay={0.2} />
              </div>
              <div className="text-muted-foreground text-sm mt-1">Interview Success</div>
            </div>
            <div className="text-center group hover:-translate-y-1 transition-transform duration-300">
              <div className="text-3xl md:text-4xl font-bold text-foreground flex justify-center items-center">
                <CountUp end={500} suffix="+" duration={2.5} delay={0.4} />
              </div>
              <div className="text-muted-foreground text-sm mt-1">Dream Jobs Landed</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
