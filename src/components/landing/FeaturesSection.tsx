
import { Link } from "react-router-dom";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { Button } from "@/components/ui/button";
import { FileText, MessageSquare, Briefcase, ArrowRight } from "lucide-react";
import { FEATURE_FLAGS } from "@/config/features";

const features = [
  {
    icon: FileText,
    title: "Resume Optimizer",
    description: "AI analyzes your resume against job descriptions to maximize your match score and highlight key skills.",
    href: "/resume",
    cta: "Optimize Now",
    available: true,
    visible: true,
  },
  {
    icon: MessageSquare,
    title: "Interview Prep",
    description: "Practice with AI-powered mock interviews, compete in coding challenges, and master technical questions.",
    href: "/interview",
    cta: "Start Practicing",
    available: false,
    visible: FEATURE_FLAGS.showComingSoonBadges, // Hide in production
  },
  {
    icon: Briefcase,
    title: "Job Matcher",
    description: "Get personalized job recommendations based on your skills, experience, and career preferences.",
    href: "/jobs",
    cta: "Find Jobs",
    available: false,
    visible: FEATURE_FLAGS.showComingSoonBadges, // Hide in production
  },
];

export function FeaturesSection() {
  const visibleFeatures = features.filter(f => f.visible);

  return (
    <section className="py-20 lg:py-28">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-section font-bold text-foreground mb-4">
            Everything You Need to Succeed
          </h2>
          <p className="text-muted-foreground text-lg">
            Our AI-powered tools help you prepare for every step of your job search journey.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {visibleFeatures.map((feature, index) => (
            <SpotlightCard
              key={feature.title} 
              className="flex flex-col h-full animate-fade-in-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="p-6 flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10">
                    <feature.icon className="w-7 h-7 text-primary" />
                  </div>
                  {!feature.available && (
                    <span className="text-xs font-normal px-2 py-1 rounded-full bg-warning/20 text-warning border border-warning/30">
                      Coming Soon
                    </span>
                  )}
                </div>

                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground mb-6 flex-1">
                  {feature.description}
                </p>

                <Button 
                  variant={feature.available ? "default" : "outline"} 
                  className="w-full group mt-auto"
                  asChild
                >
                  <Link to={feature.href}>
                    {feature.cta}
                    <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>
            </SpotlightCard>
          ))}
        </div>
      </div>
    </section>
  );
}
