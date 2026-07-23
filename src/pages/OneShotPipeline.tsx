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
  FileCheck
} from "lucide-react";

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
    if (!resumeText.trim()) {
      const savedResume = localStorage.getItem("tayari_master_resume");
      if (savedResume) {
        setResumeText(savedResume);
      }
    }
  }, []);

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
        company_name: companyName || "Target Company",
        job_description: jobDescription,
        resume_text: defaultResume,
        target_url: targetUrl,
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
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-background border border-primary/20 p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                <Rocket className="w-3.5 h-3.5" />
                The One-Shot Solution for Jobseekers
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
                One-Shot Autopilot Console
              </h1>
              <p className="text-muted-foreground text-sm max-w-2xl">
                Enter target role details once. Tayari executes Fit Audit → Reflective Resume Tailoring → Custom Cover Letter → Stealth Auto-Apply Payload → Recruiter Outreach → STAR Interview Prep in a single turn.
              </p>
            </div>
            <Badge variant="outline" className="px-4 py-2 text-sm font-medium border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
              <ShieldCheck className="w-4 h-4 mr-2" /> 100% Privacy & Local-First Ready
            </Badge>
          </div>
        </div>

        {/* Form & Input Section */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" /> Target Role & Master Profile Context
            </CardTitle>
            <CardDescription>
              Provide the role info below. If resume text is left blank, your default saved profile will be ingested automatically.
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
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Master Resume / Profile Text (Optional)</label>
                <Textarea 
                  rows={6}
                  placeholder="Paste resume text or leave blank to use your default profile..."
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                />
              </div>
            </div>

            <Button 
              size="lg" 
              onClick={handleExecute}
              disabled={loading}
              className="w-full font-bold shadow-md bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 animate-spin" /> Executing 6-Stage One-Shot Pipeline...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 fill-current" /> Execute One-Shot Application Pipeline
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
                    <p className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-300">{result.overall_fit_score}%</p>
                  </div>
                  <Badge className="bg-emerald-500 text-white font-bold">{result.audit.relevance_level}</Badge>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground">Pre vs Post Score</p>
                  <p className="text-2xl font-bold text-foreground">
                    {result.audit.initial_score}% → <span className="text-emerald-600">{result.audit.post_tailoring_score}%</span>
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground">Stealth Auto-Apply</p>
                  <p className="text-2xl font-bold text-primary">{result.auto_apply_payload.stealth_readiness}</p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground">Recruiter Patterns</p>
                  <p className="text-2xl font-bold text-foreground">{result.recruiter_intel.verified_email_patterns.length} Verified</p>
                </CardContent>
              </Card>
            </div>

            {/* Stages Tabbed Console */}
            <Tabs defaultValue="resume" className="w-full">
              <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full bg-muted/60 p-1">
                <TabsTrigger value="resume" className="flex items-center gap-1.5 text-xs font-semibold">
                  <FileText className="w-4 h-4" /> Tailored Resume
                </TabsTrigger>
                <TabsTrigger value="cover" className="flex items-center gap-1.5 text-xs font-semibold">
                  <Mail className="w-4 h-4" /> Cover Letter
                </TabsTrigger>
                <TabsTrigger value="autofill" className="flex items-center gap-1.5 text-xs font-semibold">
                  <Send className="w-4 h-4" /> Stealth Auto-Fill
                </TabsTrigger>
                <TabsTrigger value="recruiter" className="flex items-center gap-1.5 text-xs font-semibold">
                  <UserCheck className="w-4 h-4" /> Recruiter Intel
                </TabsTrigger>
                <TabsTrigger value="interview" className="flex items-center gap-1.5 text-xs font-semibold">
                  <HelpCircle className="w-4 h-4" /> STAR Prep Kit
                </TabsTrigger>
              </TabsList>

              {/* Tailored Resume Tab */}
              <TabsContent value="resume">
                <Card className="border-border">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <FileCheck className="w-5 h-5 text-emerald-500" /> Reflective Tailored Resume (Typst Compatible)
                      </CardTitle>
                      <CardDescription>Optimized against ATS keywords with zero hallucinated claims.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => copyToClipboard(result.tailored_resume.optimized_text, "Tailored Resume")}
                      >
                        <Copy className="w-4 h-4 mr-1" /> Copy Resume Text
                      </Button>
                      {result.tailored_resume.typst_code && (
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={() => copyToClipboard(result.tailored_resume.typst_code, "Typst Markup Code")}
                        >
                          <FileText className="w-4 h-4 mr-1" /> Copy Typst Code
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {result.tailored_resume.changes_made.map((ch: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="text-xs">✓ {ch}</Badge>
                      ))}
                    </div>
                    <div className="bg-muted/40 rounded-lg p-4 font-mono text-xs overflow-x-auto max-h-96 whitespace-pre-wrap border border-border">
                      {result.tailored_resume.optimized_text}
                    </div>
                    {result.tailored_resume.typst_code && (
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-muted-foreground uppercase">Typst Rust PDF Markup Source:</label>
                        <div className="bg-slate-950 text-slate-100 rounded-lg p-3 font-mono text-xs overflow-x-auto max-h-48 whitespace-pre-wrap border border-border">
                          {result.tailored_resume.typst_code}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Cover Letter Tab */}
              <TabsContent value="cover">
                <Card className="border-border">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold">Context-Matched Cover Letter</CardTitle>
                      <CardDescription>Metrics-driven 3-paragraph letter tailored for {jobTitle}.</CardDescription>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => copyToClipboard(result.cover_letter, "Cover Letter")}
                    >
                      <Copy className="w-4 h-4 mr-1" /> Copy Letter
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted/40 rounded-lg p-4 text-xs max-h-96 whitespace-pre-wrap border border-border leading-relaxed">
                      {result.cover_letter}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Stealth Auto-Fill Payload Tab */}
              <TabsContent value="autofill">
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Send className="w-5 h-5 text-primary" /> Auto-Fill Extension Payload
                    </CardTitle>
                    <CardDescription>Ready for Chrome Extension & Playwright automatic form entry.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="p-3 bg-muted/40 rounded-lg border">
                        <span className="font-bold block mb-1">Target Application URL:</span>
                        <span className="text-primary break-all">{result.auto_apply_payload.target_url}</span>
                      </div>
                      <div className="p-3 bg-muted/40 rounded-lg border">
                        <span className="font-bold block mb-1">Shadow Approval Gate:</span>
                        <span className="text-emerald-600 font-semibold">Not Required (100% Ready)</span>
                      </div>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-4 font-mono text-xs border">
                      <p className="font-bold mb-2 text-muted-foreground">Mapped Form Fields:</p>
                      <pre className="whitespace-pre-wrap">{JSON.stringify(result.auto_apply_payload.field_mapping, null, 2)}</pre>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Recruiter Intel Tab */}
              <TabsContent value="recruiter">
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="text-base font-bold">Hiring Manager & Recruiter Cold Outreach</CardTitle>
                    <CardDescription>Direct outreach drafts and verified email patterns.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Target Roles to Outreach:</h4>
                      <div className="flex flex-wrap gap-2">
                        {result.recruiter_intel.target_roles.map((r: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs bg-primary/5">{r}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold">Email Outreach Draft</label>
                          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => copyToClipboard(result.recruiter_intel.email_draft, "Email Draft")}>
                            <Copy className="w-3 h-3 mr-1" /> Copy
                          </Button>
                        </div>
                        <div className="bg-muted/40 p-3 rounded-lg border text-xs whitespace-pre-wrap max-h-60 overflow-y-auto">
                          {result.recruiter_intel.email_draft}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold">LinkedIn Connection Note</label>
                          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => copyToClipboard(result.recruiter_intel.linkedin_draft, "LinkedIn Note")}>
                            <Copy className="w-3 h-3 mr-1" /> Copy
                          </Button>
                        </div>
                        <div className="bg-muted/40 p-3 rounded-lg border text-xs whitespace-pre-wrap max-h-60 overflow-y-auto">
                          {result.recruiter_intel.linkedin_draft}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* STAR Prep Kit Tab */}
              <TabsContent value="interview">
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="text-base font-bold">STAR Behavioral & Technical Flashcards</CardTitle>
                    <CardDescription>Tailored interview prep based on target role requirements.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-muted/40 p-4 rounded-lg border text-xs whitespace-pre-wrap max-h-80 overflow-y-auto font-sans leading-relaxed">
                      {typeof result.interview_kit === "string" 
                        ? result.interview_kit 
                        : JSON.stringify(result.interview_kit, null, 2)}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </AppShell>
  );
}
