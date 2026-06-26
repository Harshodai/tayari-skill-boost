import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Check, Zap, Crown, Building2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const Pricing = () => {
  const plans = [
    {
      name: "Free",
      price: "0",
      period: "forever",
      description: "Perfect for getting started with your job search",
      icon: Zap,
      features: [
        "1 resume profile",
        "3 scans per month",
        "5 tailored applications/mo",
        "Basic ATS score analysis",
        "Standard templates",
        "Community support"
      ],
      cta: "Get Started",
      highlighted: false
    },
    {
      name: "Pro",
      price: "19",
      period: "mo (billed annually)",
      description: "Best for active job seekers who want an edge",
      icon: Crown,
      features: [
        "Unlimited resume scans",
        "Advanced ATS scoring breakdown",
        "AI cover letter writer",
        "STAR mock interview prep",
        "50 tailored applications/mo",
        "Email support",
        "Priority queue processing"
      ],
      cta: "Start Free Trial",
      highlighted: true
    },
    {
      name: "Career-Ops",
      price: "79",
      period: "mo (billed annually)",
      description: "Complete pipeline automation for top candidates",
      icon: Building2,
      features: [
        "Everything in Pro",
        "Apply Assist automation queue",
        "Hermes multi-board scraping",
        "Real-time pipeline monitoring",
        "Voice/video mock interview AI",
        "Direct recruiter outreach tools",
        "Dedicated VIP support"
      ],
      cta: "Get Started Now",
      highlighted: false
    }
  ];

  const faqs = [
    {
      question: "Can I cancel my subscription anytime?",
      answer: "Yes, you can cancel your subscription at any time. You'll continue to have access until the end of your billing period."
    },
    {
      question: "Is there a free trial for Pro?",
      answer: "Yes! We offer a 7-day free trial for our Pro plan. No credit card required to start."
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept all major credit cards, PayPal, and M-Pesa for our users in East Africa."
    },
    {
      question: "Can I upgrade or downgrade my plan?",
      answer: "Absolutely. You can change your plan at any time from your account settings."
    }
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-hero py-20">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Simple, Transparent <span className="text-gradient">Pricing</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that fits your career goals. Start free, upgrade when you're ready.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-20">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`relative rounded-2xl p-8 border transition-all duration-300 ${
                  plan.highlighted
                    ? "bg-gradient-to-b from-primary/20 to-card border-primary glow-primary scale-105"
                    : "glass border-border hover:border-primary/50"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-sm font-medium px-4 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    plan.highlighted ? "bg-primary" : "bg-primary/10"
                  }`}>
                    <plan.icon className={`w-5 h-5 ${plan.highlighted ? "text-primary-foreground" : "text-primary"}`} />
                  </div>
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                </div>

                <div className="mb-4">
                  <span className="text-4xl font-bold">
                    {plan.price === "Custom" ? "" : "$"}{plan.price}
                  </span>
                  <span className="text-muted-foreground ml-2">/{plan.period}</span>
                </div>

                <p className="text-muted-foreground mb-6">{plan.description}</p>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-success flex-shrink-0" />
                      <span className="text-foreground/90">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full ${
                    plan.highlighted
                      ? "bg-primary hover:bg-primary/90"
                      : "bg-card hover:bg-accent border border-border"
                  }`}
                  asChild
                >
                  <Link to="/auth">
                    {plan.cta}
                  </Link>
                </Button>
              </div>
            ))}
          </div>

          {/* Trust Banner (Refund & Cancellation) */}
          <div className="max-w-4xl mx-auto mb-16 p-6 rounded-2xl border border-border bg-gradient-to-r from-card via-card to-primary/5 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1">
              <h3 className="font-bold text-base flex items-center gap-2">
                🛡️ 7-Day Money-Back Guarantee
              </h3>
              <p className="text-xs text-muted-foreground max-w-xl">
                Not satisfied with your callback rates? Email us within 7 days of purchase for a 100% refund, no questions asked.
              </p>
            </div>
            <div className="space-y-1 md:text-right">
              <h3 className="font-bold text-base flex items-center gap-2 md:justify-end">
                ⚡ Cancel with One Click
              </h3>
              <p className="text-xs text-muted-foreground">
                Easy cancellation directly from your profile settings. No retention loops, no emails.
              </p>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-10">
              Frequently Asked <span className="text-gradient">Questions</span>
            </h2>
            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, index) => (
                <AccordionItem 
                  key={index} 
                  value={`item-${index}`}
                  className="glass border border-border/50 rounded-xl px-6 animate-fade-in-up"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <AccordionTrigger className="text-left text-foreground hover:text-primary hover:no-underline py-4">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-4">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Pricing;
