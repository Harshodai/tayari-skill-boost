import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout";
import { Seo } from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  getAllComparisons,
  getComparisonBySlug,
  type ComparisonData,
} from "@/data/comparisonsData";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Zap,
  Sparkles,
  Search,
  Scale,
  DollarSign,
  Layers,
  ChevronRight,
  ArrowLeft,
  FileCheck2,
  HelpCircle,
} from "lucide-react";

export const CompareTool = () => {
  const { tool } = useParams<{ tool?: string }>();
  const navigate = useNavigate();

  const allComparisons = useMemo(() => getAllComparisons(), []);
  const activeComparison = tool ? getComparisonBySlug(tool) : undefined;
  const isDirectory = !tool || !activeComparison;

  // Group matrix capabilities by category if viewing a specific comparison
  const groupedMatrix = useMemo(() => {
    if (!activeComparison) return {};
    const items = activeComparison.matrix;
    return items.reduce((acc, feat) => {
      if (!acc[feat.category]) acc[feat.category] = [];
      acc[feat.category].push(feat);
      return acc;
    }, {} as Record<string, typeof activeComparison.matrix>);
  }, [activeComparison]);

  // Structured schema for SEO
  const jsonLd = activeComparison
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: `Job Tayari vs ${activeComparison.competitorName}`,
        description: activeComparison.metaDescription,
        brand: {
          "@type": "Brand",
          name: "Job Tayari",
        },
        offers: {
          "@type": "AggregateOffer",
          lowPrice: "0",
          highPrice: "12",
          priceCurrency: "USD",
        },
      }
    : null;

  return (
    <Layout>
      <Seo
        title={
          activeComparison
            ? `${activeComparison.title} | Job Tayari`
            : "Compare ATS Resume Tools & AI Career Coaches | Job Tayari"
        }
        description={
          activeComparison
            ? activeComparison.metaDescription
            : "Compare Job Tayari against Jobscan, Teal, Simplify, and Rezi. See why simulated ATS parsing, reflective self-scoring, and keyless direct job discovery offer superior results."
        }
        path={tool ? `/compare/${tool}` : "/compare"}
        jsonLd={jsonLd || undefined}
      />

      <div className="min-h-screen bg-background text-foreground pb-20">
        {/* Breadcrumb Navigation */}
        <div className="border-b border-border/40 bg-card/30">
          <div className="container mx-auto px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
            <Link to="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <ChevronRight className="h-3 w-3" />
            {isDirectory ? (
              <span className="font-semibold text-foreground">Compare Tools</span>
            ) : (
              <>
                <Link to="/compare" className="hover:text-foreground transition-colors">
                  Compare
                </Link>
                <ChevronRight className="h-3 w-3" />
                <span className="font-semibold text-foreground">
                  vs {activeComparison?.competitorName}
                </span>
              </>
            )}
          </div>
        </div>

        {isDirectory ? (
          /* Directory Overview View */
          <div className="container mx-auto px-4 py-12 max-w-6xl">
            <div className="text-center max-w-3xl mx-auto mb-12 space-y-4">
              <Badge variant="outline" className="text-xs uppercase font-semibold text-primary border-primary/30">
                Independent Platform Analysis
              </Badge>
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight font-display">
                How Job Tayari Compares to Other AI Career Platforms
              </h1>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                Most career tools either rely on superficial keyword matching or flood recruiters with generic AI filler. Discover how Job Tayari’s simulated ATS parsers, reflective self-scoring, and Hermes job discovery set a higher standard.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
              {allComparisons.map((item) => (
                <Card
                  key={item.slug}
                  className="flex flex-col justify-between border-border/70 hover:border-primary/50 transition-all hover:shadow-md bg-card/60"
                >
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <Badge variant="secondary" className="text-[11px] font-semibold">
                        {item.badge}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-medium">
                        vs. {item.competitorName}
                      </span>
                    </div>
                    <CardTitle className="text-xl font-bold">{item.title}</CardTitle>
                    <CardDescription className="text-sm mt-2 line-clamp-2">
                      {item.subtitle}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-3 text-xs rounded-lg border border-border/50 p-3 bg-secondary/20">
                      <div>
                        <span className="text-muted-foreground block">Job Tayari:</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {item.oursPricing}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">{item.competitorName}:</span>
                        <span className="font-medium text-foreground">{item.competitorPricing}</span>
                      </div>
                    </div>

                    <ul className="space-y-1.5 text-xs text-muted-foreground">
                      {item.prosOurs.slice(0, 3).map((pro, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{pro}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      className="w-full mt-4 group"
                      onClick={() => navigate(`/compare/${item.slug}`)}
                    >
                      Read Full {item.competitorName} Comparison
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Bottom CTA */}
            <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-8 md:p-12 text-center max-w-4xl mx-auto">
              <Sparkles className="h-8 w-8 text-primary mx-auto mb-4" />
              <h2 className="text-2xl md:text-3xl font-bold mb-3">
                Experience the ATS Difference in 60 Seconds
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto mb-6 text-sm md:text-base">
                No credit card required. Test your resume against live Workday, Greenhouse, and Lever parsing engines right now.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button size="lg" onClick={() => navigate("/free-scan")}>
                  <Zap className="mr-2 h-4 w-4 text-amber-400" />
                  Run Free ATS Scan
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/pricing")}>
                  View Pricing & Plans
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Specific Tool Comparison Detail View */
          <div className="container mx-auto px-4 py-8 max-w-5xl space-y-12">
            {/* Back link */}
            <div>
              <Link
                to="/compare"
                className="inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Back to all comparisons
              </Link>
            </div>

            {/* Header / Hero */}
            <div className="space-y-4 text-center max-w-3xl mx-auto">
              <Badge variant="outline" className="text-xs uppercase font-semibold text-primary border-primary/30">
                {activeComparison.badge}
              </Badge>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight font-display text-balance">
                {activeComparison.title}
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed text-balance">
                {activeComparison.subtitle}
              </p>

              {/* Quick Switcher */}
              <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
                <span className="text-xs text-muted-foreground mr-1">Compare another:</span>
                {allComparisons.map((c) => (
                  <Link
                    key={c.slug}
                    to={`/compare/${c.slug}`}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-all border ${
                      c.slug === activeComparison.slug
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary/60 text-muted-foreground hover:bg-secondary border-border/50"
                    }`}
                  >
                    vs. {c.competitorName}
                  </Link>
                ))}
              </div>
            </div>

            {/* Quick Pricing & Summary Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-emerald-500/30 bg-emerald-500/[0.04]">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Job Tayari
                    </CardTitle>
                    <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">
                      Recommended
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    AI-Native Application Infrastructure
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-2xl font-extrabold text-foreground">
                    {activeComparison.oursPricing}
                  </div>
                  <ul className="space-y-2 text-xs">
                    {activeComparison.prosOurs.map((pro, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{pro}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/40">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold text-muted-foreground">
                      {activeComparison.competitorName}
                    </CardTitle>
                    <Badge variant="outline" className="text-muted-foreground">
                      Incumbent
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Legacy Tool Model
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-2xl font-extrabold text-foreground">
                    {activeComparison.competitorPricing}
                  </div>
                  <ul className="space-y-2 text-xs text-muted-foreground">
                    {activeComparison.prosCompetitor.map((pro, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0 mt-1.5" />
                        <span>{pro}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Verdict Summary Box */}
            <Card className="border-primary/20 bg-card/80">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Scale className="h-4 w-4 text-primary" />
                  The Bottom Line Verdict
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {activeComparison.verdictSummary}
                </p>
              </CardContent>
            </Card>

            {/* Key Architectural Differences */}
            <div className="space-y-4">
              <h2 className="text-xl md:text-2xl font-bold font-display flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                Key Differences at a Glance
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {activeComparison.keyDifferences.map((diff, i) => (
                  <Card key={i} className="border-border/60 bg-card/40 flex flex-col justify-between">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-bold">{diff.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs">
                      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/[0.04] p-2.5">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 block mb-1">
                          Job Tayari Advantage:
                        </span>
                        <span className="text-muted-foreground leading-relaxed">
                          {diff.oursAdvantage}
                        </span>
                      </div>
                      <div className="rounded-md border border-border/50 bg-secondary/20 p-2.5">
                        <span className="font-semibold text-muted-foreground block mb-1">
                          {activeComparison.competitorName} Limitation:
                        </span>
                        <span className="text-muted-foreground leading-relaxed">
                          {diff.competitorLimitation}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Side-by-Side Detailed Capability Matrix */}
            <div className="space-y-4">
              <h2 className="text-xl md:text-2xl font-bold font-display flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 text-primary" />
                Detailed Capability Matrix
              </h2>
              <Card className="border-border/70 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border/60 bg-secondary/40 text-foreground font-semibold">
                        <th className="py-3 px-4 w-1/3">Capability</th>
                        <th className="py-3 px-4 w-1/3 bg-primary/5 text-primary font-bold">
                          Job Tayari
                        </th>
                        <th className="py-3 px-4 w-1/3 text-muted-foreground">
                          {activeComparison.competitorName}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {Object.entries(groupedMatrix).map(([category, items]) => (
                        <tr key={category}>
                          <td colSpan={3} className="p-0">
                            <div className="bg-secondary/20 font-bold text-muted-foreground py-2 px-4 uppercase text-[10px] tracking-wider">
                              {category}
                            </div>
                            <table className="w-full text-left text-xs border-collapse">
                              <tbody className="divide-y divide-border/40">
                                {items.map((feat, idx) => (
                                  <tr key={idx} className="hover:bg-muted/20 transition-colors">
                                    <td className="py-3 px-4 w-1/3 font-medium">{feat.name}</td>
                                    <td className="py-3 px-4 w-1/3 bg-primary/[0.02]">
                                      <div className="flex items-center gap-1.5">
                                        {feat.ours.supported ? (
                                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                        ) : (
                                          <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                                        )}
                                        <span className="font-semibold text-foreground">
                                          {feat.ours.label}
                                        </span>
                                      </div>
                                      <span className="text-[11px] text-muted-foreground block mt-0.5">
                                        {feat.ours.detail}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 w-1/3 text-muted-foreground">
                                      <div className="flex items-center gap-1.5">
                                        {feat.competitor.supported ? (
                                          <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                        ) : (
                                          <XCircle className="h-4 w-4 text-red-500/70 shrink-0" />
                                        )}
                                        <span className="font-medium text-foreground">
                                          {feat.competitor.label}
                                        </span>
                                      </div>
                                      <span className="text-[11px] text-muted-foreground block mt-0.5">
                                        {feat.competitor.detail}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Frequently Asked Questions */}
            <div className="space-y-4">
              <h2 className="text-xl md:text-2xl font-bold font-display flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                Frequently Asked Questions
              </h2>
              <Accordion type="single" collapsible className="w-full space-y-2">
                {activeComparison.faqs.map((faq, i) => (
                  <AccordionItem key={i} value={`faq-${i}`} className="border rounded-lg px-4 bg-card/40">
                    <AccordionTrigger className="text-left text-sm font-semibold hover:no-underline">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-xs text-muted-foreground leading-relaxed pt-1 pb-3">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            {/* Conversion CTA Footer */}
            <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-8 md:p-10 text-center">
              <h3 className="text-2xl font-bold mb-2">
                Ready to Upgrade from {activeComparison.competitorName}?
              </h3>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-6">
                Start scanning your resume for real ATS parser compatibility in under 60 seconds with zero credit card required.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button size="lg" onClick={() => navigate("/free-scan")}>
                  <Zap className="mr-2 h-4 w-4 text-amber-400" />
                  Try 60-Second ATS Scan Free
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/pricing")}>
                  See All Pricing Options
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CompareTool;
