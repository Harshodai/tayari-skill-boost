import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { Button } from "@/components/ui/button";
import { FileText, MessageSquare, Briefcase, ArrowRight } from "lucide-react";
import { settings, features as featureFlags } from "@/config/features";
import {
  Carousel,
  CarouselApi,
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
    available: featureFlags.resumeOptimizer,
    visible: featureFlags.resumeOptimizer,
  },
  {
    icon: MessageSquare,
    title: "Interview Prep",
    description: "Practice with AI-powered mock interviews, compete in coding challenges, and master technical questions.",
    href: "/interview",
    cta: "Start Practicing",
    available: featureFlags.interviewPrep,
    visible: settings.showFullProductsSection, // Controlled by feature flags
  },
  {
    icon: Briefcase,
    title: "Job Matcher",
    description: "Get personalized job recommendations based on your skills, experience, and career preferences.",
    href: "/jobs",
    cta: "Find Jobs",
    available: featureFlags.jobSearch,
    visible: settings.showFullProductsSection, // Controlled by feature flags
  },
];

import { FadeIn, SlideUp, StaggerContainer } from "@/components/ui/motion";

// ... existing imports

export function FeaturesSection() {
  const visibleFeatures = features.filter(f => f.visible);
  const isSingleFeature = visibleFeatures.length === 1;
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!api) {
      return;
    }

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1);
    });
  }, [api]);

  return (
    <section className="py-20 lg:py-28">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <SlideUp>
            <h2 className="text-section font-bold text-foreground mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-muted-foreground text-lg">
              Our AI-powered tools help you prepare for every step of your job search journey.
            </p>
          </SlideUp>
        </div>

        {/* Feature Cards - Dynamic Layout */}
        <div className={cn(
          "mx-auto",
          isSingleFeature ? "max-w-md" : "max-w-6xl"
        )}>
          {isSingleFeature ? (
            // Single Feature - Centered & Premium
            <div className="flex justify-center">
              <FadeIn delay={0.2}>
                <FeatureCard feature={visibleFeatures[0]} index={0} />
              </FadeIn>
            </div>
          ) : (
            // Multiple Features - Carousel for sliding/dragging UX
            <SlideUp delay={0.2}>
              <Carousel
                setApi={setApi}
                opts={{
                  align: "start",
                  loop: false,
                  dragFree: false,
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
                <div className={cn("block", visibleFeatures.length <= 3 && "lg:hidden")}>
                  <CarouselPrevious className="-left-4 lg:-left-12" />
                  <CarouselNext className="-right-4 lg:-right-12" />
                </div>
                <div className="flex justify-center gap-2 mt-8">
                  {Array.from({ length: count }).map((_, index) => (
                    <button
                      key={index}
                      className={cn(
                        "h-2 rounded-full transition-all duration-300",
                        current === index + 1 ? "bg-primary w-8" : "bg-primary/20 w-2 hover:bg-primary/40"
                      )}
                      onClick={() => api?.scrollTo(index)}
                      aria-label={`Go to slide ${index + 1}`}
                    />
                  ))}
                </div>
              </Carousel>
            </SlideUp>
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
