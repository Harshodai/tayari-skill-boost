import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { executeOneShotPipeline, OneShotExecuteResponse } from "@/api";
import { 
  Rocket, 
  Sparkles, 
  FileText, 
  Mail, 
  Send, 
  UserCheck, 
  HelpCircle, 
  CheckCircle2, 
  Copy, 
  ShieldCheck, 
  ArrowRight,
  Zap,
  Target,
  FileCheck,
  Check
} from "lucide-react";

const SAMPLE_PRESETS = [
  {
    title: "Staff Frontend Engineer",
    company: "Stripe",
    url: "https://boards.greenhouse.io/stripe/jobs/89104",
    jd: `Role: Staff Frontend Engineer
Company: Stripe
Requirements:
- 6+ years with React 19, TypeScript, micro-frontends, and Core Web Vitals optimization.
- Deep experience in state machines, WebSockets, and distributed telemetry.
- Experience with Playwright E2E automation and performance budgeting.`,
    resume: `Alex Rivera — Staff Software Engineer
- Architected design systems and micro-frontends serving 4.2M daily active users with React 19 and TypeScript.
- Reduced Largest Contentful Paint (LCP) by 42% and achieved sub-50ms INP across core payments flow.
- Led Playwright automation test suite adoption across 14 teams with 94% coverage.`,
  },
  {
    title: "Staff Distributed Systems Engineer",
    company: "Cloudflare",
    url: "https://jobs.lever.co/cloudflare/5521",
    jd: `Role: Staff Systems Infrastructure Engineer
Company: Cloudflare
Requirements:
- Low-latency systems programming in Go and Rust.
- Distributed caching with Redis and event streaming with Kafka.
- Expertise in p99 latency optimization, failover, and multi-region high availability.`,
    resume: `Jordan Hayes — Lead Systems Engineer
- Built high-throughput event ingestion in Go/Kafka handling 250k events/sec with zero message loss.
- Implemented multi-region Redis cache mesh, reducing database read contention by 78%.
- Optimized p99 distributed RPC latency from 45ms to 12ms across global edge nodes.`,
  },
];

export default function OneShotPipeline() {
  const { toast } = useToast();
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OneShotExecuteResponse | null>(null);

  useEffect(() => {
    const savedResume = localStorage.getItem("tayari_master_resume");
    if (savedResume && !resumeText.trim()) {
      setResumeText(savedResume);
    }
  }, [resumeText]);

  const loadPreset = (preset: typeof SAMPLE_PRESETS[0]) => {
    setJobTitle(preset.title);
    setCompanyName(preset.company);
    setTargetUrl(preset.url);
    setJobDescription(preset.jd);
    setResumeText(preset.resume);
    setResult(null);
    toast({
      title: `Loaded ${preset.title}`,
      description: `Targeting ${preset.company} requisition context.`,
    });
  };

  const handleExecute = async () => {
    if (!jobTitle.trim() || !jobDescription.trim()) {
      toast({
        title: "Missing Fields",
        description: "Please enter at least Job Title and Job Description.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await executeOneShotPipeline({
        job_title: jobTitle,
        company_name: companyName || undefined,
        job_description: jobDescription,
        resume_text: resumeText,
        target_url: targetUrl || undefined,
        tone: "Confident"
      });

      setResult(response);
      toast({
        title: "⚡ One-Shot Pipeline Executed!",
        description: "All 6 stages generated successfully. Review your tailored assets below."
      });
    } catch (err: any) {
      toast({
        title: "Execution Error",
        description: err.message || "Failed to execute pipeline",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard.`
    });
  };

  return (
    <AppShell>
      <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-background border border-primary/20 p-8 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                <Rocket className="w-3.5 h-3.5" />
                The One-Shot Solution for Jobseekers
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground font-display">
                One-Shot Autopilot Console
              </h1>
              <p className="text-muted-foreground text-sm max-w-2xl">
                Enter target role details once. Tayari prepares a fit audit, tailored resume, cover-letter draft, candidate-controlled application package, outreach draft, and interview-prep materials for your review.
              </p>
            </div>
            <Badge variant="outline" className="px-4 py-2 text-sm font-medium border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
              <ShieldCheck className="w-4 h-4 mr-2" /> Candidate-controlled · review required
            </Badge>
          </div>
        </div>

        {/* Quick Presets for Instant 1-Click Testing */}
        <div className="rounded-xl border border-border/60 bg-card/60 p-3.5 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 font-mono">
              <FileText className="h-3.5 w-3.5 text-primary" /> Load Sample Role Context:
            </span>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_PRESETS.map((preset) => (
                <Button
                  key={preset.title}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => loadPreset(preset)}
                  className="text-xs h-7 font-medium active:scale-[0.98]"
                >
                  {preset.title} ({preset.company})
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Form & Input Section */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" /> Target Role & Master Profile Context
            </CardTitle>
            <CardDescription>
              Provide the role information below. If resume text is left blank, the service will use an available user-owned resume context; otherwise it will report that resume context is unavailable.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Job Title *</label>
                <Input 
                  placeholder="e.g. Senior Software Engineer"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Company Name</label>
                <Input 
                  placeholder="e.g. Stripe, Google, Acme Inc"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Job URL (Optional)</label>
                <Input 
                  placeholder="https://greenhouse.io/..."
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Job Description *</label>
                <Textarea 
                  rows={6}
                  placeholder="Paste target job description here..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="font-mono text-xs leading-relaxed"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Master Resume / Profile Text (Optional)</label>
                <Textarea 
                  rows={6}
                  placeholder="Paste resume text or leave blank to use your default profile..."
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  className="font-mono text-xs leading-relaxed"
                />
              </div>
            </div>

            <Button 
              size="lg" 
              onClick={handleExecute}
              disabled={loading}
              className="w-full font-bold shadow-md bg-primary hover:bg-primary/90 text-primary-foreground active:scale-[0.99]"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 animate-spin" /> Preparing review package...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 fill-current" /> Prepare Candidate Review Package
                </div>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results Console */}
        {result && (
          <div className="space-y-6">
            {/* Top Score Metric Bar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-emerald-500/30 bg-emerald-500/5">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Match Score</p>
                    <p className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-300 font-mono">{result.overall_fit_score}%</p>
                  </div>
                  <Badge className="bg-emerald-500 text-white font-bold">{result.audit.relevance_level}</Badge>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground">Pre vs Post Score</p>
                  <p className="text-2xl font-bold text-foreground font-mono">
                    {result.audit.initial_score}% → <span className="text-emerald-600 font-mono">{result.audit.post_tailoring_score}%</span>
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground">Application Package</p>
                  <p className="text-2xl font-bold text-primary">
                    {result.auto_apply_payload.submission_blocked ? "Safe Handoff" : "Ready"}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground">Tailoring Engine</p>
                  <p className="text-2xl font-bold text-foreground">Typst + ATS</p>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Tabs */}
            <Tabs defaultValue="resume" className="w-full">
              <TabsList className="grid grid-cols-5 w-full">
                <TabsTrigger value="resume" className="flex items-center gap-1.5 text-xs">
                  <FileText className="w-4 h-4" /> Tailored Resume
                </TabsTrigger>
                <TabsTrigger value="cover_letter" className="flex items-center gap-1.5 text-xs">
                  <Mail className="w-4 h-4" /> Cover Letter
                </TabsTrigger>
                <TabsTrigger value="qa" className="flex items-center gap-1.5 text-xs">
                  <HelpCircle className="w-4 h-4" /> Form QA
                </TabsTrigger>
                <TabsTrigger value="outreach" className="flex items-center gap-1.5 text-xs">
                  <Send className="w-4 h-4" /> Recruiter Outreach
                </TabsTrigger>
                <TabsTrigger value="interview" className="flex items-center gap-1.5 text-xs">
                  <UserCheck className="w-4 h-4" /> Interview Prep
                </TabsTrigger>
              </TabsList>

              {/* Tailored Resume Tab */}
              <TabsContent value="resume" className="mt-4">
                {(() => {
                  const resumeContent = result.tailored_resume.optimized_text || result.tailored_resume.markdown_content || "";
                  return (
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div>
                          <CardTitle className="text-base font-bold">Optimized Resume Artifact</CardTitle>
                          <CardDescription>Tailored specifically against target keywords.</CardDescription>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(resumeContent, "Tailored Resume")}>
                          <Copy className="w-4 h-4 mr-2" /> Copy Text
                        </Button>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <pre className="p-4 rounded-lg bg-muted/40 font-mono text-xs whitespace-pre-wrap border leading-relaxed max-h-[500px] overflow-y-auto">
                          {resumeContent}
                        </pre>
                      </CardContent>
                    </Card>
                  );
                })()}
              </TabsContent>

              {/* Cover Letter Tab */}
              <TabsContent value="cover_letter" className="mt-4">
                {(() => {
                  const coverLetterContent = typeof result.cover_letter === "string" ? result.cover_letter : result.cover_letter?.body || "";
                  return (
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div>
                          <CardTitle className="text-base font-bold">Targeted Cover Letter</CardTitle>
                          <CardDescription>Engineered with concise hooks and proof points.</CardDescription>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(coverLetterContent, "Cover Letter")}>
                          <Copy className="w-4 h-4 mr-2" /> Copy Cover Letter
                        </Button>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="p-4 rounded-lg bg-muted/40 text-sm whitespace-pre-wrap border leading-relaxed">
                          {coverLetterContent}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}
              </TabsContent>

              {/* QA Tab */}
              <TabsContent value="qa" className="mt-4">
                {(() => {
                  const qaEntries = Object.entries(
                    result.auto_apply_payload?.screening_answers ||
                    result.auto_apply_payload?.field_mapping ||
                    result.answers_draft ||
                    {}
                  );
                  return (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base font-bold">Candidate Form Answers</CardTitle>
                        <CardDescription>Pre-computed answers for standard ATS portal fields.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {qaEntries.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No candidate form answers recorded.</p>
                        ) : (
                          qaEntries.map(([k, v]) => (
                            <div key={k} className="p-3 rounded-lg border bg-muted/20 flex flex-col gap-1">
                              <span className="text-xs font-mono font-semibold text-primary">{k}</span>
                              <span className="text-xs text-foreground/90">{String(v ?? "")}</span>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  );
                })()}
              </TabsContent>

              {/* Outreach Tab */}
              <TabsContent value="outreach" className="mt-4">
                {(() => {
                  const outreachContent =
                    result.recruiter_intel?.linkedin_draft ||
                    result.recruiter_intel?.linkedin_note ||
                    result.recruiter_outreach?.linkedin_message ||
                    "";
                  return (
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div>
                          <CardTitle className="text-base font-bold">Recruiter & Hiring Manager Notes</CardTitle>
                          <CardDescription>High-conversion message drafts.</CardDescription>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(outreachContent, "LinkedIn Message")}>
                          <Copy className="w-4 h-4 mr-2" /> Copy LinkedIn Note
                        </Button>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="p-4 rounded-lg bg-muted/30 border space-y-2">
                          <span className="text-xs font-bold text-muted-foreground uppercase font-mono">LinkedIn InMail Draft:</span>
                          <p className="text-sm">{outreachContent}</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}
              </TabsContent>

              {/* Interview Prep Tab */}
              <TabsContent value="interview" className="mt-4">
                {(() => {
                  const interviewQuestions =
                    result.interview_kit?.questions?.map((q) => (typeof q === "string" ? q : q.question)) ||
                    result.interview_prep?.expected_questions ||
                    [];
                  return (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base font-bold">Role-Specific Technical Questions & Strategy</CardTitle>
                        <CardDescription>Anticipated interview scenarios.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {interviewQuestions.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No interview questions generated.</p>
                        ) : (
                          interviewQuestions.map((q, idx) => (
                            <div key={idx} className="p-3 rounded-lg border bg-muted/20">
                              <p className="text-xs font-semibold text-foreground">Q{idx + 1}: {q}</p>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  );
                })()}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </AppShell>
  );
}
