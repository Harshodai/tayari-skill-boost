import { Link } from "react-router-dom";
import { CardHover, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, MessageSquare, Briefcase, ArrowRight } from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "Resume Optimizer",
    description: "AI analyzes your resume against job descriptions to maximize your match score and highlight key skills.",
    href: "/resume",
    cta: "Optimize Now",
    available: true,
  },
  {
    icon: MessageSquare,
    title: "Interview Prep",
    description: "Practice with AI-powered mock interviews, compete in coding challenges, and master technical questions.",
    href: "/interview",
    cta: "Start Practicing",
    available: false,
  },
  {
    icon: Briefcase,
    title: "Job Matcher",
    description: "Get personalized job recommendations based on your skills, experience, and career preferences.",
    href: "/jobs",
    cta: "Find Jobs",
    available: false,
  },
];

export function FeaturesSection() {
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
          {features.map((feature, index) => (
            <CardHover 
              key={feature.title} 
              className="flex flex-col animate-fade-in-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardHeader>
                <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 mb-4">
                  <feature.icon className="w-7 h-7 text-primary" />
                </div>
                <CardTitle className="flex items-center gap-2">
                  {feature.title}
                  {!feature.available && (
                    <span className="text-xs font-normal px-2 py-1 rounded-full bg-warning/20 text-warning">
                      Coming Soon
                    </span>
                  )}
                </CardTitle>
                <CardDescription className="text-base">
                  {feature.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1" />
              <CardFooter>
                <Button 
                  variant={feature.available ? "default" : "outline"} 
                  className="w-full group"
                  asChild
                >
                  <Link to={feature.href}>
                    {feature.cta}
                    <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </CardFooter>
            </CardHover>
          ))}
        </div>
      </div>
    </section>
  );
}
