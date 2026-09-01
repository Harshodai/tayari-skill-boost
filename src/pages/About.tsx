import { Seo } from "@/components/seo/Seo";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { ShieldCheck, GitFork, Lock, Shield, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const About = () => {
  const principles = [
    {
      icon: ShieldCheck,
      title: "Candidate-in-the-Loop",
      description: "Every application artifact, cover letter draft, and submission requires candidate review before dispatch. No black boxes."
    },
    {
      icon: GitFork,
      title: "Provenance Over Automation",
      description: "Clear traceability from job description requirements to resume bullet points and verified application receipts."
    },
    {
      icon: Lock,
      title: "Local-First Data Ownership",
      description: "Your career history and personal data remain under your custody with private LLM support and client-side storage."
    },
    {
      icon: Shield,
      title: "Anti-Ghost Verification",
      description: "Heuristic scoring and freshness verification to prevent wasted time on stale, phantom, or compliance-only job listings."
    }
  ];

  const capabilities = [
    { value: "100%", label: "Candidate Review", sub: "No blind submissions" },
    { value: "AST", label: "Structured Parsing", sub: "Deterministic schema" },
    { value: "STAR", label: "Behavioral Prep", sub: "Evidence-based framework" },
    { value: "Local", label: "Private LLM Ready", sub: "Self-hostable offline pipeline" }
  ];

  return (
    <Layout>
      <Seo
        title="About Job Tayari — Our Approach to AI Career Tooling"
        description="Why Job Tayari exists, how the glass-box agent pipeline works, and the principles behind our privacy-first, self-hostable career platform."
        path="/about"
      />
      <div className="min-h-screen bg-gradient-hero py-12 md:py-20">
        {/* Hero Section */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4 text-center">
            <h1 className="font-display text-balance text-4xl md:text-6xl font-bold mb-6 tracking-tight">
              About <span className="text-gradient">Job Tayari</span>
            </h1>
            <p className="text-balance text-lg md:text-xl text-muted-foreground max-w-prose mx-auto mb-8 leading-relaxed">
              We build observable, candidate-controlled career workflows for software engineers.
              No fabricated metrics, no uninspected automation, and no black boxes.
            </p>
          </div>
        </section>

        {/* System Capabilities Section (Authentic Architecture Points) */}
        <section className="py-8 md:py-12">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
              {capabilities.map((cap, index) => (
                <div 
                  key={index} 
                  className="glass rounded-xl p-6 border border-border text-center card-hover"
                >
                  <div className="text-3xl md:text-4xl font-bold font-mono tabular-nums text-gradient mb-1">
                    {cap.value}
                  </div>
                  <div className="text-sm font-semibold text-foreground">{cap.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{cap.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Positioning Section — the chain, not the suite */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto glass rounded-2xl p-8 md:p-12 border border-border">
              <h2 className="font-display text-balance text-2xl md:text-3xl font-bold mb-6 text-center tracking-tight">
                We're the chain, not the suite
              </h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed max-w-prose mx-auto text-balance">
                <p>
                  Most career tools are disconnected point solutions—a resume scanner, a separate spreadsheet,
                  a mock interview bot. Job Tayari runs the <strong>whole chain—resume to interview—as one
                  observable pipeline you can watch execute</strong>.
                </p>
                <p>
                  Upload your resume, inspect section-by-section scoring against requirements, let the
                  reflective optimizer suggest role-specific revisions, verify live job postings, and carry
                  approved artifacts into structured STAR interview prep. One process graph where every stage's
                  output feeds the next.
                </p>
                <p>
                  Guardrails keep every application verifiable: keyword-stuffing detection, PII redaction, and
                  truthfulness checks run <em>before</em> you submit, not after. The platform is designed to be
                  self-hostable with a local LLM so your personal data stays under your custody.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Core Principles */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-balance text-2xl md:text-3xl font-bold text-center mb-12 tracking-tight">
              Our Core <span className="text-gradient">Principles</span>
            </h2>
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {principles.map((principle, index) => (
                <div 
                  key={index} 
                  className="glass rounded-xl p-6 border border-border card-hover flex flex-col justify-between"
                >
                  <div>
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 text-primary">
                      <principle.icon className="w-6 h-6" />
                    </div>
                    <h3 className="font-display text-lg font-semibold mb-2 text-foreground">{principle.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{principle.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Story Section */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto glass rounded-2xl p-8 md:p-12 border border-border">
              <h2 className="font-display text-balance text-2xl md:text-3xl font-bold mb-6 text-center tracking-tight">
                Our Story
              </h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed max-w-prose mx-auto text-balance">
                <p>
                  Job Tayari was founded on a simple observation: talented engineers were being filtered out
                  not because they lacked technical capability, but because resume parsing heuristics and
                  applicant tracking systems operate on specific keyword patterns.
                </p>
                <p>
                  "Tayari" means "ready" in Swahili. We built Job Tayari to give candidates the tools to prepare,
                  tailor, and inspect their application materials with full transparency, ensuring every claim
                  is backed by genuine experience.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4 text-center">
            <div className="max-w-prose mx-auto">
              <h2 className="font-display text-balance text-3xl font-bold mb-4 tracking-tight">
                Ready to take control of your search?
              </h2>
              <p className="text-balance text-muted-foreground mb-8">
                Build an inspectable, candidate-in-the-loop workflow tailored to your target engineering roles.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" asChild className="active:scale-[0.98]">
                  <Link to="/auth">
                    Get Started Free <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="active:scale-[0.98]">
                  <Link to="/free-scan">Try Free ATS Scan</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default About;

