import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetchResponse } from "@/api";
import { Layout } from "@/components/layout";
import { Seo } from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  Sparkles,
  Zap,
  Loader2,
  Check,
  X,
  Download,
  FileText,
  AlertCircle,
  WifiOff,
  ArrowRight,
  TrendingUp,
  Target,
  BarChart3,
  Layers,
  CheckCircle2,
  RefreshCw,
  Copy,
  Briefcase,
  SlidersHorizontal,
} from "lucide-react";

interface SamplePreset {
  label: string;
  company: string;
  role: string;
  matchTier: "high" | "medium";
  resume: string;
  jd: string;
}

const SAMPLE_PRESETS: SamplePreset[] = [
  {
    label: "Frontend Engineer",
    company: "Stripe",
    role: "Senior Frontend Engineer",
    matchTier: "high",
    resume: `SENIOR FRONTEND ENGINEER
San Francisco, CA | alex.chen@example.com | github.com/alexchen | linkedin.com/in/alexchen

SUMMARY:
Senior Frontend Engineer with 6+ years of experience engineering high-throughput web applications, microservices, and design systems. Track record of scaling distributed architectures to 4.5M DAUs while reducing p99 latency by 35%.

EXPERIENCE:
Senior Frontend Engineer | Nova Payments Inc. | 2022 - Present
- Architected and deployed reusable design system and micro-frontends serving 4.2M daily active users using React 19, TypeScript, and Vite.
- Improved Core Web Vitals (LCP reduced by 42%, INP under 50ms) via code-splitting, asset streaming, and frontend telemetry.
- Led migration of 40+ legacy components to strict TypeScript with zero regressions.
- Designed real-time WebSocket dashboard for live transactional telemetry and state synchronization.

Senior Frontend Developer | CloudPlatform | 2019 - 2022
- Built interactive analytics dashboards using Next.js, Tailwind CSS, and TanStack Query.
- Implemented comprehensive automated E2E test suites with Playwright and Vitest (94% code coverage).
- Mentored junior engineers and conducted weekly technical architecture reviews.

SKILLS:
Languages & Frameworks: React, TypeScript, JavaScript, Next.js, Node.js, HTML5, CSS3, Tailwind CSS
Architecture: Micro-frontends, REST, GraphQL, WebSockets, Core Web Vitals, Performance Optimization
Testing & Tooling: Playwright, Vitest, Jest, Webpack, Vite, Git, CI/CD Pipelines`,
    jd: `Role: Senior Frontend Engineer
Company: Stripe
Location: Remote (US)

About the Role:
We are looking for a Senior Frontend Engineer to build robust, delightful web applications for Stripe's financial infrastructure. You will architect high-performance UI systems, lead Core Web Vitals optimizations, and build accessible user experiences at global scale.

Requirements:
- 5+ years of experience engineering modern web applications using React, TypeScript, and modern CSS.
- Deep expertise in Core Web Vitals (LCP, INP, CLS) optimization, asset streaming, and frontend telemetry.
- Experience with comprehensive automated testing using Playwright, Vitest, or Cypress.
- Strong architectural skills designing reusable design systems and micro-frontends.
- Familiarity with REST, GraphQL, WebSockets, and state synchronization in distributed applications.
- Track record of mentoring engineers and conducting thorough code reviews.`,
  },
  {
    label: "Distributed Systems Lead",
    company: "Cloudflare",
    role: "Staff Distributed Systems Engineer",
    matchTier: "high",
    resume: `SENIOR BACKEND & INFRASTRUCTURE ENGINEER
Seattle, WA | jordan.vance@example.com | github.com/jordanvance | linkedin.com/in/jordanvance

SUMMARY:
Staff Distributed Systems Lead with 8+ years architecting high-throughput, low-latency streaming infrastructure handling 250k+ events/second. Specializing in Go, Rust, Raft consensus, and resilient storage engines.

EXPERIENCE:
Lead Distributed Systems Engineer | Global Cloud Networks | 2021 - Present
- Architected multi-region event streaming gateway in Go and Rust processing 280,000 requests/sec with p99 latency under 14ms.
- Implemented Raft-based consensus metadata store across 5 geographic regions, guaranteeing zero data loss during cloud zone outages.
- Engineered custom zero-copy memory buffers and SIMD-accelerated serialization, cutting server CPU utilization by 34%.
- Guided disaster recovery architecture and multi-datacenter failover drills, reducing Recovery Time Objective (RTO) from 45 min to under 30 seconds.

Senior Backend Engineer | CloudBase Systems | 2018 - 2021
- Designed and maintained distributed Redis caching tier and Kafka event pipeline powering real-time transactional sync for 15M users.
- Developed gRPC microservices and internal service mesh using Envoy, slashing inter-service networking overhead by 25%.
- Implemented distributed tracing via OpenTelemetry and Prometheus alerting across 80+ microservices.

SKILLS:
Backend & Systems: Go, Rust, C++, Distributed Systems, Consensus (Raft), Concurrency, Memory Profiling
Data & Messaging: Kafka, Redis, PostgreSQL, Cassandra, ScyllaDB, gRPC, Protobuf
Cloud & Ops: Kubernetes, Docker, AWS EC2, Linux Kernel tuning, OpenTelemetry, Prometheus, Grafana`,
    jd: `Role: Staff Systems Infrastructure Engineer
Company: Cloudflare
Location: Remote (US)

Requirements:
- 6+ years building low-latency, mission-critical distributed systems in Go, Rust, or C++.
- Deep understanding of distributed consensus protocols (Raft, Paxos), partition hashing, and distributed caches (Redis, Kafka).
- Proven ability to optimize p99 latency under 20ms and manage multi-region high-availability workloads.
- Hands-on experience with Docker, Kubernetes, and OpenTelemetry instrumentation.
- Strong communication and RFC documentation leadership.`,
  },
  {
    label: "Product Manager",
    company: "Linear",
    role: "Senior Product Manager",
    matchTier: "medium",
    resume: `SENIOR PRODUCT MANAGER
New York, NY | sarah.jenkins@example.com | linkedin.com/in/sarahjenkins

SUMMARY:
Senior Product Manager with 5+ years driving high-growth B2B SaaS solutions from 0 to 1 and scaling to $18M ARR. Expert in user-centric discovery, A/B experimentation, and cross-functional leadership between engineering and commercial teams.

EXPERIENCE:
Senior Product Manager | Pulse Analytics | 2022 - Present
- Spearheaded the end-to-end launch of automated analytics reporting module, driving $4.2M in net new ARR within the first 6 months.
- Ran 24+ controlled A/B experiments on onboarding and checkout funnels, improving trial-to-paid conversion from 3.8% to 6.2%.
- Defined product roadmap and prioritized sprint backlogs for a cross-functional pod of 9 engineers and 2 product designers.
- Conducted 60+ qualitative customer discovery interviews and synthesized telemetry insights to define user personas and product requirements (PRDs).

Product Manager | Horizon Tech | 2019 - 2022
- Owned the self-serve team workspace experience, increasing 30-day user retention by 28% through contextual onboarding guides.
- Authored detailed PRDs, user stories, and acceptance criteria while facilitating weekly sprint planning and backlog grooming.
- Analyzed product telemetry using SQL and Amplitude to identify customer drop-off bottlenecks in the collaboration flow.

SKILLS:
Product Management: Product Roadmapping, PRDs, Customer Discovery, Agile/Scrum, Backlog Prioritization, GTM Strategy
Analytics & Experimentation: SQL, A/B Testing, Amplitude, Mixpanel, Google Analytics, Metabase
Collaboration & Tools: Jira, Confluence, Figma, Linear, Notion, Slack`,
    jd: `Role: Senior Product Manager
Company: Linear
Location: Remote (US / Europe)

About the Role:
Linear is seeking a Senior Product Manager to lead product discovery and execution for our developer workflow and collaboration tools. You will work closely with design and engineering to build fast, opinionated software that teams love using every day.

Requirements:
- 4+ years of product management experience at high-velocity B2B SaaS or developer tools companies.
- Proven track record of taking complex features from customer discovery to PRD specification and GA release.
- Strong analytical skills: fluent with SQL, product analytics (Amplitude, Mixpanel), and cohort retention metrics.
- High aesthetic taste and deep empathy for engineering workflows and product craft.
- Demonstrated ability to prioritize backlogs and run rapid iterative sprint cycles.`,
  },
  {
    label: "Staff AI Engineer",
    company: "Anthropic",
    role: "Senior AI / ML Engineer",
    matchTier: "high",
    resume: `SENIOR AI / ML ENGINEER
Austin, TX | elena.rostova@example.com | github.com/elenarostova | linkedin.com/in/elenarostova

SUMMARY:
Senior AI/ML Engineer with 5+ years of experience designing and deploying production LLM pipelines, RAG systems, and neural NLP models. Reduced inference latency by 45% while deploying AI workflows serving 2M+ monthly queries.

EXPERIENCE:
Senior AI Engineer | Cognitive Systems Inc. | 2022 - Present
- Designed and deployed enterprise RAG pipeline using Python, pgvector, and hybrid BM25 + dense embedding reranking, improving document retrieval accuracy by 38%.
- Optimized LLM inference serving using vLLM and TensorRT-LLM on AWS NVIDIA A10G instances, reducing p95 latency from 850ms to 240ms.
- Fine-tuned open-source LLMs (Llama 3, Mistral) using LoRA/QLoRA for domain-specific code summarization, matching proprietary model performance at 1/6th inference cost.
- Built automated evaluation pipeline with synthetic test sets and LLM-as-a-judge metrics to monitor hallucinations and toxicity in real time.

Machine Learning Engineer | DataCore Labs | 2019 - 2022
- Developed semantic text classification and named entity recognition (NER) models using PyTorch and Hugging Face Transformers.
- Deployed real-time inference microservices using FastAPI and Docker on Kubernetes, handling 5,000 requests/minute.
- Built automated ETL data processing pipelines handling 10TB+ unstructured web text using Apache Spark.

SKILLS:
AI & ML: PyTorch, Hugging Face, Transformers, RAG, LoRA Fine-tuning, LangChain, Embeddings, Prompt Engineering
Serving & MLOps: vLLM, Triton, FastAPI, Docker, Kubernetes, MLflow, Ray, GPU Optimization (CUDA)
Databases & Search: pgvector, Pinecone, Qdrant, Elasticsearch, PostgreSQL
Languages & Tools: Python, C++, SQL, Git, Linux, AWS`,
    jd: `Role: Senior AI / Machine Learning Engineer
Company: Anthropic
Location: San Francisco, CA / Remote

About the Role:
Anthropic is an AI safety and research company building reliable, beneficial AI systems. We are seeking an experienced ML Engineer to develop production inference serving, model evaluation pipelines, and high-throughput retrieval systems.

Requirements:
- 4+ years developing and deploying machine learning models, NLP pipelines, or LLM applications into production.
- Deep expertise in Python, PyTorch, Hugging Face Transformers, and LangChain/LlamaIndex.
- Experience architecting Retrieval-Augmented Generation (RAG) systems and vector databases (pgvector, Pinecone).
- Strong track record in inference acceleration (vLLM, TensorRT-LLM, quantization) on GPU clusters.
- Demonstrated experience building automated evaluation benchmarks to mitigate hallucinations and measure model alignment.`,
  },
];

const FAQS = [
  {
    q: "How is the resume job match score calculated?",
    a: "The resume job match score compares your resume text against the requirements of the job description using semantic NLP algorithms. It measures overlap across critical hard skills, tools, domain competencies, and quantified problem-action-result experiences, returning an objective 0-100% alignment score.",
  },
  {
    q: "Does my resume match this job description?",
    a: "By pasting your resume on the left and the job description on the right, our match calculator extracts both sets of keywords and qualifications. If your match score is 80% or higher, your resume strongly aligns with the role. A score between 60% and 79% indicates moderate alignment with specific missing skills to address before submitting.",
  },
  {
    q: "What is an ATS match rate calculator and why does it matter?",
    a: "An ATS match rate calculator simulates how modern Applicant Tracking Systems (such as Greenhouse, Lever, Ashby, and Workday) parse and rank job candidates. Recruiters receive hundreds of applications per role and frequently use automated filters to prioritize applicants who meet at least 70-80% of the job criteria.",
  },
  {
    q: "What is a good ATS match score to get an interview?",
    a: "A match rate between 75% and 85% is typically the sweet spot for landing recruiter callbacks. You don't need 100% keyword stuffing; in fact, modern transformer-based ATS algorithms penalize repetitive or unnatural keyword placement.",
  },
  {
    q: "How do I fix missing keywords without keyword stuffing?",
    a: "Incorporate missing keywords naturally into your bullet points using the Problem-Action-Result (PAR) formula. Mention the tool or skill in the context of a real project, such as 'Architected Kafka streaming pipeline to process 100k events/sec' rather than creating a comma-separated list of keywords at the bottom of your resume.",
  },
];

export default function JobMatch() {
  const [resumeText, setResumeText] = useState<string>("");
  const [jobDescription, setJobDescription] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<any>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [offline, setOffline] = useState<boolean>(() => typeof navigator !== "undefined" && !navigator.onLine);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      abortRef.current?.abort();
    };
  }, []);

  const loadPreset = (preset: SamplePreset) => {
    setResumeText(preset.resume);
    setJobDescription(preset.jd);
    setActivePreset(preset.label);
    setError("");
    setResult(null);
    toast.success(`Loaded preset: ${preset.role} at ${preset.company}`);
  };

  const handleCalculateMatch = async () => {
    if (offline) {
      setError("You are offline. Please reconnect before running a job match calculation.");
      return;
    }
    if (!resumeText.trim() || !jobDescription.trim()) {
      setError("Please paste both your resume and the target job description before calculating match rate.");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await apiFetchResponse(`/v1/public/analyze-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_text: resumeText,
          job_description: jobDescription,
          custom_instructions: "Perform rigorous semantic job matching analysis. Compare hard skills, soft skills, experience depth, and missing keywords.",
        }),
        signal: controller.signal,
      });

      const data = await res.json();
      const returnedScore = data?.overall_score ?? data?.result?.overall_score;

      if (typeof returnedScore !== "number" || !Number.isFinite(returnedScore)) {
        throw new Error("The service returned no measurable match score. Please check your text and try again.");
      }

      setResult(data);
      toast.success("Job match rate calculated successfully!");
    } catch (caught: any) {
      if (caught?.name !== "AbortError") {
        if (caught?.status === 429) {
          setError("Rate limit reached. Please wait a moment before trying again, or create a free account for higher limits.");
        } else if (caught?.status === 400 || caught?.status === 422) {
          setError("Invalid input. Please ensure both fields contain readable text and try again.");
        } else {
          setError(caught instanceof Error ? caught.message : "Job match analysis failed. Please try again.");
        }
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setLoading(false);
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setLoading(false);
    setError("Match calculation cancelled. Your input fields remain intact.");
  };

  // Extract parsed score and section data
  const score = Math.round(result?.overall_score ?? result?.result?.overall_score ?? 0);
  const rawBreakdown = result?.score_breakdown ?? result?.result?.section_scores ?? {};

  // Use toScoreOrNull: return null when a field is genuinely absent so the UI
  // can render "Not measured" instead of fabricating a value.
  const toScoreOrNull = (val: unknown): number | null =>
    val != null && typeof val === "number" ? Math.round(val) : null;

  const skillsScore = toScoreOrNull(rawBreakdown?.skills_match);
  const experienceScore = toScoreOrNull(
    rawBreakdown?.experience_relevance ?? rawBreakdown?.experience_impact
  );
  const formattingScore = toScoreOrNull(
    rawBreakdown?.formatting ?? result?.result?.ats_compliance?.score
  );
  const educationScore = toScoreOrNull(rawBreakdown?.education_fit);

  const matchedKeywords: string[] = result?.matching_skills ?? result?.result?.matched_keywords ?? [];
  const missingKeywords: string[] = result?.missing_skills ?? result?.result?.missing_keywords ?? [];
  const recommendations: string[] = result?.recommendations ?? result?.result?.recommendations ?? [];
  const summary: string = result?.result?.summary ?? result?.summary ?? "";

  const exportMatchJSON = () => {
    if (!result) return;
    // Omit null section scores from the export so consumers know fields are
    // genuinely unmeasured rather than scored as zero.
    const sectionBreakdown: Record<string, number> = {};
    if (skillsScore != null) sectionBreakdown.skills_match = skillsScore;
    if (experienceScore != null) sectionBreakdown.experience_relevance = experienceScore;
    if (formattingScore != null) sectionBreakdown.formatting_compliance = formattingScore;
    if (educationScore != null) sectionBreakdown.education_fit = educationScore;
    const auditData = {
      tool: "Job Tayari Resume Job Match Rate Calculator",
      version: "2026.1",
      target_keywords: ["resume job match score", "does my resume match this job", "ATS match rate calculator"],
      timestamp: new Date().toISOString(),
      match_score_percentage: score,
      section_breakdown: sectionBreakdown,
      matched_keywords: matchedKeywords,
      missing_keywords: missingKeywords,
      recommendations,
      summary,
    };

    const blob = new Blob([JSON.stringify(auditData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `job_match_rate_audit_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Job Match audit downloaded as JSON");
  };

  const getScoreColorClass = (s: number) => {
    if (s >= 80) return "text-success border-success/40 bg-success/10";
    if (s >= 60) return "text-warning border-warning/40 bg-warning/10";
    return "text-destructive border-destructive/40 bg-destructive/10";
  };

  const getScoreTextColor = (s: number) => {
    if (s >= 80) return "text-success";
    if (s >= 60) return "text-warning";
    return "text-destructive";
  };

  const resumeWordCount = resumeText.trim().split(/\s+/).filter(Boolean).length;
  const jdWordCount = jobDescription.trim().split(/\s+/).filter(Boolean).length;

  const seoJsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Resume Job Match Score & ATS Match Rate Calculator",
      url: "https://tayari-skill-boost.lovable.app/job-match",
      description: "Free zero-auth side-by-side ATS resume match rate calculator. Check does your resume match this job description, analyze keyword overlap, and identify missing requirements.",
      applicationCategory: "BusinessApplication",
      operatingSystem: "All",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      featureList: [
        "Side-by-side resume vs job description comparison",
        "Instant ATS match rate calculation (0-100%)",
        "Green/red matched and missing keyword badges",
        "Overlap analysis across hard skills and experience",
        "Prioritized action items to close the gap",
        "1-click sample role presets",
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: f.a,
        },
      })),
    },
  ];

  return (
    <Layout>
      <Seo
        title="Resume Job Match Score Calculator | Does My Resume Match This Job?"
        description="Free ATS match rate calculator. Check does your resume match this job description, discover missing keywords, view overlap breakdown, and get actionable recommendations."
        path="/job-match"
        jsonLd={seoJsonLd}
      />

      <div className="min-h-screen bg-gradient-hero py-10 md:py-16">
        <div className="container mx-auto px-4 max-w-5xl">
          {/* Hero Section */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Free ATS Match Rate Calculator</span>
            </div>
            <h1 className="font-display text-balance text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
              Does Your Resume <span className="text-gradient">Match This Job</span>?
            </h1>
            <p className="text-balance text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
              Compare your resume against any target job description side-by-side. Calculate your match percentage, uncover missing keywords, and get tailored action items.
            </p>
          </div>

          {/* Quick Presets for Instant 1-Click Testing */}
          <div className="mb-6 rounded-xl border border-border/70 bg-card/60 p-4 backdrop-blur-md shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 font-mono">
                <Briefcase className="h-3.5 w-3.5 text-primary" /> Load Sample Match Pair:
              </span>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant={activePreset === preset.label ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => loadPreset(preset)}
                    className="text-xs h-7 font-medium active:scale-[0.98]"
                  >
                    {preset.label} ({preset.company})
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Offline Warning Banner */}
          {offline && (
            <div
              role="status"
              aria-live="polite"
              className="mb-6 flex items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300"
            >
              <WifiOff className="h-4 w-4 shrink-0" />
              <span>You are offline. Reconnect your network to calculate your job match score.</span>
            </div>
          )}

          {/* Side-by-Side Split Match Tool */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Left Pane: Your Resume */}
            <Card className="border-border bg-card/80 shadow-md flex flex-col">
              <CardHeader className="pb-3 border-b border-border/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <label htmlFor="jobmatch-resume" className="font-semibold text-sm cursor-pointer">
                      Your Resume
                    </label>
                  </div>
                  {resumeWordCount > 0 && (
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {resumeWordCount} words
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-3 flex-1 flex flex-col">
                <textarea
                  id="jobmatch-resume"
                  aria-label="Your Resume Text"
                  aria-invalid={Boolean(error && !resumeText.trim())}
                  value={resumeText}
                  onChange={(e) => {
                    setResumeText(e.target.value);
                    setActivePreset(null);
                    if (error) setError("");
                  }}
                  placeholder="Paste your full resume text here (Summary, Experience, Skills, Education)..."
                  rows={14}
                  className="w-full flex-1 px-4 py-3 rounded-xl border border-border bg-background/90 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y font-mono text-xs leading-relaxed"
                />
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Candidate resume text</span>
                  {resumeText && (
                    <button
                      type="button"
                      onClick={() => setResumeText("")}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Right Pane: Target Job Description */}
            <Card className="border-border bg-card/80 shadow-md flex flex-col">
              <CardHeader className="pb-3 border-b border-border/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <label htmlFor="jobmatch-jd" className="font-semibold text-sm cursor-pointer">
                      Target Job Description
                    </label>
                  </div>
                  {jdWordCount > 0 && (
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {jdWordCount} words
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-3 flex-1 flex flex-col">
                <textarea
                  id="jobmatch-jd"
                  aria-label="Target Job Description"
                  aria-invalid={Boolean(error && !jobDescription.trim())}
                  value={jobDescription}
                  onChange={(e) => {
                    setJobDescription(e.target.value);
                    setActivePreset(null);
                    if (error) setError("");
                  }}
                  placeholder="Paste the target job description here (Requirements, Responsibilities, Qualifications)..."
                  rows={14}
                  className="w-full flex-1 px-4 py-3 rounded-xl border border-border bg-background/90 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y font-mono text-xs leading-relaxed"
                />
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Requisition requirements</span>
                  {jobDescription && (
                    <button
                      type="button"
                      onClick={() => setJobDescription("")}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Calculate Button & Action Controls */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <Button
              size="lg"
              onClick={handleCalculateMatch}
              disabled={loading || offline || !resumeText.trim() || !jobDescription.trim()}
              aria-busy={loading}
              className="px-8 font-semibold shadow-md active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Calculating Semantic Match...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5 mr-2 text-primary-foreground" />
                  Calculate Match Rate Free
                </>
              )}
            </Button>
            {loading && (
              <Button type="button" size="lg" variant="outline" onClick={handleCancel} className="active:scale-[0.98]">
                Cancel
              </Button>
            )}
          </div>

          {/* Error Banner */}
          {error && (
            <Card role="alert" aria-live="assertive" className="border-destructive/60 bg-destructive/10 mb-8">
              <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-5 pb-5">
                <div className="flex items-center gap-2.5 text-destructive text-sm font-medium">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <span>{error}</span>
                </div>
                <div className="shrink-0">
                  {error.toLowerCase().includes("rate limit") ? (
                    <Button size="sm" asChild>
                      <Link to="/auth?redirect=/job-match">Create Free Account</Link>
                    </Button>
                  ) : (
                    !loading &&
                    !offline &&
                    resumeText.trim() &&
                    jobDescription.trim() && (
                      <Button type="button" size="sm" variant="outline" onClick={handleCalculateMatch}>
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Try Again
                      </Button>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results Section */}
          {result && (
            <div className="space-y-8 mb-12 animate-in fade-in-50 duration-300">
              {/* Header Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border/80 bg-card/70 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary">
                    Match Analysis Complete
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Target Role Alignment Score
                  </span>
                </div>
                <Button size="sm" variant="outline" onClick={exportMatchJSON} className="text-xs h-8">
                  <Download className="mr-1.5 h-3.5 w-3.5 text-primary" /> Export Match JSON
                </Button>
              </div>

              {/* Match Rate Percentage Meter Card */}
              <Card className="border-border/80 bg-card/80 backdrop-blur-md shadow-xl text-center">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-xl sm:text-2xl font-bold">
                    Resume Job Match Rate
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Direct keyword and semantic capability overlap with the target requisition
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 pb-8">
                  {/* Gauge Ring */}
                  <div className="relative w-44 h-44 mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                      <circle
                        cx="80"
                        cy="80"
                        r="68"
                        fill="none"
                        className="stroke-muted/40"
                        strokeWidth="12"
                      />
                      <circle
                        cx="80"
                        cy="80"
                        r="68"
                        fill="none"
                        className={`transition-all duration-1000 ease-out ${
                          score >= 80
                            ? "stroke-emerald-500"
                            : score >= 60
                            ? "stroke-amber-500"
                            : "stroke-red-500"
                        }`}
                        strokeWidth="12"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 68}
                        strokeDashoffset={2 * Math.PI * 68 * (1 - score / 100)}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-5xl font-black font-mono tabular-nums tracking-tight ${getScoreTextColor(score)}`}>
                        {score}%
                      </span>
                      <span className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
                        Match Rate
                      </span>
                    </div>
                  </div>

                  {/* Rating Tier Badge */}
                  <div className="mb-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-semibold ${getScoreColorClass(
                        score
                      )}`}
                    >
                      {score >= 80 ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" /> Strong Role Match — Interview Ready
                        </>
                      ) : score >= 60 ? (
                        <>
                          <TrendingUp className="h-4 w-4" /> Moderate Match — Needs Targeted Keywords
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4" /> Significant Gap — Tailoring Required
                        </>
                      )}
                    </span>
                  </div>

                  {/* Summary */}
                  <p className="text-balance text-muted-foreground text-sm max-w-xl mx-auto leading-relaxed">
                    {summary ||
                      (score >= 80
                        ? "Your resume shows exceptional alignment with the core responsibilities and technical tools specified in this job description. Your profile is well-positioned for recruiter screening."
                        : score >= 60
                        ? "Your resume demonstrates transferable experience, but several required technologies or metrics are missing or under-emphasized. Review the missing keywords below to tailor your resume."
                        : "There is a significant gap between your current resume content and this role's hard requirements. Tailoring your experience bullets to reflect the required tools is essential before applying.")}
                  </p>
                </CardContent>
              </Card>

              {/* Overlap Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-border/70 bg-card/60">
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-blue-500" /> Hard Skills Overlap
                      </span>
                      <span className="font-mono text-sm font-bold tabular-nums">
                        {skillsScore != null ? `${skillsScore}%` : "Not measured"}
                      </span>
                    </div>
                    <Progress value={skillsScore ?? 0} className="h-2 mb-2" />
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Core languages, frameworks, and tools explicitly requested by the employer.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border/70 bg-card/60">
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <BarChart3 className="h-3.5 w-3.5 text-emerald-500" /> Experience Fit
                      </span>
                      <span className="font-mono text-sm font-bold tabular-nums">
                        {experienceScore != null ? `${experienceScore}%` : "Not measured"}
                      </span>
                    </div>
                    <Progress value={experienceScore ?? 0} className="h-2 mb-2" />
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Relevance of previous job titles, project scale, and quantifiable results.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border/70 bg-card/60">
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <SlidersHorizontal className="h-3.5 w-3.5 text-purple-500" /> ATS Parseability
                      </span>
                      <span className="font-mono text-sm font-bold tabular-nums">
                        {formattingScore != null ? `${formattingScore}%` : "Not measured"}
                      </span>
                    </div>
                    <Progress value={formattingScore ?? 0} className="h-2 mb-2" />
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Clean parsing of job dates, company names, and bullet point structure.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border/70 bg-card/60">
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-amber-500" /> Domain Alignment
                      </span>
                      <span className="font-mono text-sm font-bold tabular-nums">
                        {educationScore != null ? `${educationScore}%` : "Not measured"}
                      </span>
                    </div>
                    <Progress value={educationScore ?? 0} className="h-2 mb-2" />
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Industry background, education requirements, and specialized domain knowledge.
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Keyword Badges: Matched (Green) & Missing (Amber/Red) */}
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="border-success/30 bg-card/70">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold text-success flex items-center gap-2">
                        <Check className="h-4 w-4" /> Matched Keywords ({matchedKeywords.length})
                      </CardTitle>
                      <Badge variant="outline" className="border-success/30 text-success text-xs font-mono">
                        Present in Both
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      Key competencies and technologies found in both your resume and this job post:
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {matchedKeywords.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {matchedKeywords.map((kw, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-md bg-success/10 text-success text-xs border border-success/20 font-medium inline-flex items-center gap-1"
                          >
                            <Check className="h-3 w-3" /> {kw}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No exact keyword matches found.</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-destructive/30 bg-card/70">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold text-destructive flex items-center gap-2">
                        <X className="h-4 w-4" /> Missing Job Keywords ({missingKeywords.length})
                      </CardTitle>
                      <Badge variant="outline" className="border-destructive/30 text-destructive text-xs font-mono">
                        Required in Job
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      Important job terms not found on your resume. Add these naturally with real project context:
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {missingKeywords.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {missingKeywords.map((kw, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-md bg-destructive/10 text-destructive text-xs border border-destructive/20 font-medium inline-flex items-center gap-1"
                          >
                            <X className="h-3 w-3" /> {kw}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No missing keywords detected!</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Action Items to Close the Match Gap */}
              {recommendations.length > 0 && (
                <Card className="border-border/80 bg-card/70 backdrop-blur-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" /> Action Items to Bridge Your Match Gap
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Specific adjustments to incorporate into your resume before applying:
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-3 text-xs sm:text-sm text-foreground leading-relaxed">
                          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary font-mono text-[11px] font-bold shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Tailor Resume CTA Card */}
              <Card className="border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card p-6 md:p-8 text-center shadow-lg">
                <div className="max-w-xl mx-auto space-y-4">
                  <Badge variant="secondary" className="font-semibold text-xs text-primary bg-primary/15 border-primary/25">
                    1-Click Resume Tailoring
                  </Badge>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
                    Tailor your resume directly for this job opening
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Job Tayari's Resume Optimizer automatically injects missing keywords into truthful bullet points, emphasizes matching domain experience, and exports an ATS-proof Typst PDF.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <Button size="lg" asChild className="font-semibold shadow-md active:scale-[0.98]">
                      <Link to="/resume">
                        Tailor Resume in Studio <ArrowRight className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                    <Button variant="outline" size="lg" asChild className="active:scale-[0.98]">
                      <Link to="/pricing">See Pro Pricing</Link>
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Educational Content & Programmatic SEO FAQ Section */}
          <div className="mt-16 pt-12 border-t border-border/60">
            <div className="text-center mb-8">
              <h2 className="font-display text-2xl sm:text-3xl font-bold mb-3 tracking-tight">
                Frequently Asked Questions: ATS Resume Job Matching
              </h2>
              <p className="text-muted-foreground text-sm max-w-xl mx-auto">
                Learn how recruiters evaluate resume match rates and how to pass automated ATS screening filters.
              </p>
            </div>

            <div className="max-w-3xl mx-auto">
              <Accordion type="single" collapsible className="w-full">
                {FAQS.map((faq, index) => (
                  <AccordionItem key={index} value={`faq-${index}`}>
                    <AccordionTrigger className="text-left text-sm font-semibold hover:no-underline hover:text-primary">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
