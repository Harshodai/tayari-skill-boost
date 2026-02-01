
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Rocket, Star, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { CountUp } from "@/components/ui/count-up";

const aspirationalCards = [
  {
    title: "Your Success Story",
    description: "Share how Job Tayari helped you land your dream role at a top tech company.",
    icon: Rocket,
    cta: "Start Your Journey",
  },
  {
    title: "Your Testimonial",
    description: "Be featured here after you've optimized your resume and aced your interviews.",
    icon: Star,
    cta: "Get Started Now",
  },
  {
    title: "Your Achievement",
    description: "Join the community of engineers who transformed their careers with AI assistance.",
    icon: Sparkles,
    cta: "Begin Today",
  },
];

const stats = [
  { value: "Join Us", label: "Be Our First Success", isText: true },
  { value: 100, suffix: "%", label: "Commitment to You" },
  { value: "AI", label: "Powered Insights", isText: true },
  { value: "∞", label: "Career Possibilities", isText: true },
];

import { FadeIn, SlideUp, StaggerContainer } from "@/components/ui/motion";

// ... existing imports

export function SocialProofSection() {
  return (
    <section className="py-20 lg:py-28 bg-accent/5">
      <div className="container mx-auto px-4">
        {/* Stats Bar */}
        <StaggerContainer className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 mb-20" staggerDelay={0.1}>
          {stats.map((stat, index) => (
            <SlideUp
              key={stat.label}
              className="text-center p-6 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm hover:border-primary/30 transition-colors duration-300"
            >
              <div className="text-3xl lg:text-4xl font-bold text-primary mb-2 flex justify-center items-center h-10">
                {stat.isText ? (
                  stat.value
                ) : (
                  <CountUp
                    end={stat.value as number}
                    suffix={stat.suffix}
                    duration={2.5}
                    delay={0.5 + (index * 0.1)}
                  />
                )}
              </div>
              <div className="text-muted-foreground text-sm">
                {stat.label}
              </div>
            </SlideUp>
          ))}
        </StaggerContainer>

        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <SlideUp delay={0.2}>
            <h2 className="text-section font-bold text-foreground mb-4">
              You Can Be The One Here
            </h2>
            <p className="text-muted-foreground text-lg">
              Start your journey today and become one of the engineers who transform their careers with Job Tayari.
            </p>
          </SlideUp>
        </div>

        {/* Aspirational Cards */}
        <StaggerContainer className="flex flex-nowrap overflow-x-auto snap-x snap-mandatory -mx-4 px-4 gap-4 pb-6 md:grid md:grid-cols-3 md:gap-6 md:pb-0 md:mx-0 md:px-0 lg:gap-8 scrollbar-hide" staggerDelay={0.2}>
          {aspirationalCards.map((card, index) => (
            <FadeIn
              key={card.title}
              className="group relative h-full perspective-1000 min-w-[85vw] sm:min-w-[45vw] md:min-w-0 snap-center"
              delay={index * 0.1}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-xl blur-lg opacity-0 group-hover:opacity-70 transition-opacity duration-500" />
              <Card
                className="relative h-full border-border/50 bg-card/80 backdrop-blur-sm transition-all duration-300 group-hover:translate-y-[-5px] group-hover:border-primary/30"
              >
                <CardContent className="pt-8 pb-8 flex flex-col h-full">
                  {/* Icon */}
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <card.icon className="w-7 h-7 text-primary" />
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-semibold text-foreground mb-3">
                    {card.title}
                  </h3>

                  {/* Description */}
                  <p className="text-muted-foreground mb-8 flex-1 leading-relaxed">
                    {card.description}
                  </p>

                  {/* CTA Button */}
                  <Button
                    variant="ghost"
                    className="w-full justify-between group/btn hover:bg-primary/10 hover:text-primary"
                    asChild
                  >
                    <Link to="/resume">
                      <span className="font-semibold">{card.cta}</span>
                      <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
