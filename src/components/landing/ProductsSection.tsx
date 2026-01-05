import { Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Mic, Code, Swords, Search, Target, Check, ArrowRight } from "lucide-react";

const products = [
  {
    icon: FileText,
    title: "Resume Optimizer",
    description: "Transform your resume into an ATS-friendly powerhouse that gets noticed by recruiters.",
    features: [
      "AI-powered resume analysis",
      "Job description matching",
      "Section-by-section scoring",
      "Actionable improvement tips",
      "Professional templates",
      "Export to PDF/DOCX",
    ],
    href: "/resume",
    cta: "Optimize Your Resume",
    available: true,
    gradient: "from-primary to-primary-dark",
  },
  {
    icon: Mic,
    title: "Mock Interview",
    description: "Practice with AI interviewers that simulate real technical and behavioral interviews.",
    features: [
      "AI-powered conversations",
      "Behavioral questions",
      "System design practice",
      "Real-time feedback",
      "Performance analytics",
      "Custom scenarios",
    ],
    href: "/interview",
    cta: "Start Mock Interview",
    available: false,
    gradient: "from-secondary to-success",
  },
  {
    icon: Swords,
    title: "Clash of Code",
    description: "Compete in real-time coding battles against other developers to sharpen your skills.",
    features: [
      "Real-time competitions",
      "Multiple languages",
      "Leaderboards",
      "Time-based challenges",
      "Code review",
      "Skill rankings",
    ],
    href: "/interview",
    cta: "Enter the Arena",
    available: false,
    gradient: "from-warning to-destructive",
  },
  {
    icon: Code,
    title: "Practice Problems",
    description: "Master data structures and algorithms with our curated collection of coding challenges.",
    features: [
      "500+ problems",
      "Difficulty levels",
      "Company tags",
      "Solution explanations",
      "Code editor",
      "Test cases",
    ],
    href: "/interview",
    cta: "Start Practicing",
    available: false,
    gradient: "from-primary to-secondary",
  },
  {
    icon: Search,
    title: "Job Search Engine",
    description: "Discover opportunities that match your skills, experience, and career goals.",
    features: [
      "Personalized matches",
      "Salary insights",
      "Company reviews",
      "Application tracking",
      "Remote filters",
      "Alerts & notifications",
    ],
    href: "/jobs",
    cta: "Find Your Job",
    available: false,
    gradient: "from-secondary to-primary",
  },
  {
    icon: Target,
    title: "Career Roadmap",
    description: "Get a personalized learning path to reach your dream role in tech.",
    features: [
      "Skill gap analysis",
      "Learning resources",
      "Goal tracking",
      "Mentor matching",
      "Progress insights",
      "Industry trends",
    ],
    href: "/roadmap",
    cta: "Plan Your Career",
    available: false,
    gradient: "from-primary-dark to-primary",
  },
];

export function ProductsSection() {
  return (
    <section className="py-20 lg:py-28 bg-card/50">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-section font-bold text-foreground mb-4">
            Our Products
          </h2>
          <p className="text-muted-foreground text-lg">
            A complete suite of tools designed specifically for software engineers to land their dream jobs.
          </p>
        </div>

        {/* Product Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {products.map((product, index) => (
            <Card 
              key={product.title} 
              className="flex flex-col overflow-hidden animate-fade-in-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Card Header with Gradient */}
              <div className={`bg-gradient-to-r ${product.gradient} p-6`}>
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-background/20 backdrop-blur-sm">
                    <product.icon className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-primary-foreground flex items-center gap-2">
                      {product.title}
                      {!product.available && (
                        <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-background/20 text-primary-foreground/80">
                          Soon
                        </span>
                      )}
                    </h3>
                  </div>
                </div>
              </div>

              <CardHeader className="pb-0">
                <CardDescription className="text-base">
                  {product.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1 pt-4">
                <ul className="space-y-2">
                  {product.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-success flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button 
                  variant={product.available ? "default" : "outline"} 
                  className="w-full group"
                  asChild
                >
                  <Link to={product.href}>
                    {product.cta}
                    <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
