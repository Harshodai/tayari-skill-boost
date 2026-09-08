import { Seo } from "@/components/seo/Seo";
import { apiFetch, apiFetchResponse } from "@/api";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Check,
  ShieldCheck,
  Loader2,
  Mail,
  Clock,
  Receipt,
  X,
  Coins,
  Sparkles,
  Building2,
  Zap,
  Users,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export interface CreditPackItem {
  id: string;
  key: string;
  name: string;
  credits: number;
  price: number;
  priceFormatted: string;
  unitPrice: string;
  description: string;
  popular?: boolean;
  bestValue?: boolean;
  features: string[];
  cta: string;
}

export const DEFAULT_PACKS: CreditPackItem[] = [
  {
    id: "starter",
    key: "starter",
    name: "Starter Pack",
    credits: 10,
    price: 19,
    priceFormatted: "$19",
    unitPrice: "$1.90/sub",
    description: "A focused batch for roles that deserve a considered, verified application workflow.",
    popular: false,
    bestValue: false,
    features: [
      "10 Verified Submissions ($1.90/sub)",
      "ATS confirmation code & receipt proof",
      "1 credit debited ONLY on verified submission",
      "Failed or unverifiable apps = $0.00 / 0 credits",
      "Credits never expire",
      "Resume tailoring & ATS scoring included",
    ],
    cta: "Buy 10 Credits ($19)",
  },
  {
    id: "pro",
    key: "pro",
    name: "Pro Pack",
    credits: 35,
    price: 49,
    priceFormatted: "$49",
    unitPrice: "$1.40/sub",
    description: "A practical batch for an active search across several well-considered roles.",
    popular: true,
    bestValue: false,
    features: [
      "35 Verified Submissions ($1.40/sub)",
      "ATS confirmation code & receipt proof",
      "1 credit debited ONLY on verified submission",
      "Failed or unverifiable apps = $0.00 / 0 credits",
      "Credits never expire",
      "Priority queue processing",
      "Resume tailoring & ATS scoring included",
    ],
    cta: "Buy 35 Credits ($49)",
  },
  {
    id: "power",
    key: "power",
    name: "Power Pack",
    credits: 100,
    price: 99,
    priceFormatted: "$99",
    unitPrice: "$0.99/sub",
    description: "The lowest listed unit cost for a sustained search with a clear review and receipt workflow.",
    popular: false,
    bestValue: true,
    features: [
      "100 Verified Submissions ($0.99/sub)",
      "ATS confirmation code & receipt proof",
      "1 credit debited ONLY on verified submission",
      "Failed or unverifiable apps = $0.00 / 0 credits",
      "Credits never expire",
      "Dedicated priority queue & fast processing",
      "Resume tailoring & ATS scoring included",
    ],
    cta: "Buy 100 Credits ($99)",
  },
];

export interface MonthlyTierItem {
  id: string;
  name: string;
  price: string;
  priceFormatted: string;
  period: string;
  subtitle: string;
  description: string;
  popular?: boolean;
  features: string[];
  cta: string;
  testId: string;
}

export const MONTHLY_TIERS: MonthlyTierItem[] = [
  {
    id: "free",
    name: "Free",
    price: "0",
    priceFormatted: "$0",
    period: "/mo",
    subtitle: "Essential job search toolkit",
    description: "Core AI tools to organize, track, and optimize your job applications.",
    features: [
      "3 AI resume optimizations / mo",
      "Instant ATS reverse scan",
      "Ghost-job detection",
      "Job search tracker",
    ],
    cta: "Start Free",
    testId: "pricing-card-free",
  },
  {
    id: "pro",
    name: "Pro",
    price: "12",
    priceFormatted: "$12",
    period: "/mo",
    popular: true,
    subtitle: "For active job seekers",
    description: "Unlimited reflective AI tailoring, career milestones, and top-tier AI processing speed.",
    features: [
      "Unlimited reflective resume optimizations",
      "Targeted cover letter generation",
      "Career roadmap milestones",
      "Priority AI speed",
      "DOCX & Typst PDF export",
    ],
    cta: "Get Pro ($12/mo)",
    testId: "pricing-card-monthly-pro",
  },
  {
    id: "team",
    name: "Team",
    price: "49",
    priceFormatted: "$49",
    period: "/mo / seat",
    subtitle: "For coaching cohorts & bootcamps",
    description: "Collaborative tools and high-volume candidate resume management.",
    features: [
      "Multi-seat team dashboard",
      "Bulk candidate resume processing",
      "Outplacement analytics",
      "Priority email support",
    ],
    cta: "Get Team ($49/mo)",
    testId: "pricing-card-monthly-team",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    priceFormatted: "Custom",
    period: "",
    subtitle: "For universities & institutions",
    description: "Custom integrations, dedicated enterprise SLA, and white-label candidate workflows.",
    features: [
      "Custom ATS integrations",
      "White-label candidate portal",
      "API access",
      "SSO",
      "Dedicated SLA",
    ],
    cta: "Contact Sales",
    testId: "pricing-card-enterprise",
  },
];

const Pricing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab state: "monthly" (default active) or "packs" (Verified Submission Packs)
  const tabFromQuery = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<string>(
    tabFromQuery === "packs" || tabFromQuery === "credits" ? "packs" : "monthly"
  );

  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [contactEmail, setContactEmail] = useState("");
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [packs, setPacks] = useState<CreditPackItem[]>(DEFAULT_PACKS);
  const [isLoadingCredits, setIsLoadingCredits] = useState(false);
  const [billingEnabled, setBillingEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "packs" || tabParam === "credits") {
      setActiveTab("packs");
    } else if (tabParam === "monthly") {
      setActiveTab("monthly");
    }
  }, [searchParams]);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (val === "monthly") {
          next.delete("tab");
        } else {
          next.set("tab", val);
        }
        return next;
      },
      { replace: true }
    );
  };

  useEffect(() => {
    let mounted = true;

    // Dynamically fetch packs
    apiFetch<any>("/v1/billing/credits/packs")
      .then((res) => {
        if (!mounted) return;
        setBillingEnabled(Array.isArray(res) ? null : res?.billing_enabled === true);
        const rawPacks = Array.isArray(res) ? res : res?.packs;
        if (Array.isArray(rawPacks) && rawPacks.length > 0) {
          const mapped: CreditPackItem[] = rawPacks.map((p: any) => {
            const def = DEFAULT_PACKS.find(
              (d) => d.id === p.id || d.key === p.id || d.name.toLowerCase() === (p.name || "").toLowerCase()
            );
            const price = Number(p.price ?? def?.price ?? 19);
            const credits = Number(p.credits ?? def?.credits ?? 10);
            const unitPrice =
              p.unit_price ||
              p.price_per_submission ||
              def?.unitPrice ||
              `$${(price / (credits || 1)).toFixed(2)}/sub`;

            return {
              id: String(p.id || def?.id || "pack"),
              key: String(p.id || def?.key || "pack"),
              name: String(p.name || def?.name || "Credit Pack"),
              credits,
              price,
              priceFormatted: p.price_formatted || (price ? `$${price}` : def?.priceFormatted || "$19"),
              unitPrice,
              description: String(p.description || def?.description || ""),
              popular: Boolean(p.popular ?? def?.popular),
              bestValue: Boolean(p.best_value ?? def?.bestValue),
              features: Array.isArray(p.features) && p.features.length > 0 ? p.features : def?.features || [],
              cta: String(p.cta || def?.cta || `Buy ${credits} Credits`),
            };
          });
          setPacks(mapped);
        }
      })
      .catch(() => {
        if (mounted) {
          setPacks(DEFAULT_PACKS);
          setBillingEnabled(false);
        }
      });

    // Dynamically fetch user balance if logged in
    if (user) {
      setIsLoadingCredits(true);
      apiFetch<any>("/v1/billing/credits")
        .then((res) => {
          if (!mounted) return;
          const bal =
            typeof res?.balance === "number"
              ? res.balance
              : typeof res?.credits === "number"
              ? res.credits
              : typeof res?.available_credits === "number"
              ? res.available_credits
              : 0;
          setCreditBalance(bal);
        })
        .catch(() => {
          if (mounted) {
            setCreditBalance(0);
          }
        })
        .finally(() => {
          if (mounted) setIsLoadingCredits(false);
        });
    } else {
      setCreditBalance(null);
    }

    return () => {
      mounted = false;
    };
  }, [user]);

  const handleCheckout = async (id: string, billingMode: "subscription" | "one_time") => {
    if (!user) {
      navigate(`/auth?pack=${id}`);
      return;
    }

    setLoadingPlan(`${billingMode}:${id}`);
    try {
      const response = await apiFetchResponse("/v1/billing/create-checkout-session", {
        method: "POST",
        body: JSON.stringify(
          billingMode === "subscription"
            ? {
              plan: id,
              billing_mode: billingMode,
              return_url: window.location.origin + "/pricing",
            }
            : {
              pack_id: id,
              billing_mode: billingMode,
              return_url: window.location.origin + "/pricing",
            }
        ),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Checkout initiation failed" }));
        throw new Error(err.error || "Failed to start checkout");
      }

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Billing provider did not return a checkout URL; purchase not completed.");
      }
    } catch (err: any) {
      toast.error(err.message || "Payment checkout is unavailable; no purchase was completed.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleMonthlyTierAction = (tier: MonthlyTierItem) => {
    if (tier.id === "free") {
      navigate(user ? "/dashboard" : "/auth");
      return;
    }

    if (tier.id === "pro") {
      if (!user) {
        navigate("/auth?plan=pro");
        return;
      }
      handleCheckout("pro", "subscription");
      return;
    }

    if (tier.id === "team") {
      if (!user) {
        navigate("/auth?plan=team");
        return;
      }
      handleCheckout("team", "subscription");
      return;
    }

    if (tier.id === "enterprise") {
      const el = document.getElementById("contact-sales-section");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        const input = document.getElementById("contact-sales-email");
        if (input) {
          input.focus();
        }
      }
      return;
    }
  };

  const handleContactSales = async () => {
    if (!contactEmail.trim() || !contactEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    try {
      const response = await apiFetchResponse("/v1/waitlist/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: contactEmail.trim(), tier: "institutions" }),
      });
      if (!response.ok) throw new Error("Failed to submit");
      toast.success("Thanks — we'll reach out within one business day.");
      setContactEmail("");
    } catch {
      toast.error("We couldn't reach the waitlist service. Your email was not submitted — try again in a moment.");
    }
  };

  const faqs = [
    {
      question: "What is the difference between Monthly Plans and Verified Submission Packs?",
      answer:
        "Monthly Plans provide continuous access to our full AI career suite — including unlimited reflective resume optimizations, reverse ATS scans, cover letters, and career roadmapping. Verified Submission Packs are pay-per-application credits used exclusively when our verified agent automates and verifies a completed application with an ATS confirmation code.",
    },
    {
      question: "How does the Zero-Risk Verified Submission Guarantee work?",
      answer:
        "1 Credit is debited ONLY when a verified submission receipt with ATS confirmation code is generated. If an application fails, encounters a site error, or produces an unverified result without ATS confirmation, it is $0.00 / 0 credits charged. You only pay for proven, completed submissions.",
    },
    {
      question: "Do submission credits expire?",
      answer:
        "No. Credits never expire. Buy a pack today and use it over whatever timeline your job search takes — weeks, months, or years. You pay for outcomes, not calendar access.",
    },
    {
      question: "Why Credit Packs instead of Monthly Subscriptions for applications?",
      answer:
        "Application volume fluctuates. Credit packs meter actual verified outcomes so you never pay for idle calendar time when you aren't applying. There is no recurring charge, nothing to cancel, and no hidden renewal friction.",
    },
    {
      question: "What core features are free forever?",
      answer:
        "Job search tracking board, 3 monthly AI resume optimizations, instant ATS reverse scanning, ghost-job screening, and match scoring are 100% free with no credit card required.",
    },
    {
      question: "Can I get a refund for unused credits?",
      answer:
        "Yes. Unused credits are refundable within 7 days of purchase. Used credits correspond to completed, receipt-verified submissions and cannot be refunded.",
    },
    {
      question: "What payment methods do you accept?",
      answer:
        "Checkout currently accepts card payments through Stripe when billing is enabled for the deployment. Other payment methods are not promised unless explicitly shown by the configured Stripe Checkout session.",
    },
  ];

  return (
    <Layout>
      <Seo
        title="Job Tayari Pricing — Monthly Plans & Verified Submission Packs"
        description="Choose a flexible monthly plan for AI resume optimization and job tracking, or purchase pay-per-application credit packs for verified ATS job submissions."
        path="/pricing"
      />
      <div className="min-h-screen bg-gradient-hero py-20">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-10">
            {billingEnabled === false && (
              <div
                data-testid="billing-unavailable"
                role="status"
                className="mx-auto mb-6 max-w-2xl rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200"
              >
                Billing is not enabled for this deployment. Credit packs and paid plans are shown for reference; no purchase can be completed here.
              </div>
            )}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold mb-4">
              <Sparkles className="w-3.5 h-3.5" /> Flexible Plans & Verified Submission Credits
            </div>
            <h1 className="font-display text-balance text-4xl md:text-5xl font-bold mb-4 tracking-tight">
              Pay for Proof, Career Growth, & <span className="text-gradient">Real Outcomes</span>
            </h1>
            <p className="text-balance text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Choose an all-inclusive monthly plan for ongoing search tools, or purchase pay-per-application packs where you only pay when an ATS receipt is verified.
            </p>

            {/* User credit balance callout (shown for logged-in users) */}
            {user && (
              <div
                data-testid="user-credit-balance"
                className="mt-6 inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-card border border-border shadow-sm text-sm"
              >
                <Sparkles className="w-4 h-4 text-success" />
                <span>
                  Your Balance:{" "}
                  <strong className="text-foreground tabular-nums">
                    {isLoadingCredits ? "Loading..." : `${creditBalance ?? 0} Verified Submission Credits`}
                  </strong>
                </span>
              </div>
            )}
          </div>

          {/* Billing Tab Toggle */}
          <Tabs
            defaultValue="monthly"
            value={activeTab}
            onValueChange={handleTabChange}
            className="w-full"
          >
            <div className="flex justify-center mb-12">
              <TabsList
                role="tablist"
                aria-label="Billing options"
                className="inline-flex h-auto p-1.5 bg-muted/70 dark:bg-muted/40 backdrop-blur-md border border-border/80 rounded-2xl shadow-sm gap-1.5"
              >
                <TabsTrigger
                  value="monthly"
                  data-testid="tab-monthly-plans"
                  className="rounded-xl px-5 py-2.5 text-sm md:text-base font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span>Monthly Plans</span>
                </TabsTrigger>
                <TabsTrigger
                  value="packs"
                  data-testid="tab-credit-packs"
                  className="rounded-xl px-5 py-2.5 text-sm md:text-base font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all flex items-center gap-2"
                >
                  <Coins className="w-4 h-4 text-primary" />
                  <span>Verified Submission Packs</span>
                  <span className="hidden sm:inline-block text-xs font-normal opacity-85 px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    Pay-Per-Application
                  </span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* TAB 1: Monthly Plans (4 Tiers) */}
            <TabsContent
              value="monthly"
              forceMount
              className="data-[state=inactive]:hidden focus-visible:outline-none"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-20 items-stretch">
                {MONTHLY_TIERS.map((tier) => {
                  const isPopular = Boolean(tier.popular);
                  const isFree = tier.id === "free";
                  const isEnterprise = tier.id === "enterprise";

                  return (
                    <div
                      key={tier.id}
                      data-testid={tier.testId}
                      className={`relative rounded-2xl p-7 border transition-all duration-200 flex flex-col justify-between ${
                        isPopular
                          ? "bg-card border-primary ring-2 ring-primary/40 shadow-xl"
                          : "bg-card/70 border-border hover:border-primary/50 shadow-sm"
                      }`}
                    >
                      {isPopular && (
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                          <span className="bg-primary text-primary-foreground text-xs font-semibold px-3.5 py-1 rounded-full uppercase tracking-wider shadow-md">
                            Popular
                          </span>
                        </div>
                      )}

                      <div>
                        {/* Header icon and title */}
                        <div className="flex items-center gap-3 mb-4">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              isPopular
                                ? "bg-primary text-primary-foreground"
                                : "bg-primary/10 text-primary"
                            }`}
                          >
                            {tier.id === "free" && <Sparkles className="w-5 h-5" />}
                            {tier.id === "pro" && <Zap className="w-5 h-5" />}
                            {tier.id === "team" && <Users className="w-5 h-5" />}
                            {tier.id === "enterprise" && <Building2 className="w-5 h-5" />}
                          </div>
                          <div>
                            <h3 className="font-display text-xl font-bold">{tier.name}</h3>
                            <span className="text-xs text-muted-foreground font-medium">
                              {tier.subtitle}
                            </span>
                          </div>
                        </div>

                        {/* Price */}
                        <div className="mb-4">
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-display text-4xl font-extrabold tabular-nums tracking-tight">
                              {tier.priceFormatted}
                            </span>
                            {tier.period && (
                              <span className="text-sm font-medium text-muted-foreground">
                                {tier.period}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {isFree
                              ? "Free forever · No card required"
                              : isEnterprise
                              ? "Invoiced annually · Dedicated SLA"
                              : "Billed monthly · Cancel anytime"}
                          </p>
                        </div>

                        <p className="text-muted-foreground mb-6 text-sm leading-relaxed min-h-[40px]">
                          {tier.description}
                        </p>

                        {/* Features list */}
                        <ul className="space-y-3 mb-8">
                          {tier.features.map((feature, i) => (
                            <li key={i} className="flex items-start gap-2.5 text-sm">
                              <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                              <span className="text-foreground/90">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* CTA Button */}
                      <Button
                        className={`w-full font-semibold py-5 active:scale-[0.98] ${
                          isPopular
                            ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
                            : isEnterprise
                            ? "border border-primary/40 text-primary hover:bg-primary/10 bg-transparent"
                            : "bg-secondary hover:bg-secondary/80 text-foreground border border-border"
                        }`}
                        variant={isEnterprise ? "outline" : isPopular ? "default" : "secondary"}
                        disabled={
                          (!isFree && !isEnterprise && Boolean(loadingPlan === `subscription:${tier.id}`)) ||
                          (!isFree && !isEnterprise && Boolean(user && billingEnabled !== true))
                        }
                        onClick={() => handleMonthlyTierAction(tier)}
                      >
                        {loadingPlan === `subscription:${tier.id}` ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        {tier.cta}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* TAB 2: Verified Submission Credit Packs */}
            <TabsContent
              value="packs"
              forceMount
              className="data-[state=inactive]:hidden focus-visible:outline-none"
            >
              {/* Transparent credit-policy guarantee banner */}
              <div
                data-testid="zero-risk-guarantee"
                className="max-w-4xl mx-auto mb-12 p-6 rounded-2xl bg-success/10 border border-success/30 text-center shadow-sm"
              >
                <div className="inline-flex items-center justify-center p-3 bg-success/20 rounded-full mb-3 text-success">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <h2 className="font-display text-balance text-xl md:text-2xl font-bold text-success mb-2">
                  Transparent credit policy: 1 credit is debited only when a verified submission receipt with an ATS confirmation code is generated. Failed or unverifiable applications are $0.00 / 0 credits.
                </h2>
                <p className="text-balance text-sm text-muted-foreground max-w-2xl mx-auto">
                  When the workflow cannot capture verifiable ATS confirmation proof, it does not debit a submission credit. Check the receipt status rather than treating an uncertain outcome as complete.
                </p>
              </div>

              {/* Credit Packs Grid */}
              <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
                {packs.map((pack) => {
                  const isPopular = pack.popular;
                  return (
                    <div
                      key={pack.id}
                      data-testid={`pricing-card-${pack.id}`}
                      className={`relative rounded-2xl p-8 border transition-all duration-200 flex flex-col justify-between ${
                        isPopular
                          ? "bg-card border-primary ring-2 ring-primary/40 shadow-lg"
                          : "bg-card/70 border-border hover:border-primary/50 shadow-sm"
                      }`}
                    >
                      {isPopular && (
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                          <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider shadow">
                            Active search
                          </span>
                        </div>
                      )}

                      {pack.bestValue && (
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                          <span className="bg-success text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider shadow">
                            Best Value
                          </span>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                isPopular ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                              }`}
                            >
                              <Coins className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-display text-xl font-bold">{pack.name}</h3>
                              <span className="text-xs text-muted-foreground font-medium tabular-nums">
                                {pack.credits} Verified Submissions
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mb-4">
                          <div className="flex items-baseline gap-2">
                            <span className="font-display text-4xl font-extrabold tabular-nums tracking-tight">
                              {pack.priceFormatted}
                            </span>
                            <span className="text-sm font-semibold text-success tabular-nums">
                              ({pack.unitPrice})
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">One-time payment · No subscription</p>
                        </div>

                        <p className="text-muted-foreground mb-6 text-sm leading-relaxed">{pack.description}</p>

                        <ul className="space-y-3 mb-8">
                          {pack.features.map((feature, i) => (
                            <li key={i} className="flex items-start gap-2.5 text-sm">
                              <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                              <span className="text-foreground/90">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <Button
                        className={`w-full font-semibold py-5 active:scale-[0.98] ${
                          isPopular
                            ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
                            : "bg-secondary hover:bg-secondary/80 text-foreground border border-border"
                        }`}
                        disabled={Boolean(loadingPlan === `one_time:${pack.id}`) || Boolean(user && billingEnabled !== true)}
                        onClick={() => handleCheckout(pack.id, "one_time")}
                      >
                        {loadingPlan === `one_time:${pack.id}` ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        {billingEnabled === false ? "Billing unavailable" : pack.cta}
                      </Button>
                    </div>
                  );
                })}
              </div>

              {/* Free Forever Wedge Banner */}
              <div className="max-w-4xl mx-auto mb-16 p-6 rounded-2xl border border-border bg-card/60 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Zap className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Looking for free tools?</h3>
                    <p className="text-sm text-muted-foreground">
                      Job tracking board, resume tailoring against any JD, ghost-job screening, and ATS scoring are free forever.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="shrink-0"
                  onClick={() => navigate(user ? "/dashboard" : "/auth")}
                >
                  {user ? "Open Dashboard" : "Get Started Free"}
                </Button>
              </div>

              {/* Why Credits, Not Subscriptions */}
              <div className="max-w-4xl mx-auto mb-16">
                <h2 className="font-display text-balance text-3xl font-bold text-center mb-10 tracking-tight">
                  Pay <span className="text-gradient">Per Verified Application</span> — Not Per Month
                </h2>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="glass rounded-2xl p-6 border border-border/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Receipt className="w-5 h-5 text-primary" />
                      <h3 className="font-display font-semibold text-sm">Pay Only For Verified Proof</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Monthly subscriptions charge you whether you apply to 0 jobs or 50. With credit packs, 1 credit is debited strictly upon a verified ATS confirmation receipt.
                    </p>
                  </div>
                  <div className="glass rounded-2xl p-6 border border-border/50">
                    <div className="flex items-center gap-2 mb-3">
                      <X className="w-5 h-5 text-primary" />
                      <h3 className="font-display font-semibold text-sm">No recurring billing</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Credit packs do not create a recurring monthly charge. Your search can move at its own pace without a subscription clock to manage.
                    </p>
                  </div>
                  <div className="glass rounded-2xl p-6 border border-border/50">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldCheck className="w-5 h-5 text-primary" />
                      <h3 className="font-display font-semibold text-sm">Zero Risk on Failed Applications</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      If an application cannot be completed or ATS confirmation is missing, the cost is $0.00 / 0 credits.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Institutions / Contact Sales */}
          <div
            id="contact-sales-section"
            className="max-w-4xl mx-auto mb-20 p-8 rounded-2xl border border-border bg-gradient-to-r from-card via-card to-primary/5"
          >
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-display text-xl font-bold">For career programmes & institutions</h3>
                </div>
                <p className="text-muted-foreground mb-4 text-sm">
                  Universities, bootcamps, and outplacement programmes can start with a scoped conversation about candidate workflows, cohort visibility, and practical rollout requirements.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success flex-shrink-0" />
                    Candidate workflows and receipt requirements scoped to your programme
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success flex-shrink-0" />
                    Cohort pricing and billing options discussed before rollout
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-success flex-shrink-0" />
                    Advisor and access requirements assessed for your environment
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
                    placeholder="advisor@university.edu"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <Button type="submit" size="sm" className="bg-primary hover:bg-primary/90 active:scale-[0.98]">
                    <Mail className="w-4 h-4 mr-1" />
                    Contact Sales
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  We will respond with the information needed to explore a scoped programme conversation.
                </p>
              </form>
            </div>
          </div>

          {/* Trust Banner */}
          <div className="max-w-4xl mx-auto mb-16 p-6 rounded-2xl border border-border bg-gradient-to-r from-card via-card to-primary/5 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1">
              <h3 className="font-display font-bold text-base flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-success" /> 7-Day Refund on Unused Credits
              </h3>
              <p className="text-xs text-muted-foreground max-w-xl">
                Unused credits are 100% refundable within 7 days. Verified submissions with generated receipts are final.
              </p>
            </div>
            <div className="space-y-1 md:text-right">
              <h3 className="font-display font-bold text-base flex items-center gap-2 md:justify-end">
                <Clock className="w-4 h-4 text-primary" /> Credits Never Expire
              </h3>
              <p className="text-xs text-muted-foreground">
                Take as long as you need. Your credit balance stays active permanently.
              </p>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="max-w-3xl mx-auto">
            <h2 className="font-display text-balance text-3xl font-bold text-center mb-10 tracking-tight">
              Frequently Asked <span className="text-gradient">Questions</span>
            </h2>
            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="glass border border-border/50 rounded-xl px-6"
                >
                  <AccordionTrigger className="text-left text-foreground hover:text-primary hover:no-underline py-4">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-4 leading-relaxed">
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