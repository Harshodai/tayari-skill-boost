import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Rocket, Star, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

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
  { value: "Join Us", label: "Be Our First Success" },
  { value: "100%", label: "Commitment to You" },
  { value: "AI", label: "Powered Insights" },
  { value: "∞", label: "Career Possibilities" },
];

export function SocialProofSection() {
  return (
    <section className="py-20 lg:py-28">
      <div className="container mx-auto px-4">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 mb-20">
          {stats.map((stat, index) => (
            <div 
              key={stat.label} 
              className="text-center p-6 rounded-xl bg-card border border-border/50 animate-fade-in-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="text-3xl lg:text-4xl font-bold text-primary mb-2">
                {stat.value}
              </div>
              <div className="text-muted-foreground text-sm">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-section font-bold text-foreground mb-4">
            You Can Be The One Here
          </h2>
          <p className="text-muted-foreground text-lg">
            Start your journey today and become one of the engineers who transform their careers with Job Tayari.
          </p>
        </div>

        {/* Aspirational Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {aspirationalCards.map((card, index) => (
            <Card 
              key={card.title} 
              className="relative animate-fade-in-up group hover:border-primary/50 transition-colors"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardContent className="pt-6">
                {/* Icon */}
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <card.icon className="w-6 h-6 text-primary" />
                </div>

                {/* Title */}
                <h3 className="text-lg font-semibold text-foreground mb-3">
                  {card.title}
                </h3>

                {/* Description */}
                <p className="text-muted-foreground mb-6">
                  {card.description}
                </p>

                {/* CTA Button */}
                <Button 
                  variant="outline" 
                  className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                  asChild
                >
                  <Link to="/resume">
                    {card.cta}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
