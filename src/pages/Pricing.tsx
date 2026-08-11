import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Check,
  Zap,
  ShieldCheck,
  Send,
  Building2,
  Loader2,
  Mail,
  Clock,
  Receipt,
  Infinity as InfinityIcon,
  X,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { toast } from "sonner";

const Pricing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [contactEmail, setContactEmail] = useState("");

  // TODO(backend): routes_billing.go's handleCreateCheckoutSession expects a `plan` key
  // and builds a Stripe Subscription checkout. Credit packs are one-time payments, so
  // billing.BillingService needs a CreateCreditPackCheckoutSession(user_id, pack_slug, return_url)
  // path that uses Stripe Checkout in `mode=payment` with a Price ID per pack, plus a webhook
  // branch that credits the user's balance on `checkout.session.completed` instead of
  // `invoice.paid`. Until that lands, the paid-pack buttons below still POST `plan` and will
  // create a subscription — treat this page as the pricing model of record, not a wired funnel.
  // The paid tiers are therefore gated off (PAID_CHECKOUT_IMPLEMENTED = false) so no one can
  // accidentally subscribe; only the free tier stays fully functional.
  const PAID_CHECKOUT_IMPLEMENTED = false;
  const handleCheckout = async (planKey: string) => {
    if (!user) {
      navigate(`/auth?plan=${planKey}`);
      return;
    }

    if (planKey === "free") {
      navigate("/dashboard");
      return;
    }

    // // ponytail: paid credit-pack checkout is not wired up yet — refuse to
    // POST `plan` (which would create a subscription, wrong for credit packs).
    if (!PAID_CHECKOUT_IMPLEMENTED) {
      toast.info("Credit packs are coming soon — checkout isn't wired up yet.");
      return;
    }

    setLoadingPlan(planKey);
    try {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/api/v1/billing/create-checkout-session", {
        method: "POST",
        headers,
        body: JSON.stringify({
          plan: planKey,
          return_url: window.location.origin + "/pricing",
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Checkout initiation failed" }));
        throw new Error(err.error || "Failed to start Stripe checkout");
      }

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.success("Self-hosted mode: pack unlocked automatically!");
        navigate("/dashboard");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to launch payment checkout");
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleContactSales = async () => {
    if (!contactEmail.trim() || !contactEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    try {
      const response = await fetch("/api/v1/waitlist/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: contactEmail.trim(), tier: "institutions" }),
      });
      if (!response.ok) throw new Error("Failed to submit");
      toast.success("Thanks — we'll reach out within one business day.");
      setContactEmail("");
    } catch {
      // ponytail: keep the entered email on failure — a failed submit is
      // transient and the user should retry without retyping; reporting
      // success for a failed request is a lie.
      toast.error("We couldn't reach the waitlist service. Your email was not submitted — try again in a moment.");
    }
  };

  const tiers = [
    {
      key: "free",
      name: "Free Forever",
      price: "$0",
      period: "no card required",
      description: "Everything you need to run a serious search. Free, permanently. This is the wedge.",
      icon: Zap,
      features: [
        "Job tracking board",
        "Resume tailoring vs. any JD",
        "Ghost-job screening",
        "ATS scoring + breakdown",
        "Standard templates",
        "Community support",
      ],
      cta: user ? "Current Plan" : "Get Started",
      highlighted: false,
      note: null,
      comingSoon: false,
    },
    {
      key: "verified-pack",
      name: "Verified Applications",
      price: "$39",
      period: "40 credits · one-time",
      description: "Pay for proof, not for hope. A credit burns only when a submission produces a receipt.",
      icon: ShieldCheck,
      features: [
        "40 verified application credits",
        "Credit consumed only on a receipted submission",
        "Receipt covers verified, unverified, or failed — the point is proof exists",
        "Credits never expire",
        "Everything in Free, included",
        "Priority queue processing",
      ],
      cta: "Buy 40 Credits",
      highlighted: true,
      note: "Self-limiting by design",
      comingSoon: true,
    },
    {
      key: "outreach-pack",
      name: "Outreach Credits",
      price: "$19",
      period: "60 credits · one-time",
      description: "For cold emails, connection requests, and referral drafts that actually get sent.",
      icon: Send,
      features: [
        "60 outreach credits",
        "Cold emails, LinkedIn notes, referral drafts",
        "Credits never expire",
        "Everything in Free, included",
        "Email support",
      ],
      cta: "Buy 60 Credits",
      highlighted: false,
      note: "No monthly clock",
      comingSoon: true,
    },
  ];

  const faqs = [
    {
      question: "Do credits expire?",
      answer:
        "No. Credits never expire. Buy a pack, use it over whatever timeline your search actually takes — a week, a quarter, a year. You paid for the work, not for calendar access.",
    },
    {
      question: "What exactly counts as a 'verified application'?",
      answer:
        "A credit is consumed only when a submission produces a receipt — verified, unverified, or failed. The point is that a receipt exists: you're paying for proof that a real submission happened, not for the hope of an auto-apply. No receipt, no charge.",
    },
    {
      question: "Why credits instead of a subscription?",
      answer:
        "Subscriptions meter calendar time; credits meter work. Every subscription rival (Teal, Huntr, Simplify) earns its 1-star reviews on cancellation friction and the monthly clock. Credits sidestep that entirely — there's nothing to cancel, nothing to chase. Unused credits are refundable within 7 days; used credits are receipted work.",
    },
    {
      question: "Is tracking really free forever?",
      answer:
        "Yes. Job tracking, resume tailoring, ghost-job screening, and ATS scoring are free forever, no card required. That's the acquisition wedge. We only charge for verified submissions and outreach — the things nobody else can prove.",
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept all major credit cards, PayPal, and M-Pesa for users in East Africa.",
    },
    {
      question: "Can I get a refund if the credits don't work for me?",
      answer:
        "Unused credits are refundable within 7 days of purchase. Used credits are not — a receipt is a receipt. This is the honesty of the model: we charge for outcomes, not for access you can claw back.",
    },
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-hero py-20">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Pay for <span className="text-gradient">Proof</span>, Not Access
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Tracking and resume tailoring are free forever. You only pay when a submission produces a receipt.
              No monthly clock, no cancellation friction.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-20">
            {tiers.map((tier, index) => (
              <div
                key={index}
                className={`relative rounded-2xl p-8 border transition-all duration-300 ${
                  tier.highlighted
                    ? "bg-gradient-to-b from-primary/20 to-card border-primary glow-primary scale-105"
                    : "glass border-border hover:border-primary/50"
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-sm font-medium px-4 py-1 rounded-full">
                      The thing nobody else sells
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      tier.highlighted ? "bg-primary" : "bg-primary/10"
                    }`}
                  >
                    <tier.icon
                      className={`w-5 h-5 ${tier.highlighted ? "text-primary-foreground" : "text-primary"}`}
                    />
                  </div>
                  <h3 className="text-xl font-bold">{tier.name}</h3>
                </div>

                <div className="mb-2">
                  <span className="text-4xl font-bold">{tier.price}</span>
                  <span className="text-muted-foreground ml-2 text-sm">/{tier.period}</span>
                </div>

                <p className="text-muted-foreground mb-6 text-sm">{tier.description}</p>

                {tier.note && (
                  <div className="mb-6 flex items-center gap-2 text-xs text-primary">
                    <InfinityIcon className="w-3.5 h-3.5" />
                    <span>{tier.note}</span>
                  </div>
                )}

                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                      <span className="text-foreground/90 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full ${
                    tier.highlighted
                      ? "bg-primary hover:bg-primary/90"
                      : "bg-card hover:bg-accent border border-border"
                  }`}
                  disabled={Boolean(
                    loadingPlan === tier.key ||
                      (user && tier.key === "free") ||
                      (tier.key !== "free" && !PAID_CHECKOUT_IMPLEMENTED),
                  )}
                  onClick={() => handleCheckout(tier.key)}
                >
                  {loadingPlan === tier.key ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  {tier.cta}
                </Button>
                {tier.comingSoon ? (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Checkout coming soon — pricing model of record, not a wired funnel.
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          {/* Why Credits, Not Subscriptions */}
          <div className="max-w-4xl mx-auto mb-20">
            <h2 className="text-3xl font-bold text-center mb-10">
              Why <span className="text-gradient">Credits</span>, Not Subscriptions?
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="glass rounded-2xl p-6 border border-border/50">
                <div className="flex items-center gap-2 mb-3">
                  <Receipt className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-sm">You pay for outcomes</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Subscriptions meter calendar time; credits meter work. You pay for verified submissions, not for
                  access that ticks down while you sleep.
                </p>
              </div>
              <div className="glass rounded-2xl p-6 border border-border/50">
                <div className="flex items-center gap-2 mb-3">
                  <X className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-sm">No cancellation friction</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  The #1 complaint against Teal, Huntr, and Simplify is the monthly clock and the refund runaround.
                  One-time packs mean there's nothing to cancel and nothing to chase.
                </p>
              </div>
              <div className="glass rounded-2xl p-6 border border-border/50">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-sm">Self-limiting by design</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  You can't burn 500 credits in a week, because each one requires a real, receipted submission. The
                  model refuses the auto-apply spam that gets rival tools banned.
                </p>
              </div>
            </div>
          </div>

          {/* Institutions / Contact Sales */}
          <div className="max-w-4xl mx-auto mb-20 p-8 rounded-2xl border border-border bg-gradient-to-r from-card via-card to-primary/5">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">For Institutions</h3>
                </div>
                <p className="text-muted-foreground mb-4 text-sm">
                  Outplacement firms, university career centers, and bootcamps. Multi-tenant cohorts, dashboards, and
                  SSO. Let's talk about volume pricing and verified-submission reporting for your cohorts.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success flex-shrink-0" />
                    Cohort dashboards with per-job-seeker receipts
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success flex-shrink-0" />
                    SSO + multi-tenant admin
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success flex-shrink-0" />
                    Volume credit pricing
                  </li>
                </ul>
              </div>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleContactSales();
                }}
              >
                <div className="flex gap-2">
                  <label htmlFor="contact-sales-email" className="sr-only">
                    Work email for contact sales
                  </label>
                  <input
                    id="contact-sales-email"
                    type="email"
                    placeholder="work@email.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <Button type="submit" size="sm" className="bg-primary hover:bg-primary/90">
                    <Mail className="w-4 h-4 mr-1" />
                    Contact Us
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  We'll respond within one business day with a tailored proposal.
                </p>
              </form>
            </div>
          </div>

          {/* Trust Banner (aligned to credit model) */}
          <div className="max-w-4xl mx-auto mb-16 p-6 rounded-2xl border border-border bg-gradient-to-r from-card via-card to-primary/5 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1">
              <h3 className="font-bold text-base flex items-center gap-2">
                <span className="text-lg">🛡️</span> 7-Day Refund on Unused Credits
              </h3>
              <p className="text-xs text-muted-foreground max-w-xl">
                Unused credits are refundable within 7 days. Used credits aren't — a receipt is a receipt. No
                retention loops, no fine print.
              </p>
            </div>
            <div className="space-y-1 md:text-right">
              <h3 className="font-bold text-base flex items-center gap-2 md:justify-end">
                <Clock className="w-4 h-4" /> No Monthly Clock
              </h3>
              <p className="text-xs text-muted-foreground">
                Credits don't expire. Nothing auto-renews. Nothing to cancel.
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
                  <AccordionContent className="text-muted-foreground pb-4">{faq.answer}</AccordionContent>
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