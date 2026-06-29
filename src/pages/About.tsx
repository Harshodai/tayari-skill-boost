import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Target, Heart, Lightbulb, Users, Globe, Rocket } from "lucide-react";
import { Link } from "react-router-dom";

const About = () => {
  const values = [
    {
      icon: Target,
      title: "Mission-Driven",
      description: "We're committed to making career success accessible to everyone, regardless of background."
    },
    {
      icon: Heart,
      title: "User First",
      description: "Every feature we build starts with understanding what job seekers truly need."
    },
    {
      icon: Lightbulb,
      title: "Innovation",
      description: "We leverage cutting-edge AI to solve real problems in the job search process."
    },
    {
      icon: Users,
      title: "Community",
      description: "We believe in the power of shared knowledge and mutual support."
    },
    {
      icon: Globe,
      title: "Accessibility",
      description: "Our tools are designed to work for job seekers across Africa and beyond."
    },
    {
      icon: Rocket,
      title: "Growth",
      description: "We help you not just find a job, but build a fulfilling career."
    }
  ];

  const stats = [
    { value: "50K+", label: "Resumes Optimized" },
    { value: "85%", label: "Interview Rate Increase" },
    { value: "40+", label: "Countries Served" },
    { value: "4.9", label: "User Rating" }
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-hero">
        {/* Hero Section */}
        <section className="py-20">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              About <span className="text-gradient">Job Tayari</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              We're on a mission to democratize career success by giving every job seeker access to
              the same AI-powered tools that top candidates use.
            </p>
          </div>
        </section>

        {/* Positioning Section — the chain, not the suite */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto glass rounded-2xl p-8 md:p-12 border border-border">
              <h2 className="text-3xl font-bold mb-6 text-center">We're the chain, not the suite</h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  Most career tools are point solutions — a resume scanner, a tracker, an interview
                  mock, an auto-apply bot. You stitch them together, and they don't talk to each
                  other. Job Tayari is the only platform that runs the <strong>whole chain — resume
                  to interview — as one observable pipeline you can watch execute</strong>.
                </p>
                <p>
                  Upload your resume, see an honest per-ATS score with a confidence band, let the
                  reflective optimizer iterate against its own quality gate, match against live
                  multi-board job scraping, generate a tailored cover letter, gate every application
                  behind a visible authenticity check, then carry the tailored resume + job description
                  straight into structured interview prep and follow-up communication. One process
                  graph. Every stage's output is the next stage's input.
                </p>
                <p>
                  Guardrails keep every application on the authentic side of the AI-vs-recruiter arms
                  race — keyword-stuffing detection, PII redaction, and truthfulness checks run
                  <em> before</em> you submit, not after. And the whole platform is self-hostable with
                  a local LLM, so your data never has to leave your machine.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Story Section */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto glass rounded-2xl p-8 md:p-12 border border-border">
              <h2 className="text-3xl font-bold mb-6 text-center">Our Story</h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  Job Tayari was born from a simple observation: talented people were being overlooked 
                  not because they lacked skills, but because their resumes weren't optimized for modern 
                  hiring systems.
                </p>
                <p>
                  "Tayari" means "ready" in Swahili, and that's exactly what we help you become – 
                  ready to showcase your true potential. We built an AI-powered platform that analyzes 
                  resumes the same way recruiters and Applicant Tracking Systems (ATS) do.
                </p>
                <p>
                  Today, we've helped thousands of job seekers across the globe transform their 
                  applications and land interviews at their dream companies. But we're just getting 
                  started.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
              {stats.map((stat, index) => (
                <div 
                  key={index} 
                  className="glass rounded-xl p-6 border border-border text-center card-hover"
                >
                  <div className="text-3xl md:text-4xl font-bold text-gradient mb-2">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">
              Our <span className="text-gradient">Values</span>
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {values.map((value, index) => (
                <div 
                  key={index} 
                  className="glass rounded-xl p-6 border border-border card-hover"
                >
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <value.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{value.title}</h3>
                  <p className="text-muted-foreground text-sm">{value.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20">
          <div className="container mx-auto px-4 text-center">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-3xl font-bold mb-4">
                Ready to Transform Your Career?
              </h2>
              <p className="text-muted-foreground mb-8">
                Join thousands of job seekers who've already boosted their chances with Job Tayari.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" asChild>
                  <Link to="/auth">Get Started Free</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/careers">Join Our Team</Link>
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
