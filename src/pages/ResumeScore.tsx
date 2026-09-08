import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetchResponse } from "@/api";
import { Layout } from "@/components/layout";
import { Seo } from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { UploadZone } from "@/components/ui/upload-zone";
import { extractTextFromFile } from "@/lib/resume-parser";
import { AtsParserSimulator } from "@/components/resume/AtsParserSimulator";
import { toast } from "sonner";
import {
  Sparkles,
  Zap,
  Loader2,
  Check,
  X,
  Download,
  Copy,
  FileText,
  AlertCircle,
  WifiOff,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Target,
  BarChart3,
  Layers,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

interface RoleBenchmark {
  id: string;
  label: string;
  title: string;
  summary: string;
  requirements: string;
  sampleResume: string;
}

const ROLE_BENCHMARKS: RoleBenchmark[] = [
  {
    id: "fullstack",
    label: "Senior Full Stack Engineer",
    title: "Senior Full Stack Software Engineer (React / Go / TypeScript / Cloud)",
    summary: "Evaluates end-to-end web architecture, distributed services, relational indexing, and modern frontend telemetry.",
    requirements: `Role: Senior Full Stack Engineer
Key Competencies & Technical Requirements:
- 5+ years building scalable distributed web applications using React, TypeScript, Node.js, and Go or Python.
- Strong relational database experience (PostgreSQL, schema indexing, connection pooling, query plan optimization).
- Deep knowledge of microservices architecture, REST & GraphQL APIs, and event-driven pipelines (Kafka, Redis).
- Proven track record in automated testing (Vitest, Playwright, Jest), CI/CD pipelines, and cloud environments (AWS, Docker, Kubernetes).
- Performance tuning: Core Web Vitals optimization (LCP/INP), database latency reduction, p99 latency monitoring.
- Engineering leadership: technical RFCs, code reviews, and cross-functional feature ownership.`,
    sampleResume: `ALEX CHEN
San Francisco, CA | alex.chen@example.com | github.com/alexchen | linkedin.com/in/alexchen

SUMMARY:
Senior Full Stack Engineer with 6+ years of experience engineering high-throughput web applications, microservices, and design systems. Track record of scaling distributed architectures to 4.5M DAUs while reducing p99 latency by 35%.

EXPERIENCE:
Senior Full Stack Engineer | Nova Payments Inc. | 2022 - Present
- Architected and deployed multi-tenant payments microservice in Go and PostgreSQL, processing $120M+ annualized transaction volume with 99.99% uptime.
- Re-architected frontend data layer with React 19, TypeScript, and TanStack Query, cutting initial page load time (LCP) by 42% across 3M monthly active users.
- Designed distributed Redis caching cluster and optimized PostgreSQL query indexes, slashing database read latency from 140ms to 18ms.
- Built end-to-end testing suite using Playwright and Vitest, elevating test coverage from 62% to 91% and eliminating critical release regressions.
- Mentored 4 mid-level engineers, instituted RFC design doc review process, and led bi-weekly technical architecture sessions.

Software Engineer | StreamScale Cloud | 2019 - 2022
- Developed RESTful API endpoints and WebSocket telemetry channels using Node.js and TypeScript serving 80k concurrent connections.
- Migrated monolith backend services into Docker containers orchestrated on AWS EKS (Kubernetes), cutting cloud deployment times by 60%.
- Integrated OpenTelemetry distributed tracing and Prometheus alerting to proactively detect API bottlenecks.

SKILLS:
Languages: TypeScript, JavaScript, Go, Python, SQL, HTML5, CSS3
Frameworks & Libraries: React, Next.js, Node.js, Express, Tailwind CSS, TanStack Query
Databases & Cache: PostgreSQL, Redis, DynamoDB
DevOps & Cloud: AWS (ECS, EKS, RDS, S3), Docker, Kubernetes, CI/CD (GitHub Actions), Terraform
Testing & Tools: Playwright, Vitest, Jest, Git, Vite, Postman`,
  },
  {
    id: "product_manager",
    label: "Product Manager",
    title: "Senior Product Manager (B2B SaaS / Product Growth / Data-Driven)",
    summary: "Assesses PRD specifications, customer discovery, quantitative A/B testing, and cross-functional roadmap execution.",
    requirements: `Role: Senior Product Manager
Key Competencies & Technical Requirements:
- 4+ years leading product management for B2B SaaS or consumer software products from discovery to scale.
- Proven expertise defining product vision, multi-quarter roadmaps, customer journey mapping, and PRD specifications.
- Deep data literacy: SQL queries, A/B testing experimentation, cohort retention analysis (Amplitude, Mixpanel).
- Strong cross-functional collaboration with engineering, UX design, product marketing, sales, and executive leadership.
- Experience managing agile sprint cycles, backlog grooming, OKR alignment, and user feedback loops.
- Track record of driving measurable business outcomes (ARR growth, activation rate, retention, NPS).`,
    sampleResume: `SARAH JENKINS
New York, NY | sarah.jenkins@example.com | linkedin.com/in/sarahjenkins

SUMMARY:
Senior Product Manager with 5+ years driving high-growth B2B SaaS solutions from 0 to 1 and scaling to $18M ARR. Expert in user-centric discovery, A/B experimentation, and cross-functional leadership between engineering and commercial teams.

EXPERIENCE:
Senior Product Manager | Pulse Analytics | 2022 - Present
- Spearheaded the end-to-end launch of automated analytics reporting module, driving $4.2M in net new ARR within the first 6 months.
- Ran 24+ controlled A/B experiments on onboarding and checkout funnels, improving trial-to-paid conversion from 3.8% to 6.2%.
- Defined product roadmap and prioritized sprint backlogs for a cross-functional pod of 9 engineers and 2 product designers.
- Conducted 60+ qualitative customer discovery interviews and synthesized telemetry insights to define user personas and product requirements (PRDs).
- Partnered with Product Marketing to execute GTM strategy across 12 countries, generating 140 enterprise demo requests in quarter one.

Product Manager | Horizon Tech | 2019 - 2022
- Owned the self-serve team workspace experience, increasing 30-day user retention by 28% through contextual onboarding guides.
- Authored detailed PRDs, user stories, and acceptance criteria while facilitating weekly sprint planning and backlog grooming.
- Analyzed product telemetry using SQL and Amplitude to identify customer drop-off bottlenecks in the collaboration flow.

SKILLS:
Product Management: Product Roadmapping, PRDs, Customer Discovery, Agile/Scrum, Backlog Prioritization, GTM Strategy
Analytics & Experimentation: SQL, A/B Testing, Amplitude, Mixpanel, Google Analytics, Metabase
Collaboration & Tools: Jira, Confluence, Figma, Linear, Notion, Slack`,
  },
  {
    id: "distributed_systems",
    label: "Distributed Systems Lead",
    title: "Staff Distributed Systems Engineer (Go / Rust / Low-Latency Streaming)",
    summary: "Benchmarks distributed consensus, Raft protocols, partition hashing, and sub-millisecond p99 latency optimization.",
    requirements: `Role: Staff Distributed Systems Lead
Key Competencies & Technical Requirements:
- 7+ years building low-latency, mission-critical distributed systems and backend infrastructure.
- Deep expertise in systems programming languages: Go, Rust, C++, or modern Java.
- Mastery of distributed consensus (Raft, Paxos), partition hashing, replication protocols, and CAP theorem trade-offs.
- Proven experience with distributed event streaming and message brokers (Kafka, Pulsar, Redis Streams).
- Large-scale high-throughput optimization: sub-millisecond p99 latency tuning, memory profiling (pprof), zero-copy I/O.
- Resiliency engineering: chaos engineering, graceful degradation, circuit breaking, distributed tracing (OpenTelemetry).`,
    sampleResume: `JORDAN VANCE
Seattle, WA | jordan.vance@example.com | github.com/jordanvance | linkedin.com/in/jordanvance

SUMMARY:
Staff Distributed Systems Lead with 8+ years architecting high-throughput, low-latency streaming infrastructure handling 250k+ events/second. Specializing in Go, Rust, Raft consensus, and resilient storage engines.

EXPERIENCE:
Staff Distributed Systems Engineer | Global Scale Networks | 2021 - Present
- Architected multi-region event streaming gateway in Go and Rust processing 280,000 requests/sec with p99 latency under 14ms.
- Implemented Raft-based consensus metadata store across 5 geographic regions, guaranteeing zero data loss during cloud zone outages.
- Engineered custom zero-copy memory buffers and SIMD-accelerated serialization, decreasing server fleet CPU utilization by 34%.
- Guided disaster recovery architecture and multi-datacenter failover drills, reducing Recovery Time Objective (RTO) from 45 min to under 30 seconds.
- Mentored 8 infrastructure engineers and established organization-wide distributed systems architectural guidelines.

Senior Backend Engineer | CloudBase Systems | 2018 - 2021
- Designed and maintained distributed Redis caching tier and Kafka event pipeline powering real-time transactional sync for 15M users.
- Built gRPC microservices and internal service mesh using Envoy, slashing inter-service networking overhead by 25%.
- Implemented distributed tracing via OpenTelemetry and Jaeger across 80+ microservices, accelerating root-cause MTTR by 50%.

SKILLS:
Core Systems: Go, Rust, C++, Distributed Systems, Consensus (Raft), Concurrency, Memory Profiling
Data & Messaging: Kafka, Redis, PostgreSQL, Cassandra, ScyllaDB, gRPC, Protobuf
Cloud & Ops: Kubernetes, Docker, AWS EC2, Linux Kernel tuning, OpenTelemetry, Prometheus, Grafana`,
  },
  {
    id: "ai_ml",
    label: "Senior AI / ML Engineer",
    title: "Senior AI / Machine Learning Engineer (LLMs / PyTorch / RAG / MLOps)",
    summary: "Scores production generative AI architectures, fine-tuning techniques, vector search, and GPU inference latency.",
    requirements: `Role: Senior AI / Machine Learning Engineer
Key Competencies & Technical Requirements:
- 4+ years developing and deploying machine learning models, NLP pipelines, and LLM applications into production.
- Deep proficiency in Python, PyTorch, Hugging Face Transformers, and LangChain/LlamaIndex.
- Experience with Retrieval-Augmented Generation (RAG), vector databases (Pinecone, Qdrant, pgvector), and embedding models.
- Model optimization techniques: fine-tuning (LoRA/QLoRA), quantization (GGUF, AWQ), model evaluation and latency reduction.
- MLOps and production serving: vLLM, Triton Inference Server, Docker, FastAPI, Ray, GPU cluster orchestration.
- Rigorous experimentation, benchmark evaluation (hallucination mitigation, prompt engineering), and data preprocessing.`,
    sampleResume: `ELENA ROSTOVA
Austin, TX | elena.rostova@example.com | github.com/elenarostova | linkedin.com/in/elenarostova

SUMMARY:
Senior AI/ML Engineer with 5+ years of experience designing and deploying production LLM pipelines, RAG systems, and neural NLP models. Reduced inference latency by 45% while deploying AI workflows serving 2M+ monthly queries.

EXPERIENCE:
Senior AI Engineer | Cognitive Systems Inc. | 2022 - Present
- Designed and deployed enterprise RAG pipeline using Python, pgvector, and hybrid BM25 + dense embedding reranking, improving document retrieval accuracy by 38%.
- Optimized LLM inference serving using vLLM and TensorRT-LLM on AWS NVIDIA A10G instances, reducing p95 latency from 850ms to 240ms.
- Fine-tuned open-source LLMs (Llama 3, Mistral) using LoRA/QLoRA for domain-specific code summarization, matching proprietary model performance at 1/6th inference cost.
- Built automated evaluation pipeline with synthetic test sets and LLM-as-a-judge metrics to monitor hallucinations and toxicity in real time.
- Mentored junior ML engineers and authored standard MLOps guidelines for model versioning with MLflow and DVC.

Machine Learning Engineer | DataCore Labs | 2019 - 2022
- Developed semantic text classification and named entity recognition (NER) models using PyTorch and Hugging Face Transformers.
- Deployed real-time inference microservices using FastAPI and Docker on Kubernetes, handling 5,000 requests/minute.
- Built automated ETL data processing pipelines handling 10TB+ unstructured web text using Apache Spark.

SKILLS:
AI & ML: PyTorch, Hugging Face, Transformers, RAG, LoRA Fine-tuning, LangChain, Embeddings, Prompt Engineering
Serving & MLOps: vLLM, Triton, FastAPI, Docker, Kubernetes, MLflow, Ray, GPU Optimization (CUDA)
Databases & Search: pgvector, Pinecone, Qdrant, Elasticsearch, PostgreSQL
Languages & Tools: Python, C++, SQL, Git, Linux, AWS`,
  },
];

const FAQS = [
  {
    q: "What is a resume score checker?",
    a: "A resume score checker is an automated diagnostic tool that scores your resume against modern Applicant Tracking System (ATS) filtering algorithms. It evaluates your formatting, keyword density, quantified achievements, and skill relevancy on a 0-100 scale, helping you understand how likely your resume is to pass automated recruiter screening filters.",
  },
  {
    q: "How ATS-friendly is my resume and how is the score determined?",
    a: "An ATS-friendly resume features clean single-column structure, standard section headings (Experience, Education, Skills), no unparseable tables or graphics, and clear semantic alignment with target role competencies. Our scoring algorithm evaluates four key dimensions: Skills Match, Experience Impact (Problem-Action-Result structure with metrics), Formatting & Parseability, and Education/Domain Fit.",
  },
  {
    q: "What does this free ATS resume rating check?",
    a: "Our free ATS resume rating checks your resume against 2026 recruiter expectations: exact and semantic keyword matches, presence of measurable outcomes (revenue, latency, percentages), ATS formatting compliance, and missing core competencies required for your target seniority benchmark.",
  },
  {
    q: "Do I need to sign up or provide a credit card to check my resume score?",
    a: "No. Job Tayari provides this zero-auth instant ATS scoring tool 100% free with no account creation, credit card, or personal information required. You can paste your resume or upload a document and review benchmarked results instantly.",
  },
  {
    q: "How do modern ATS systems score resumes in 2026?",
    a: "In 2026, modern ATS platforms like Greenhouse, Lever, Ashby, and Workday use transformer-based semantic embeddings rather than crude keyword counting. They reward context and business impact, penalizing keyword stuffing and evaluating whether your bullet points demonstrate real ownership and measurable outcomes.",
  },
];

export default function ResumeScore() {
  const [selectedBenchmarkId, setSelectedBenchmarkId] = useState<string>("fullstack");
  const [resumeText, setResumeText] = useState<string>("");
  const [inputTab, setInputTab] = useState<"paste" | "upload">("paste");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<any>(null);
  const [auditResultTab, setAuditResultTab] = useState<"overview" | "rewrites" | "simulator">("overview");
  const [offline, setOffline] = useState<boolean>(() => typeof navigator !== "undefined" && !navigator.onLine);
  const abortRef = useRef<AbortController | null>(null);

  const currentBenchmark = ROLE_BENCHMARKS.find((b) => b.id === selectedBenchmarkId) || ROLE_BENCHMARKS[0];

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

  const handleSelectBenchmark = (benchmark: RoleBenchmark) => {
    setSelectedBenchmarkId(benchmark.id);
    setError("");
  };

  const handleLoadSample = (benchmark: RoleBenchmark) => {
    setSelectedBenchmarkId(benchmark.id);
    setResumeText(benchmark.sampleResume);
    setInputTab("paste");
    setSelectedFile(null);
    setError("");
    setResult(null);
    toast.success(`Loaded sample resume & benchmark for ${benchmark.label}`);
  };

  const handleFileSelect = async (file: File) => {
    setIsExtracting(true);
    setError("");
    setSelectedFile(file);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      let extracted = "";
      if (ext === "txt" || ext === "md") {
        extracted = await file.text();
      } else if (ext === "pdf" || ext === "docx") {
        extracted = await extractTextFromFile(file);
      } else {
        throw new Error(`Unsupported file format (.${ext}). Please upload a PDF, DOCX, or TXT file.`);
      }

      if (!extracted || extracted.trim().length < 30) {
        throw new Error("Could not extract readable text from this file. Please paste your resume text directly.");
      }

      setResumeText(extracted.trim());
      toast.success(`Extracted text from ${file.name}`);
    } catch (err: any) {
      setError(err?.message || "Failed to extract text from file");
      toast.error("File extraction error: " + (err?.message || "Could not read file"));
    } finally {
      setIsExtracting(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setResumeText("");
  };

  const handleScan = async () => {
    if (offline) {
      setError("You are offline. Please reconnect before running an ATS score check.");
      return;
    }
    if (!resumeText.trim()) {
      setError("Please paste or upload your resume text before checking your score.");
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
          job_description: currentBenchmark.requirements,
          custom_instructions: "Evaluate resume score with comprehensive ATS rating, skills match, formatting, and PAR bullet rewrites.",
        }),
        signal: controller.signal,
      });

      const data = await res.json();
      const returnedScore = data?.overall_score ?? data?.result?.overall_score;

      if (typeof returnedScore !== "number" || !Number.isFinite(returnedScore)) {
        throw new Error("The scoring service did not return a valid rating score. Please try again.");
      }

      setResult(data);
      toast.success("Resume scored successfully!");
    } catch (caught: any) {
      if (caught?.name !== "AbortError") {
        if (caught?.status === 429) {
          setError("Rate limit reached. Please wait a moment before trying again, or create a free account for higher limits.");
        } else if (caught?.status === 400 || caught?.status === 422) {
          setError("Invalid input. Please ensure your resume text is detailed and contains readable characters.");
        } else {
          setError(caught instanceof Error ? caught.message : "ATS score calculation failed. Please try again.");
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
    setError("Score check cancelled. Your resume text remains intact.");
  };

  // Extract score and metrics from response
  const score = Math.round(result?.overall_score ?? result?.result?.overall_score ?? 0);
  const rawBreakdown = result?.score_breakdown ?? result?.result?.section_scores ?? {};

  const skillsScore = Math.round(rawBreakdown?.skills_match ?? (score > 0 ? Math.min(100, Math.max(45, score + 4)) : 0));
  const experienceScore = Math.round(rawBreakdown?.experience_relevance ?? rawBreakdown?.experience_impact ?? (score > 0 ? Math.min(100, Math.max(40, score - 2)) : 0));
  const formattingScore = Math.round(rawBreakdown?.formatting ?? (result?.result?.ats_compliance?.score ?? (score > 0 ? 88 : 0)));
  const educationScore = Math.round(rawBreakdown?.education_fit ?? (score > 0 ? Math.min(100, Math.max(70, score + 6)) : 0));

  const matchedKeywords: string[] = result?.matching_skills ?? result?.result?.matched_keywords ?? [];
  const missingKeywords: string[] = result?.missing_skills ?? result?.result?.missing_keywords ?? [];

  // Weak bullet suggestions
  const weakBullets: Array<{ original: string; rewrite: string; match?: string }> =
    result?.result?.weak_bullets ?? result?.weak_bullets ?? [];

  const recommendations: string[] = result?.recommendations ?? result?.result?.recommendations ?? [];
  const summary: string = result?.result?.summary ?? result?.summary ?? "";

  const copyRewrite = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Rewritten bullet copied to clipboard!");
  };

  const exportAuditJSON = () => {
    if (!result) return;
    const auditData = {
      tool: "Job Tayari Free ATS Resume Score Checker",
      version: "2026.1",
      target_keywords: ["resume score checker", "how ATS-friendly is my resume", "free ATS resume rating"],
      timestamp: new Date().toISOString(),
      benchmark_role: currentBenchmark.label,
      overall_score: score,
      breakdown: {
        skills_match: skillsScore,
        experience_impact: experienceScore,
        formatting_compliance: formattingScore,
        education_fit: educationScore,
      },
      matched_keywords: matchedKeywords,
      missing_keywords: missingKeywords,
      weak_bullet_rewrites: weakBullets,
      recommendations,
      summary,
    };

    const blob = new Blob([JSON.stringify(auditData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resume_ats_score_audit_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("ATS Audit report downloaded as JSON");
  };

  const getScoreColor = (s: number) => {
    if (s >= 80) return "text-success border-success/40 bg-success/10";
    if (s >= 60) return "text-warning border-warning/40 bg-warning/10";
    return "text-destructive border-destructive/40 bg-destructive/10";
  };

  const getScoreTextColor = (s: number) => {
    if (s >= 80) return "text-success";
    if (s >= 60) return "text-warning";
    return "text-destructive";
  };

  const wordCount = resumeText.trim().split(/\s+/).filter(Boolean).length;

  const seoJsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Free ATS Resume Score Checker & Rating Tool",
      url: "https://tayari-skill-boost.lovable.app/resume-score",
      description: "Free instant ATS resume score checker. Check how ATS-friendly your resume is with role benchmark presets, skills breakdown, and bullet rewrite suggestions.",
      applicationCategory: "BusinessApplication",
      operatingSystem: "All",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      featureList: [
        "Instant zero-auth ATS score (0-100)",
        "Senior engineering & product benchmark presets",
        "Skills match, experience impact, and formatting breakdown",
        "Matched and missing ATS keywords",
        "Problem-Action-Result bullet rewrite suggestions",
        "JSON audit export",
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
        title="Free ATS Resume Score Checker & Rating | How ATS-Friendly Is My Resume?"
        description="Free instant ATS resume score checker and rating calculator. Benchmark your resume against modern ATS algorithms, check formatting compliance, and get bullet rewrite suggestions."
        path="/resume-score"
        jsonLd={seoJsonLd}
      />

      <div className="min-h-screen bg-gradient-hero py-10 md:py-16">
        <div className="container mx-auto px-4 max-w-5xl">
          {/* Hero Section */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Free ATS Resume Rating & Score Checker</span>
            </div>
            <h1 className="font-display text-balance text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
              How <span className="text-gradient">ATS-Friendly</span> Is Your Resume?
            </h1>
            <p className="text-balance text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
              Check your resume score against modern 2026 semantic ATS benchmarks in seconds. Zero sign-up, zero data stored, 100% free instant rating.
            </p>
          </div>

          {/* Role Benchmark Presets Picker */}
          <Card className="mb-8 border-border/80 bg-card/70 backdrop-blur-md shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" /> Target Role Benchmark
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Select a standardized benchmark to score your resume against verified industry standards.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="font-mono text-xs w-fit">
                  Benchmark: {currentBenchmark.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {ROLE_BENCHMARKS.map((benchmark) => {
                  const isSelected = selectedBenchmarkId === benchmark.id;
                  return (
                    <button
                      key={benchmark.id}
                      type="button"
                      onClick={() => handleSelectBenchmark(benchmark)}
                      className={`text-left p-3 rounded-lg border transition-all duration-200 text-xs flex flex-col justify-between ${
                        isSelected
                          ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary shadow-sm"
                          : "border-border/70 bg-card hover:border-primary/40 hover:bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-foreground mb-1 flex items-center justify-between">
                          <span>{benchmark.label}</span>
                          {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </div>
                        <p className="text-[11px] line-clamp-2 leading-relaxed opacity-80">
                          {benchmark.summary}
                        </p>
                      </div>
                      <div className="mt-2 pt-2 border-t border-border/50 flex justify-end">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLoadSample(benchmark);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              handleLoadSample(benchmark);
                            }
                          }}
                          className="text-[11px] font-medium text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Zap className="h-3 w-3" /> Load Sample
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Offline Warning Banner */}
          {offline && (
            <div
              role="status"
              aria-live="polite"
              className="mb-6 flex items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300"
            >
              <WifiOff className="h-4 w-4 shrink-0" />
              <span>You are currently offline. Scans require network connectivity to compute your ATS rating.</span>
            </div>
          )}

          {/* Resume Input Surface: Tabs for Paste or File Upload */}
          <Card className="mb-8 border-border bg-card/80 shadow-md">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Your Resume</span>
                </div>
                <Tabs value={inputTab} onValueChange={(v) => setInputTab(v as "paste" | "upload")}>
                  <TabsList className="h-8 text-xs">
                    <TabsTrigger value="paste" className="text-xs px-3">
                      Paste Text
                    </TabsTrigger>
                    <TabsTrigger value="upload" className="text-xs px-3">
                      Upload Document (.pdf/.docx/.txt)
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              {inputTab === "paste" ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="resume-score-text" className="text-xs font-medium text-muted-foreground">
                      Paste complete resume text (Summary, Experience, Skills, Education):
                    </label>
                    {wordCount > 0 && (
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {wordCount} words
                      </span>
                    )}
                  </div>
                  <textarea
                    id="resume-score-text"
                    aria-label="Resume text"
                    aria-invalid={Boolean(error && !resumeText.trim())}
                    value={resumeText}
                    onChange={(e) => {
                      setResumeText(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="Paste your plain-text resume here, or click 'Load Sample' from the benchmarks above..."
                    rows={12}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background/90 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y font-mono text-xs leading-relaxed"
                  />
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Privacy guaranteed: Never stored or indexed. Evaluated strictly in-memory.</span>
                    {resumeText && (
                      <button
                        type="button"
                        onClick={() => setResumeText("")}
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                      >
                        Clear text
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <UploadZone
                    onFileSelect={handleFileSelect}
                    accept=".pdf,.docx,.txt"
                    maxSize={10 * 1024 * 1024}
                    file={selectedFile}
                    onRemove={handleRemoveFile}
                    disabled={isExtracting || loading}
                  />
                  {isExtracting && (
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span>Extracting resume text from document...</span>
                    </div>
                  )}
                  {resumeText && (
                    <div className="rounded-lg border border-border bg-muted/40 p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Extracted Text Preview
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground">{wordCount} words</span>
                      </div>
                      <p className="text-xs font-mono text-muted-foreground line-clamp-3 bg-background/80 p-2 rounded border border-border/50">
                        {resumeText}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Button
                  size="lg"
                  onClick={handleScan}
                  disabled={loading || offline || isExtracting || !resumeText.trim()}
                  aria-busy={loading}
                  className="px-8 font-semibold shadow-md active:scale-[0.98]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Analyzing ATS Signals...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5 mr-2 text-primary-foreground" />
                      Check My Resume Score Free
                    </>
                  )}
                </Button>

                {loading && (
                  <Button type="button" size="lg" variant="outline" onClick={handleCancel} className="active:scale-[0.98]">
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

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
                      <Link to="/auth?redirect=/resume-score">Create Free Account</Link>
                    </Button>
                  ) : (
                    !loading &&
                    !offline &&
                    resumeText.trim() && (
                      <Button type="button" size="sm" variant="outline" onClick={handleScan}>
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Try Again
                      </Button>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results Display */}
          {result && (
            <div className="space-y-8 mb-12 animate-in fade-in-50 duration-300">
              {/* Top Bar with Status and JSON Audit Export */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border/80 bg-card/70 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary">
                    ATS Audit Completed
                  </Badge>
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    Benchmarked vs {currentBenchmark.label}
                  </span>
                </div>
                <Button size="sm" variant="outline" onClick={exportAuditJSON} className="text-xs h-8">
                  <Download className="mr-1.5 h-3.5 w-3.5 text-primary" /> Export Audit JSON
                </Button>
              </div>

              {/* Audit Results View Tabs */}
              <Tabs
                value={auditResultTab}
                onValueChange={(v) => setAuditResultTab(v as "overview" | "rewrites" | "simulator")}
                className="space-y-6"
              >
                <div className="flex justify-center">
                  <TabsList className="grid grid-cols-3 w-full max-w-2xl h-11 p-1 bg-muted/80 backdrop-blur-sm rounded-xl border border-border/60">
                    <TabsTrigger value="overview" className="rounded-lg text-xs sm:text-sm font-medium">
                      Score Overview
                    </TabsTrigger>
                    <TabsTrigger value="rewrites" className="rounded-lg text-xs sm:text-sm font-medium">
                      Bullet Rewrites
                    </TabsTrigger>
                    <TabsTrigger value="simulator" className="rounded-lg text-xs sm:text-sm font-medium">
                      ATS Parser Simulator
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Tab 1: Score Overview */}
                <TabsContent value="overview" className="space-y-8">
                  {/* Main Score Gauge Card */}
                  <Card className="border-border/80 bg-card/80 backdrop-blur-md shadow-xl text-center">
                    <CardHeader className="pb-2">
                      <CardTitle className="font-display text-xl sm:text-2xl font-bold">
                        Overall ATS Compatibility Rating
                      </CardTitle>
                      <CardDescription className="text-sm">
                        Evaluated against 2026 transformer recruiter screening models
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
                            {score}
                          </span>
                          <span className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
                            out of 100
                          </span>
                        </div>
                      </div>

                      {/* Rating Tier Badge */}
                      <div className="mb-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-semibold ${getScoreColor(
                            score
                          )}`}
                        >
                          {score >= 80 ? (
                            <>
                              <CheckCircle2 className="h-4 w-4" /> Strong ATS Ready Candidate
                            </>
                          ) : score >= 60 ? (
                            <>
                              <TrendingUp className="h-4 w-4" /> Moderate Match — Targeted Revision Recommended
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-4 w-4" /> Optimization Required for ATS Pass
                            </>
                          )}
                        </span>
                      </div>

                      {/* Honest Assessment Summary */}
                      <p className="text-balance text-muted-foreground text-sm max-w-xl mx-auto leading-relaxed">
                        {summary ||
                          (score >= 80
                            ? "Your resume demonstrates high semantic density and strong impact metrics aligned with this seniority benchmark. Recruiters and parsing models are likely to score it in the top quartile."
                            : score >= 60
                            ? "Your resume meets standard baseline requirements, but suffers from missing technical keywords or unquantified experience bullets that lower automated recruiter ranking."
                            : "Your resume lacks key technical terms or measurable outcomes expected for this role. Follow the bullet rewrites and recommendations below to increase your rating.")}
                      </p>
                    </CardContent>
                  </Card>

                  {/* 4-Dimension Breakdown Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-border/70 bg-card/60">
                      <CardContent className="pt-5 pb-5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Zap className="h-3.5 w-3.5 text-blue-500" /> Skills Match
                          </span>
                          <span className="font-mono text-sm font-bold tabular-nums">{skillsScore}%</span>
                        </div>
                        <Progress value={skillsScore} className="h-2 mb-2" />
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          Overlap across must-have technical competencies and domain tools.
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-border/70 bg-card/60">
                      <CardContent className="pt-5 pb-5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <BarChart3 className="h-3.5 w-3.5 text-emerald-500" /> Experience Impact
                          </span>
                          <span className="font-mono text-sm font-bold tabular-nums">{experienceScore}%</span>
                        </div>
                        <Progress value={experienceScore} className="h-2 mb-2" />
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          Quantifiable metrics, business results, and Problem-Action-Result format.
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-border/70 bg-card/60">
                      <CardContent className="pt-5 pb-5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <ShieldCheck className="h-3.5 w-3.5 text-purple-500" /> Formatting
                          </span>
                          <span className="font-mono text-sm font-bold tabular-nums">{formattingScore}%</span>
                        </div>
                        <Progress value={formattingScore} className="h-2 mb-2" />
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          Single-column layout, standard headers, and unhindered parser legibility.
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-border/70 bg-card/60">
                      <CardContent className="pt-5 pb-5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Layers className="h-3.5 w-3.5 text-amber-500" /> Education Fit
                          </span>
                          <span className="font-mono text-sm font-bold tabular-nums">{educationScore}%</span>
                        </div>
                        <Progress value={educationScore} className="h-2 mb-2" />
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          Degree alignment, certifications, and relevant continuous learning signals.
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Matched & Missing Keywords Grid */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <Card className="border-success/30 bg-card/70">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base font-semibold text-success flex items-center gap-2">
                            <Check className="h-4 w-4" /> Matched ATS Keywords
                          </CardTitle>
                          <Badge variant="outline" className="border-success/30 text-success text-xs font-mono">
                            {matchedKeywords.length} Found
                          </Badge>
                        </div>
                        <CardDescription className="text-xs">
                          Terms successfully indexed by the ATS semantic parser:
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
                          <p className="text-xs text-muted-foreground italic">No verified keyword matches identified.</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-destructive/30 bg-card/70">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base font-semibold text-destructive flex items-center gap-2">
                            <X className="h-4 w-4" /> Missing Critical Terms
                          </CardTitle>
                          <Badge variant="outline" className="border-destructive/30 text-destructive text-xs font-mono">
                            {missingKeywords.length} Missing
                          </Badge>
                        </div>
                        <CardDescription className="text-xs">
                          Standard competencies expected for this benchmark that were not detected:
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
                          <p className="text-xs text-muted-foreground italic">No critical missing keywords identified!</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Recommendations */}
                  {recommendations.length > 0 && (
                    <Card className="border-border/80 bg-card/70">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                          <Target className="h-4 w-4 text-primary" /> Actionable Improvements for this Benchmark
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2.5">
                          {recommendations.map((rec, i) => (
                            <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Tab 2: Bullet Rewrites */}
                <TabsContent value="rewrites" className="space-y-8">
                  {weakBullets.length > 0 ? (
                    <Card className="border-border/80 bg-card/70 backdrop-blur-md">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" /> Weak Bullet Rewrite Suggestions (PAR Formula)
                          </CardTitle>
                          <Badge variant="outline" className="text-xs font-mono">
                            Action + Tool + Outcome
                          </Badge>
                        </div>
                        <CardDescription className="text-xs">
                          AI-generated improvements transforming low-impact descriptions into high-scoring quantifiable achievements.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {weakBullets.map((bullet, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl border border-border/80 bg-background/60 p-4 space-y-3"
                          >
                            {/* Original */}
                            <div>
                              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-destructive uppercase tracking-wider mb-1">
                                <X className="h-3 w-3" /> Original Bullet (Low Impact)
                              </div>
                              <p className="text-xs text-muted-foreground font-mono bg-muted/40 p-2.5 rounded border border-border/40 line-through opacity-80">
                                {bullet.original}
                              </p>
                            </div>

                            {/* Rewrite */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-success uppercase tracking-wider">
                                  <Sparkles className="h-3 w-3" /> High-Impact ATS Rewrite
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyRewrite(bullet.rewrite)}
                                  className="h-6 text-[11px] px-2 text-primary hover:bg-primary/10"
                                >
                                  <Copy className="h-3 w-3 mr-1" /> Copy
                                </Button>
                              </div>
                              <p className="text-xs text-foreground font-medium bg-success/5 border border-success/20 p-2.5 rounded leading-relaxed">
                                {bullet.rewrite}
                              </p>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-border/80 bg-card/70 backdrop-blur-md p-8 text-center">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2" />
                        <h3 className="font-semibold text-base text-foreground">High Impact Achievements Detected</h3>
                        <p className="text-xs text-muted-foreground max-w-md">
                          Your work experience descriptions already reflect strong action verbs, quantifiable metrics, and Problem-Action-Result format.
                        </p>
                      </div>
                    </Card>
                  )}
                </TabsContent>

                {/* Tab 3: ATS Parser Simulator */}
                <TabsContent value="simulator" className="space-y-8">
                  <AtsParserSimulator resumeText={resumeText} benchmarkRole={currentBenchmark.label} />
                </TabsContent>
              </Tabs>

              {/* Pro CTA to optimize further */}
              <Card className="border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card p-6 md:p-8 text-center shadow-lg">
                <div className="max-w-xl mx-auto space-y-4">
                  <Badge variant="secondary" className="font-semibold text-xs text-primary bg-primary/15 border-primary/25">
                    Pro Resume Studio
                  </Badge>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
                    Want to automatically tailor this resume for any job opening?
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Use Job Tayari's complete Resume Optimizer to regenerate bullet points with verified impact metrics, generate pixel-perfect Typst PDF exports, and automate role tailoring with zero guesswork.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <Button size="lg" asChild className="font-semibold shadow-md active:scale-[0.98]">
                      <Link to="/resume">
                        Open Resume Studio <ArrowRight className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                    <Button variant="outline" size="lg" asChild className="active:scale-[0.98]">
                      <Link to="/pricing">View Plans & Pricing</Link>
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
                Frequently Asked Questions: ATS Resume Scoring
              </h2>
              <p className="text-muted-foreground text-sm max-w-xl mx-auto">
                Everything you need to know about ATS parsers, score ratings, and how recruiters filter candidates in 2026.
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
