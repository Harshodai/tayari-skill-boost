import { Link } from "react-router-dom";
import { CardHeader, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { FileText, Mic, Code, Swords, Search, Target, Check, ArrowRight } from "lucide-react";

const products = [
  {
    icon: FileText,
    title: "Resume Optimizer",
    description: "Parse job requirements and tailor your technical experience against role keywords and section heuristics.",
    features: [
      "Keyword & heuristic analysis",
      "Role requirements matching",
      "Section-level scoring",
      "Evidence-based improvement suggestions",
      "Clean, parseable templates",
      "Export to PDF/DOCX",
    ],
    href: "/resume",
    cta: "Optimize Your Resume",
    available: true,
  },
  {
    icon: Mic,
    title: "Mock Interview",
    description: "Practice behavioral and system design prompts with structured STAR feedback and timing benchmarks.",
    features: [
      "Structured STAR prep",
      "Behavioral rubrics",
      "System design practice",
      "Objective feedback",
      "Confidence metrics",
      "Role-specific scenarios",
    ],
    href: "/interview",
    cta: "Start Mock Interview",
    available: false,
  },
  {
    icon: Swords,
    title: "Clash of Code",
    description: "Test your algorithm speed and clean-code implementation under timed evaluation constraints.",
    features: [
      "Timed coding exercises",
      "Multiple language runtimes",
      "Automated test suites",
      "Time-space complexity analysis",
      "Peer benchmarking",
      "Problem categorization",
    ],
    href: "/interview",
    cta: "Enter the Arena",
    available: false,
  },
  {
    icon: Code,
    title: "Practice Problems",
    description: "Curated data structure and algorithm problems mapped to technical interview competencies.",
    features: [
      "Curated problem sets",
      "Difficulty calibration",
      "Topic categorization",
      "Detailed test cases",
      "In-browser workspace",
      "Step-by-step breakdowns",
    ],
    href: "/interview",
    cta: "Start Practicing",
    available: false,
  },
  {
    icon: Search,
    title: "Job Search Engine",
    description: "Filter verified engineering roles with transparent tech stacks, compensation ranges, and calibrated fit.",
    features: [
      "Calibrated skill matching",
      "Verified job postings",
      "Compensation insights",
      "Application stage tracking",
      "Remote & location filters",
      "Deterministic alerts",
    ],
    href: "/jobs",
    cta: "Find Your Job",
    available: true,
  },
  {
    icon: Target,
    title: "Career Roadmap",
    description: "Map out targeted technical competencies and milestones for your next seniority level or transition.",
    features: [
      "Skill gap identification",
      "Curated documentation links",
      "Milestone tracking",
      "Role progression paths",
      "Framework updates",
      "Measurable competency checks",
    ],
    href: "/roadmap",
    cta: "Plan Your Career",
    available: true,
  },
];

export function ProductsSection() {
  return (
    <section className="py-20 lg:py-28 bg-card/25 border-y border-border/40">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-section font-bold text-foreground mb-4 font-display text-balance tracking-tight">
            Our Products
          </h2>
          <p className="text-muted-foreground text-lg text-balance">
            A growing suite of tools for software engineers to organize preparation, applications, and reviewable career workflows.
          </p>
        </div>

        {/* Product Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {products.map((product, index) => (
            <SpotlightCard
              key={product.title}
              className="flex flex-col h-full bg-card/45 border-input animate-fade-in-up"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              {/* Card Header with unified icon style */}
              <div className="p-6 pb-0 flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary shrink-0">
                    <product.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 font-display">
                      {product.title}
                      {!product.available && (
                        <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20">
                          Soon
                        </span>
                      )}
                    </h3>
                  </div>
                </div>
              </div>

              <CardHeader className="pb-0 pt-4">
                <CardDescription className="text-sm leading-relaxed text-muted-foreground">
                  {product.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1 pt-4">
                <ul className="space-y-2">
                  {product.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Check className="w-4 h-4 text-success flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="mt-auto pt-4">
                <Button
                  variant={product.available ? "default" : "outline"}
                  className="w-full group active:scale-[0.98]"
                  asChild={product.available}
                  disabled={!product.available}
                >
                  {product.available ? (
                    <Link to={product.href}>
                      {product.cta}
                      <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                    </Link>
                  ) : (null)}
                </Button>
              </CardFooter>
            </SpotlightCard>
          ))}
        </div>
      </div>
    </section>
  );
}

