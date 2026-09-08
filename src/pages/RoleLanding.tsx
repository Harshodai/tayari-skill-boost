import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout";
import { Seo } from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  getAllRoles,
  getRoleBySlug,
  type RoleData,
} from "@/data/rolesData";
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Download,
  Copy,
  Search,
  Sparkles,
  TrendingUp,
  Target,
  FileText,
  DollarSign,
  ShieldAlert,
  ArrowLeft,
  Briefcase,
  ChevronRight,
  ListCheck,
  Check,
} from "lucide-react";

export const RoleLanding = () => {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();

  // If slug is provided, look up the specific role
  const role = slug ? getRoleBySlug(slug) : undefined;
  const isDirectory = !slug;

  // State for directory search
  const [searchQuery, setSearchQuery] = useState("");

  // State for interactive ATS readiness checklist in role detail view
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const allRoles = useMemo(() => getAllRoles(), []);

  // Filtered roles for directory view
  const filteredRoles = useMemo(() => {
    if (!searchQuery.trim()) return allRoles;
    const q = searchQuery.toLowerCase();
    return allRoles.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.subtitle.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.topSkills.some((s) => s.name.toLowerCase().includes(q))
    );
  }, [allRoles, searchQuery]);

  // Handle copying resume template to clipboard
  const handleCopyTemplate = async (templateText: string) => {
    try {
      await navigator.clipboard.writeText(templateText);
      toast.success("Sample ATS resume template copied to clipboard!");
    } catch {
      toast.error("Failed to copy template to clipboard.");
    }
  };

  // Handle downloading benchmark and checklist as JSON
  const handleDownloadJson = (currentRole: RoleData) => {
    const exportData = {
      role: currentRole.title,
      slug: currentRole.slug,
      salaryRange: currentRole.salaryRange,
      atsBenchmarks: currentRole.atsBenchmarks,
      topSkills: currentRole.topSkills,
      commonRejectionTraps: currentRole.commonRejectionTraps,
      sampleParBullets: currentRole.sampleParBullets,
      faqs: currentRole.faqs,
      generatedAt: new Date().toISOString(),
      atsChecklist: [
        "100% single-column layout without tables or text boxes",
        `ATS score target benchmark: ${currentRole.atsBenchmarks.targetScore}%+`,
        `Keyword density in range: ${currentRole.atsBenchmarks.keywordDensity}`,
        `Bullet metric ratio target: ${currentRole.atsBenchmarks.bulletMetricRatio}`,
        `Max page length: ${currentRole.atsBenchmarks.maxPageLength} page(s)`,
        ...currentRole.topSkills.slice(0, 5).map((s) => `Contextual evidence for ${s.name}`),
      ],
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentRole.slug}-ats-benchmark.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${currentRole.slug}-ats-benchmark.json`);
  };

  // Toggle checklist item
  const toggleCheckItem = (id: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // ==========================================
  // 1. DIRECTORY VIEW: /roles
  // ==========================================
  if (isDirectory) {
    const directoryJsonLd = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Tech Role ATS Benchmarks & Resume Playbooks (2026)",
      description:
        "Comprehensive ATS benchmarks, salary ranges, top required skills, and PAR bullet formulas for high-demand tech roles.",
      url: "https://tayari-skill-boost.lovable.app/roles",
    };

    return (
      <Layout>
        <Seo
          title="Tech Role ATS Benchmarks & Resume Guides (2026) — Job Tayari"
          description="Explore data-backed ATS scoring benchmarks, salary ranges, top 10 required skills, and sample PAR bullet rewrites for high-demand tech roles."
          path="/roles"
          jsonLd={directoryJsonLd}
        />
        <div className="min-h-screen bg-gradient-hero py-16 md:py-24">
          <div className="container mx-auto px-4 max-w-6xl">
            {/* Header */}
            <div className="text-center max-w-3xl mx-auto mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-4">
                <Sparkles className="w-3.5 h-3.5" />
                2026 Tech Hiring Benchmarks
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-4">
                Role-Specific <span className="text-gradient">ATS Benchmarks</span> & Guides
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Applicant Tracking Systems evaluate every engineering and product discipline with different keyword models and metric ratios. Explore role-specific passing benchmarks, rejection traps, and battle-tested PAR formulas.
              </p>

              {/* Search Bar */}
              <div className="mt-8 relative max-w-md mx-auto">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search roles or skills (e.g. React, Kubernetes, SQL)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12 rounded-xl bg-card/60 backdrop-blur border-border"
                />
              </div>
            </div>

            {/* Roles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
              {filteredRoles.map((r) => (
                <Card
                  key={r.slug}
                  className="flex flex-col justify-between hover:border-primary/50 transition-all duration-300 hover:shadow-lg bg-card/80 backdrop-blur"
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary font-medium">
                        Target ATS: {r.atsBenchmarks.targetScore}%+
                      </Badge>
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5" />
                        {r.salaryRange.formatted}
                      </span>
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight">
                      <Link
                        to={`/roles/${r.slug}`}
                        className="hover:text-primary transition-colors focus:outline-none"
                      >
                        {r.title}
                      </Link>
                    </CardTitle>
                    <CardDescription className="line-clamp-2 text-sm text-muted-foreground mt-1">
                      {r.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="pt-0 flex flex-col justify-between flex-1">
                    {/* Top Skills Preview */}
                    <div className="mb-6">
                      <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                        Top Required Skills:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {r.topSkills.slice(0, 4).map((skill) => (
                          <Badge
                            key={skill.name}
                            variant="secondary"
                            className="text-xs font-normal py-0.5"
                          >
                            {skill.name.split("(")[0].trim()}
                          </Badge>
                        ))}
                        {r.topSkills.length > 4 && (
                          <Badge variant="outline" className="text-xs font-normal py-0.5 text-muted-foreground">
                            +{r.topSkills.length - 4} more
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* CTAs */}
                    <div className="flex items-center gap-2 pt-4 border-t border-border">
                      <Button asChild variant="default" className="flex-1">
                        <Link to={`/roles/${r.slug}`}>
                          View Benchmark Guide
                          <ArrowRight className="w-4 h-4 ml-1.5" />
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="icon" title="Tailor in Studio">
                        <Link to={`/resume?role=${r.slug}`}>
                          <Sparkles className="w-4 h-4 text-primary" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredRoles.length === 0 && (
              <div className="text-center py-12 glass rounded-2xl p-8 max-w-md mx-auto">
                <AlertTriangle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-lg font-bold mb-1">No roles matched your search</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Try searching for general keywords like "Engineer", "Manager", or "Cloud".
                </p>
                <Button variant="outline" onClick={() => setSearchQuery("")}>
                  Reset Search
                </Button>
              </div>
            )}

            {/* Bottom Banner */}
            <div className="rounded-2xl p-8 bg-gradient-to-r from-primary/10 via-card to-secondary/10 border border-primary/20 text-center">
              <h2 className="text-2xl font-bold mb-2">Don't See Your Specific Title?</h2>
              <p className="text-muted-foreground max-w-xl mx-auto mb-6 text-sm">
                Our AI resume engine parses any tech or business role by cross-referencing your target job description in real-time.
              </p>
              <Button asChild size="lg" variant="default">
                <Link to="/resume">
                  Scan Resume in Custom Studio
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // ==========================================
  // 2. 404 NOT FOUND STATE IF INVALID SLUG
  // ==========================================
  if (!role) {
    return (
      <Layout>
        <Seo
          title="Role Benchmark Not Found — Job Tayari"
          description="The requested role benchmark guide could not be found."
          path={`/roles/${slug || ""}`}
          noindex
        />
        <div className="min-h-screen bg-gradient-hero py-20 flex items-center justify-center">
          <div className="container mx-auto px-4 max-w-md text-center">
            <div className="glass rounded-2xl p-8 border border-border">
              <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2">Role Guide Not Found</h1>
              <p className="text-muted-foreground mb-6 text-sm">
                We couldn't find a benchmark guide for <code className="text-foreground font-mono">"{slug}"</code>.
              </p>
              <div className="flex flex-col gap-3">
                <Button asChild variant="default">
                  <Link to="/roles">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Browse All Roles
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/resume">Go to Resume Studio</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // ==========================================
  // 3. DETAILED ROLE LANDING VIEW: /roles/:slug
  // ==========================================

  // Schema.org Structured Data
  const occupationSchema = {
    "@context": "https://schema.org",
    "@type": "Occupation",
    name: role.title,
    description: role.description,
    estimatedSalary: [
      {
        "@type": "MonetaryAmountDistribution",
        name: "base",
        currency: role.salaryRange.currency,
        percentile10: role.salaryRange.min,
        percentile50: role.salaryRange.median,
        percentile90: role.salaryRange.max,
      },
    ],
    skills: role.topSkills.map((s) => s.name),
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: role.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  // Interactive checklist items for this role
  const checklistItems = [
    { id: "c1", label: "Single-column semantic document without nested tables or columns" },
    { id: "c2", label: `Meets or exceeds target ATS passing benchmark of ${role.atsBenchmarks.targetScore}%` },
    { id: "c3", label: `Technical keyword density aligned within ${role.atsBenchmarks.keywordDensity}` },
    { id: "c4", label: `At least ${role.atsBenchmarks.bulletMetricRatio} of bullets include quantified metrics` },
    { id: "c5", label: `Includes primary core skills: ${role.topSkills.slice(0, 3).map((s) => s.name.split("(")[0].trim()).join(", ")}` },
    { id: "c6", label: "Eliminated vague responsibility bullets in favor of PAR formulas" },
    { id: "c7", label: `Standard headings (${role.atsBenchmarks.recommendedSections.slice(0, 3).join(", ")}) used` },
  ];

  const totalChecklistCount = checklistItems.length;
  const completedChecklistCount = Object.values(checkedItems).filter(Boolean).length;
  const checklistProgress = Math.round((completedChecklistCount / totalChecklistCount) * 100);

  return (
    <Layout>
      <Seo
        title={`${role.title} Resume & ATS Benchmark Guide (2026) — Job Tayari`}
        description={`Pass the ATS for ${role.title} roles. Review 2026 passing score benchmarks (${role.atsBenchmarks.targetScore}%), salary ranges (${role.salaryRange.formatted}), top 10 required skills, rejection traps, and sample PAR bullet rewrites.`}
        path={`/roles/${role.slug}`}
        jsonLd={[occupationSchema, faqSchema]}
      />

      <div className="min-h-screen bg-gradient-hero py-12 md:py-20">
        <div className="container mx-auto px-4 max-w-5xl">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Link to="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link to="/roles" className="hover:text-foreground transition-colors">
              Roles
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">{role.title}</span>
          </nav>

          {/* Hero Header */}
          <div className="glass rounded-3xl p-8 md:p-12 border border-border mb-12 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <Badge className="bg-primary text-primary-foreground font-medium">
                  2026 ATS Benchmark
                </Badge>
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 font-semibold">
                  Salary: {role.salaryRange.formatted}
                </Badge>
                <Badge variant="outline" className="border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/5">
                  Target Score: {role.atsBenchmarks.targetScore}%+
                </Badge>
              </div>

              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground mb-2">
                {role.title} <span className="text-gradient">Resume & ATS Guide</span>
              </h1>
              <p className="text-base font-semibold text-primary/90 mb-3">
                {role.subtitle}
              </p>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl leading-relaxed mb-8">
                {role.description}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4">
                <Button asChild size="lg" className="font-semibold shadow-md">
                  <Link to={`/resume?role=${role.slug}`}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Tailor Resume for {role.title}
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleDownloadJson(role)}
                  className="font-medium"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Benchmark JSON
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => handleCopyTemplate(role.sampleResumeTemplate)}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Sample Template
                </Button>
              </div>
            </div>
          </div>

          {/* Key ATS Benchmarks Scorecard */}
          <div className="mb-14">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2.5">
              <Target className="w-6 h-6 text-primary" />
              ATS Scoring & Diagnostic Benchmarks
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card className="bg-card/80 border-border">
                <CardContent className="p-5 text-center">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Passing ATS Score
                  </div>
                  <div className="text-3xl font-extrabold text-primary mb-1">
                    {role.atsBenchmarks.targetScore}%
                  </div>
                  <div className="text-xs text-muted-foreground">Minimum score for recruiter view</div>
                </CardContent>
              </Card>

              <Card className="bg-card/80 border-border">
                <CardContent className="p-5 text-center">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Keyword Density
                  </div>
                  <div className="text-3xl font-extrabold text-foreground mb-1">
                    {role.atsBenchmarks.keywordDensity}
                  </div>
                  <div className="text-xs text-muted-foreground">Optimal balance without spam flags</div>
                </CardContent>
              </Card>

              <Card className="bg-card/80 border-border">
                <CardContent className="p-5 text-center">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Metric-Backed Bullets
                  </div>
                  <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mb-1">
                    {role.atsBenchmarks.bulletMetricRatio}
                  </div>
                  <div className="text-xs text-muted-foreground">Bullets with quantified impact</div>
                </CardContent>
              </Card>

              <Card className="bg-card/80 border-border">
                <CardContent className="p-5 text-center">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Max Recommended Length
                  </div>
                  <div className="text-3xl font-extrabold text-foreground mb-1">
                    {role.atsBenchmarks.maxPageLength} {role.atsBenchmarks.maxPageLength === 1 ? "Page" : "Pages"}
                  </div>
                  <div className="text-xs text-muted-foreground">Strict single or dual page limit</div>
                </CardContent>
              </Card>
            </div>

            {/* Salary Breakdown Bar */}
            <Card className="border-border bg-card/60">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                    <span className="font-semibold text-foreground">Verified Compensation Spectrum (US Market)</span>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">
                    Median: ${role.salaryRange.median.toLocaleString()}/yr
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground mb-2">
                  <div>10th Percentile: ${role.salaryRange.min.toLocaleString()}</div>
                  <div className="font-semibold text-foreground">Median: ${role.salaryRange.median.toLocaleString()}</div>
                  <div>90th Percentile: ${role.salaryRange.max.toLocaleString()}</div>
                </div>
                <div className="h-3 w-full bg-muted rounded-full overflow-hidden relative">
                  <div className="h-full bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-500 rounded-full w-full" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top 10 Required Skills */}
          <div className="mb-14">
            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2.5">
              <Briefcase className="w-6 h-6 text-primary" />
              Top 10 Mandatory & Differentiating Skills
            </h2>
            <p className="text-muted-foreground text-sm mb-6">
              Extracted from verified 2026 job postings. Modern ATS parsers scan for exact keyword variations and semantic synonyms.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {role.topSkills.map((skill, index) => (
                <Card key={skill.name} className="border-border bg-card/70">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                          {index + 1}
                        </span>
                        <span className="font-bold text-foreground text-sm">{skill.name}</span>
                      </div>
                      <Badge
                        variant={skill.importance === "Mandatory" ? "default" : "secondary"}
                        className="text-[10px] py-0 px-2"
                      >
                        {skill.importance}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                      <span>Category: <strong className="text-foreground">{skill.category}</strong></span>
                      <span>•</span>
                      <span className="text-primary font-medium">{skill.frequency}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {skill.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* PAR Bullet Rewrites */}
          <div className="mb-14">
            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2.5">
              <Sparkles className="w-6 h-6 text-primary" />
              PAR Bullet Formula Rewrites (Problem • Action • Result)
            </h2>
            <p className="text-muted-foreground text-sm mb-6">
              Transform passive, responsibility-driven descriptions into high-converting, metric-backed impact statements.
            </p>

            <div className="space-y-6">
              {role.sampleParBullets.map((par, i) => (
                <Card key={i} className="border-border overflow-hidden bg-card/80">
                  <div className="p-4 bg-muted/40 border-b border-border flex items-center justify-between">
                    <span className="font-semibold text-sm text-foreground">{par.title}</span>
                    <Badge variant="outline" className="text-xs">Formula Example #{i + 1}</Badge>
                  </div>
                  <CardContent className="p-6 space-y-4">
                    {/* Before */}
                    <div className="p-3.5 rounded-xl bg-destructive/5 border border-destructive/20 text-xs">
                      <div className="flex items-center gap-1.5 text-destructive font-semibold mb-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Weak / Fails ATS Keyword Weighting:
                      </div>
                      <p className="text-muted-foreground italic">"{par.before}"</p>
                    </div>

                    {/* After */}
                    <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Optimized PAR Bullet (Passes ATS with 95%+ Match):
                      </div>
                      <p className="text-foreground font-medium">"{par.after}"</p>
                    </div>

                    {/* Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-background border border-border">
                        <span className="font-semibold text-primary block mb-0.5">Problem:</span>
                        <span className="text-muted-foreground">{par.problem}</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-background border border-border">
                        <span className="font-semibold text-primary block mb-0.5">Action:</span>
                        <span className="text-muted-foreground">{par.action}</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-background border border-border">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 block mb-0.5">Result:</span>
                        <span className="text-muted-foreground">{par.result}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Common Rejection Traps */}
          <div className="mb-14">
            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2.5">
              <ShieldAlert className="w-6 h-6 text-destructive" />
              Common Rejection Traps for {role.title}s
            </h2>
            <p className="text-muted-foreground text-sm mb-6">
              Avoid these 3 technical traps that trigger automatic filters in Workday, Lever, and Greenhouse.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {role.commonRejectionTraps.map((trap, i) => (
                <Card key={i} className="border-destructive/30 bg-destructive/5 flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold text-foreground flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                      <span>{trap.trap}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs space-y-3 pt-0">
                    <div>
                      <span className="font-semibold text-destructive block mb-0.5">Why it fails:</span>
                      <p className="text-muted-foreground leading-relaxed">{trap.whyItFails}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-background/80 border border-border">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 block mb-0.5">The Solution:</span>
                      <p className="text-muted-foreground leading-relaxed">{trap.howToFix}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Interactive ATS Readiness Checklist */}
          <div className="mb-14">
            <Card className="border-border bg-card/80">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListCheck className="w-5 h-5 text-primary" />
                    <CardTitle className="text-xl font-bold">Interactive {role.title} ATS Checklist</CardTitle>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    {completedChecklistCount} of {totalChecklistCount} Completed
                  </Badge>
                </div>
                <CardDescription>
                  Verify your resume satisfies the technical prerequisites for {role.title} positions before applying.
                </CardDescription>
                <div className="mt-3">
                  <Progress value={checklistProgress} className="h-2" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {checklistItems.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-start gap-3 p-3 rounded-xl border border-border/60 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={!!checkedItems[item.id]}
                      onCheckedChange={() => toggleCheckItem(item.id)}
                      className="mt-0.5"
                    />
                    <span
                      className={`text-sm ${
                        checkedItems[item.id]
                          ? "line-through text-muted-foreground font-normal"
                          : "text-foreground font-medium"
                      }`}
                    >
                      {item.label}
                    </span>
                  </label>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Sample ATS Resume Template Preview */}
          <div className="mb-14">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2.5">
                  <FileText className="w-6 h-6 text-primary" />
                  Verified ATS Resume Template
                </h2>
                <p className="text-muted-foreground text-sm">
                  Pre-formatted single-column text layout guaranteed to pass 100% of entity extractors.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyTemplate(role.sampleResumeTemplate)}
              >
                <Copy className="w-4 h-4 mr-1.5" />
                Copy Text
              </Button>
            </div>

            <div className="relative rounded-2xl border border-border bg-muted/30 p-6 overflow-x-auto">
              <pre className="text-xs font-mono text-foreground leading-relaxed whitespace-pre-wrap selection:bg-primary/20">
                {role.sampleResumeTemplate}
              </pre>
            </div>
          </div>

          {/* Role FAQs (Accordion) */}
          <div className="mb-14">
            <h2 className="text-2xl font-bold mb-4">Frequently Asked Questions</h2>
            <Accordion type="single" collapsible className="space-y-2">
              {role.faqs.map((faq, idx) => (
                <AccordionItem
                  key={idx}
                  value={`faq-${idx}`}
                  className="border border-border/60 rounded-xl px-4 bg-card/60"
                >
                  <AccordionTrigger className="text-left font-semibold text-foreground py-4 hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground pb-4 leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {/* Final CTA Banner */}
          <div className="glass rounded-3xl p-8 md:p-12 border border-primary/30 text-center relative overflow-hidden bg-gradient-to-br from-primary/10 via-card to-secondary/10">
            <div className="max-w-2xl mx-auto space-y-4">
              <h2 className="text-3xl font-extrabold text-foreground">
                Ready to optimize your resume for {role.title} roles?
              </h2>
              <p className="text-muted-foreground text-base">
                Upload your resume to our Typst & AI Studio to get an instant ATS score check against this exact {role.title} benchmark.
              </p>
              <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
                <Button asChild size="lg" className="font-bold px-8">
                  <Link to={`/resume?role=${role.slug}`}>
                    Open in Resume Studio
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/free-scan">Run Free ATS Quick Scan</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default RoleLanding;
