import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { CountUp } from "@/components/ui/count-up";
import { FadeIn, SlideUp, StaggerContainer } from "@/components/ui/motion";

export function HeroSection() {
  return (
    <section className="relative py-20 lg:py-32 overflow-hidden bg-gradient-hero">
      {/* Subtle radial accent — replaces heavy floating orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-[0.08] blur-[120px] bg-primary motion-reduce:hidden" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.06] blur-[120px] bg-secondary motion-reduce:hidden" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <StaggerContainer className="max-w-4xl mx-auto text-center" staggerDelay={0.1}>
          {/* Badge */}
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8">
              <Sparkles className="w-4 h-4" />
              AI-Powered Career Preparation
            </div>
          </FadeIn>

          {/* Headline */}
          <SlideUp>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 tracking-tight">
              Land Your Dream
              <span className="block mt-2 text-gradient">Software Engineering Job</span>
            </h1>
          </SlideUp>

          {/* Subheadline */}
          <SlideUp delay={0.1}>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Optimize your resume with AI, practice coding interviews, and discover personalized job matches. Everything you need to accelerate your tech career.
            </p>
          </SlideUp>

          {/* CTA Buttons */}
          <SlideUp delay={0.2}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
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
          </SlideUp>

          {/* Stats */}
          <SlideUp delay={0.3}>
            <div className="grid grid-cols-3 gap-8 mt-16 pt-8 border-t border-border/50">
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
          </SlideUp>
        </StaggerContainer>
      </div>
    </section>
  );
}
