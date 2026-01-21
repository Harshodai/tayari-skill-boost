
import { Link } from "react-router-dom";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { Button } from "@/components/ui/button";
import { FileText, MessageSquare, Briefcase, ArrowRight } from "lucide-react";
import { settings } from "@/config/features";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

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
    visible: settings.showComingSoonBadges, // Hide in production
  },
  {
    icon: Briefcase,
    title: "Job Matcher",
    description: "Get personalized job recommendations based on your skills, experience, and career preferences.",
    href: "/jobs",
    cta: "Find Jobs",
    available: false,
    visible: settings.showComingSoonBadges, // Hide in production
  },
];

export function FeaturesSection() {
  const visibleFeatures = features.filter(f => f.visible);
  const isSingleFeature = visibleFeatures.length === 1;

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

        {/* Feature Cards - Dynamic Layout */}
        <div className={cn(
          "mx-auto",
          isSingleFeature ? "max-w-md" : "max-w-6xl"
        )}>
          {isSingleFeature ? (
            // Single Feature - Centered & Premium
            <div className="flex justify-center animate-fade-in-up">
              <FeatureCard feature={visibleFeatures[0]} index={0} />
            </div>
          ) : (
            // Multiple Features - Carousel for sliding/dragging UX
            <Carousel
              opts={{
                align: "start",
                loop: false,
                dragFree: true,
              }}
              className="w-full"
            >
              <CarouselContent className="-ml-4 md:-ml-6">
                {visibleFeatures.map((feature, index) => (
                  <CarouselItem
                    key={feature.title}
                    className={cn(
                      "pl-4 md:pl-6",
                      // Mobile: Always 1 per slide (basis-full default)
                      // Tablet (md): If 2+ items, show 2. 
                      visibleFeatures.length >= 2 ? "md:basis-1/2" : "md:basis-full",
                      // Desktop (lg): If 3+ items, show 3. If 2 items, show 2.
                      visibleFeatures.length >= 3 ? "lg:basis-1/3" : "lg:basis-1/2"
                    )}
                  >
                    <div className="h-full">
                      <FeatureCard feature={feature} index={index} />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <div className={cn("hidden md:block", visibleFeatures.length <= 3 && "lg:hidden")}>
                <CarouselPrevious className="-left-4 lg:-left-12" />
                <CarouselNext className="-right-4 lg:-right-12" />
              </div>
            </Carousel>
          )}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ feature, index }: { feature: typeof features[0], index: number }) {
  return (
    <SpotlightCard
      className="flex flex-col h-full bg-card/50 border-input"
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
          asChild={feature.available}
          disabled={!feature.available}
        >
          {feature.available ? (
            <Link to={feature.href}>
              {feature.cta}
              <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
            </Link>
          ) : (
            <span>{feature.cta}</span>
          )}
        </Button>
      </div>
    </SpotlightCard>
  );
}
