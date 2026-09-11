import { useState } from "react";
import { Link, useLocation, Navigate, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreDisplay } from "@/components/ui/score-display";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft, Download, Edit, RotateCcw, ChevronDown, ChevronUp, Check,
  Lightbulb, Target, Briefcase, GraduationCap, FileText, AlertCircle,
  CheckCircle2, XCircle, Wand2, Sparkles, Loader2, RefreshCw,
  MessageSquare, Mail, MoreHorizontal, ExternalLink
} from "lucide-react";
import type { ResumeAnalysisResult } from "@/types/resume";
import type { DeepATSResponse, GuardrailResult, ResumeOptimizationResponse } from "@/api/types";
import { SlideUp } from "@/components/ui/motion";
import { Progress } from "@/components/ui/progress";
import { ScoreBreakdownCard } from "@/components/resume/ScoreBreakdownCard";
import { optimizeResume, deepATS, exportResume } from "@/api";
import { getCourseRecommendationsForGaps } from "@/data/courseRecommendations";
import { toast } from "sonner";
import { OptimizationResultsPanel } from "@/components/resume/OptimizationResultsPanel";

// Icon mapping for sections
const sectionIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "Skills Match": Target,
  "Experience Relevance": Briefcase,
  "Education Fit": GraduationCap,
  "Formatting": FileText,
};

// --- ATS scoring constants (mirror ats_engine.py; single source of truth in UI) ---
const ATS_SCORE_HIGH = 80;
const ATS_SCORE_MEDIUM = 60;
const ATS_DEFAULT_BAND = 5;

interface AtsParserProfile {
  name: string;
  key: string;
  desc: string;
}
const ATS_PARSER_PROFILES: AtsParserProfile[] = [
  { name: "Greenhouse", key: "greenhouse", desc: "Markdown & structured text friendly" },
  { name: "Workday", key: "workday", desc: "Rigid table and column rules" },
  { name: "iCIMS", key: "icims", desc: "Strict formatting and layout rules" },
];

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

const ResumeResults = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const analysisResults = location.state?.analysisResults as ResumeAnalysisResult | undefined;
  const resumeFileName = location.state?.resumeFileName as string | undefined;
  const resumeText = location.state?.resumeText as string | undefined;
  const jobDescription = location.state?.jobDescription as string | undefined;
  const customInstructions = location.state?.customInstructions as string | undefined;
  const jobPostUrl = location.state?.jobPostUrl as string | undefined;
  const resumeId = location.state?.resumeId as number | undefined;
  const targetRole = location.state?.targetRole as string | undefined;

  const [expandedSections, setExpandedSections] = useState<string[]>(
    analysisResults?.sections?.[0]?.name ? [analysisResults.sections[0].name] : []
  );
  const [appliedSuggestions, setAppliedSuggestions] = useState<string[]>([]);
  const [optimizedText, setOptimizedText] = useState<string | null>(null);
  const [optimizationResult, setOptimizationResult] = useState<ResumeOptimizationResponse | null>(null);
  const [guardrails, setGuardrails] = useState<GuardrailResult | null>(null);
  const [deepScore, setDeepScore] = useState<DeepATSResponse | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isDeepATS, setIsDeepATS] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const [deepATSError, setDeepATSError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleChooseTemplate = () => {
    navigate("/resume/templates", {
      state: {
        analysisResults,
        resumeFileName,
        resumeText,
        jobDescription,
        appliedSuggestions,
      },
    });
  };

  const handleOptimize = async () => {
    if (!resumeId) { toast.error("Resume ID not available"); return; }
    setIsOptimizing(true);
    setOptimizeError(null);
    setOptimizationResult(null);
    try {
      const res = await optimizeResume(resumeId, {
        jobDescription,
        customInstructions,
        jdUrl: jobPostUrl,
        targetRole,
      });
      const text = res?.optimized_text || res?.optimized_resume || res?.result;
      if (text) {
        setOptimizedText(text);
      } else {
        setOptimizedText(JSON.stringify(res, null, 2));
      }
      setOptimizationResult(res);
      if (res?.guardrails) setGuardrails(res.guardrails as GuardrailResult);
      toast.success("Resume optimized!");
    } catch (err: unknown) {
      const msg = errorMessage(err, "Optimization failed");
      setOptimizeError(msg);
      toast.error(msg);
    } finally { setIsOptimizing(false); }
  };

  const handleDeepATS = async () => {
    if (!resumeId) { toast.error("Resume ID not available"); return; }
    setIsDeepATS(true);
    setDeepATSError(null);
    try {
      const res = await deepATS(resumeId, jobDescription);
      setDeepScore(res);
      toast.success("Deep ATS analysis complete!");
    } catch (err: unknown) {
      const msg = errorMessage(err, "Deep ATS failed");
      setDeepATSError(msg);
      toast.error(msg);
    } finally { setIsDeepATS(false); }
  };

  const handleExport = async () => {
    if (!resumeId) { toast.error("Resume ID not available"); return; }
    setIsExporting(true);
    setExportError(null);
    try {
      const blob = await exportResume(resumeId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tayari-resume-${resumeId}.docx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Resume exported!");
    } catch (err: unknown) {
      const msg = errorMessage(err, "Export failed");
      setExportError(msg);
      toast.error(msg);
    } finally { setIsExporting(false); }
  };

  // Redirect if no results
  if (!analysisResults) {
    return <Navigate to="/resume" replace />;
  }

  const toggleSection = (sectionName: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionName)
        ? prev.filter((s) => s !== sectionName)
        : [...prev, sectionName]
    );
  };

  const applySuggestion = (suggestion: string) => {
    setAppliedSuggestions((prev) =>
      prev.includes(suggestion)
        ? prev.filter((s) => s !== suggestion)
        : [...prev, suggestion]
    );
  };

  const getScoreLabel = (score: number) => {
    if (score >= ATS_SCORE_HIGH) return { text: "Excellent", color: "text-success" };
    if (score >= ATS_SCORE_MEDIUM) return { text: "Good", color: "text-warning" };
    return { text: "Needs Work", color: "text-destructive" };
  };

  const overallLabel = getScoreLabel(analysisResults.overallScore);

  // Compute course recommendations once before rendering to avoid repeated
  // inline calls and to allow gating sections on non-empty results.
  const nonInjectableCourses = getCourseRecommendationsForGaps(
    optimizationResult?.non_injectable_keywords ?? []
  );
  const missingKeywordCourses = getCourseRecommendationsForGaps(
    analysisResults.missingKeywords ?? []
  );

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header with consolidated 1 primary CTA, 1 secondary CTA, and 1 dropdown */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 text-muted-foreground hover:text-foreground">
              <Link to="/resume">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Back to Upload
              </Link>
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              Resume Analysis Results
            </h1>
            {resumeFileName && (
              <p className="text-muted-foreground text-sm mt-1">
                Analyzed: <span className="font-medium text-foreground">{resumeFileName}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Primary CTA */}
            <Button variant="glow" onClick={handleChooseTemplate} className="gap-2 font-semibold">
              <Edit className="w-4 h-4" />
              Choose Template
            </Button>

            {/* Secondary CTA */}
            <Button
              variant="outline"
              onClick={handleOptimize}
              disabled={isOptimizing || !resumeId}
              className="gap-2"
            >
              {isOptimizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 text-primary" />}
              Optimize
            </Button>

            {/* Consolidated Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More actions" className="h-9 w-9">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={handleDeepATS}
                  disabled={isDeepATS || !resumeId}
                  className="cursor-pointer gap-2"
                >
                  {isDeepATS ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-primary" />}
                  Deep ATS Analysis
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleExport}
                  disabled={isExporting || !resumeId}
                  className="cursor-pointer gap-2"
                >
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-primary" />}
                  Export DOCX
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer gap-2">
                  <Link to="/cover-letter">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    Generate Cover Letter
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer gap-2">
                  <Link to="/communication">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    Communication Hub
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer gap-2 text-destructive focus:text-destructive">
                  <Link to="/resume">
                    <RotateCcw className="w-4 h-4" />
                    Start Over
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Guardrail Results Card */}
        {guardrails && (
          <SlideUp delay={0.25}>
            <Card className={`mb-6 ${guardrails.all_passed ? "border-success/40" : "border-warning/40"}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {guardrails.all_passed ? (
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-warning" />
                  )}
                  Quality & Accuracy Check
                  <Badge variant={guardrails.all_passed ? "default" : "secondary"} className="ml-auto text-xs">
                    {guardrails.all_passed ? "Passed" : "Needs Review"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Truthfulness */}
                <div className="flex items-start gap-3">
                  {guardrails.results.truthfulness.passed
                    ? <CheckCircle2 className="w-4 h-4 text-success mt-0.5" />
                    : <XCircle className="w-4 h-4 text-destructive mt-0.5" />}
                  <div className="flex-1">
                    <p className="text-sm font-medium">Factual Accuracy</p>
                    {!guardrails.results.truthfulness.passed && (
                      <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        {guardrails.results.truthfulness.violations.map((v, i) => (
                          <li key={i}>• {v}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Keyword Stuffing */}
                <div className="flex items-start gap-3">
                  {guardrails.results.keyword_stuffing.passed
                    ? <CheckCircle2 className="w-4 h-4 text-success mt-0.5" />
                    : <XCircle className="w-4 h-4 text-destructive mt-0.5" />}
                  <div className="flex-1">
                    <p className="text-sm font-medium">Keyword Density</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            guardrails.results.keyword_stuffing.density_score > 0.5
                              ? "bg-destructive" : "bg-success"
                          }`}
                          style={{ width: `${Math.min(guardrails.results.keyword_stuffing.density_score * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {Math.round(guardrails.results.keyword_stuffing.density_score * 100)}%
                      </span>
                    </div>
                    {guardrails.results.keyword_stuffing.flagged_keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {guardrails.results.keyword_stuffing.flagged_keywords.map((kw) => (
                          <Badge key={kw} variant="secondary" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* PII */}
                <div className="flex items-start gap-3">
                  {guardrails.results.pii.passed
                    ? <CheckCircle2 className="w-4 h-4 text-success mt-0.5" />
                    : <XCircle className="w-4 h-4 text-destructive mt-0.5" />}
                  <div className="flex-1">
                    <p className="text-sm font-medium">Personal Data</p>
                    {!guardrails.results.pii.passed && (
                      <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        {guardrails.results.pii.pii_found.map((p, i) => (
                          <li key={i}>• {p.type}: <code className="bg-muted px-1 rounded">{p.match}</code></li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </SlideUp>
        )}

        {/* AI Operation Error Cards */}
        {(optimizeError || deepATSError || exportError) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
            {optimizeError && (
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="py-4 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-destructive">Optimization failed</p>
                    <p className="text-xs text-muted-foreground">{optimizeError}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleOptimize}>
                    <RefreshCw className="w-4 h-4 mr-1" /> Retry
                  </Button>
                </CardContent>
              </Card>
            )}
            {deepATSError && (
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="py-4 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-destructive">ATS Analysis failed</p>
                    <p className="text-xs text-muted-foreground">{deepATSError}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleDeepATS}>
                    <RefreshCw className="w-4 h-4 mr-1" /> Retry
                  </Button>
                </CardContent>
              </Card>
            )}
            {exportError && (
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="py-4 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-destructive">Export failed</p>
                    <p className="text-xs text-muted-foreground">{exportError}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleExport}>
                    <RefreshCw className="w-4 h-4 mr-1" /> Retry
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Optimization Loading State */}
        {(isOptimizing || isDeepATS || isExporting) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {isOptimizing && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    Optimizing Resume…
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                    <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
                    <div className="h-4 bg-muted rounded animate-pulse w-5/6" />
                  </div>
                </CardContent>
              </Card>
            )}
            {isDeepATS && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    Running Deep ATS Analysis…
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-8 bg-muted rounded animate-pulse w-1/3" />
                    <div className="h-4 bg-muted rounded animate-pulse w-full" />
                    <div className="h-4 bg-muted rounded animate-pulse w-2/3" />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Optimization Results */}
        <OptimizationResultsPanel
          optimizedText={optimizedText}
          setOptimizedText={setOptimizedText}
          deepScore={deepScore}
          optimizationResult={optimizationResult}
          overallScore={analysisResults?.overallScore}
          isOptimizing={isOptimizing}
          isDeepATS={isDeepATS}
          nonInjectableCourses={nonInjectableCourses}
          onExport={handleExport}
        />

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Overall Score & Keywords */}
          <div className="space-y-6">
            {/* Overall Score Card */}
            <SlideUp>
              <Card>
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-base">Overall Match Score</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center">
                  <ScoreDisplay
                    score={analysisResults.overallScore}
                    size="lg"
                    showBar
                    animated={false}
                  />
                  <div className={`mt-4 text-lg font-semibold ${overallLabel.color}`}>
                    {overallLabel.text}
                  </div>
                  
                  {/* Confidence Band Display */}
                  <div className="mt-2 text-xs font-mono tabular-nums text-muted-foreground bg-muted/50 px-3 py-1 rounded-full border border-border/50">
                    Confidence Range: {Math.max(0, analysisResults.overallScore - 5)}% - {Math.min(100, analysisResults.overallScore + 5)}%
                  </div>

                  <p className="text-muted-foreground text-xs text-center mt-3">
                    Your resume matches <span className="tabular-nums font-semibold text-foreground">{analysisResults.overallScore}%</span> of the job requirements
                  </p>

                  {/* Score Plateau Warning */}
                  {analysisResults.overallScore >= 80 && (
                    <div className="mt-4 p-3 rounded-lg border border-warning/20 bg-warning/5 text-center space-y-2">
                      <p className="text-xs text-warning-foreground leading-relaxed">
                        ⚠️ <strong>Score Plateau:</strong> Above 80%, the bottleneck shifts from keywords to interview skills. Mock interviews now yield higher callback gains.
                      </p>
                      <Button size="sm" variant="outline" className="w-full text-xs h-7 gap-1 border-warning/30 hover:bg-warning/10" asChild>
                        <Link to="/interview/prep">
                          Start Practice Interviews →
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </SlideUp>

            {/* ATS Parser Compatibility Card */}
            <SlideUp delay={0.05}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold flex items-center gap-1.5 uppercase tracking-wider text-muted-foreground">
                    <Target className="w-3.5 h-3.5 text-primary" />
                    ATS Parser Compatibility
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground">
                      Estimated scoring compatibility based on parser rules:
                    </p>
                    <Link to="/methodology" className="text-[10px] text-primary hover:underline shrink-0">
                      How we score →
                    </Link>
                  </div>
                  {ATS_PARSER_PROFILES.map((ats) => {
                    const atsScore = analysisResults.per_ats?.estimates?.[ats.key] ?? null;
                    const band = analysisResults.per_ats?.band ?? ATS_DEFAULT_BAND;
                    const atsLabel = atsScore !== null
                      ? (atsScore >= ATS_SCORE_HIGH ? "High" : atsScore >= ATS_SCORE_MEDIUM ? "Medium" : "Low")
                      : null;
                    const progressColor = atsScore !== null
                      ? (atsScore >= ATS_SCORE_HIGH ? "success" as const : atsScore >= ATS_SCORE_MEDIUM ? "warning" as const : "destructive" as const)
                      : "primary" as const;
                    return (
                      <div key={ats.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">{ats.name}</span>
                            <span className="text-[9px] text-muted-foreground">{ats.desc}</span>
                          </div>
                          {atsScore !== null ? (
                            <span className="font-mono font-bold tabular-nums text-muted-foreground flex items-center gap-1">
                              {atsScore}% <span className="text-[8px] text-muted-foreground/70 font-normal">±{band}</span> <Badge variant={atsScore >= 80 ? "success" : atsScore >= 60 ? "warning" : "destructive"} className="text-[8px] px-1.5 py-0">{atsLabel}</Badge>
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Not analyzed</span>
                          )}
                        </div>
                        {atsScore !== null && (
                          <Progress value={atsScore} size="xs" colorScheme={progressColor} />
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </SlideUp>

            {/* Keywords Card */}
            <SlideUp delay={0.1}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    Keyword Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Matched Keywords */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-success" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Matched Keywords (<span className="tabular-nums">{analysisResults.matchedKeywords.length}</span>)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {analysisResults.matchedKeywords.length > 0 ? (
                        analysisResults.matchedKeywords.map((keyword) => (
                          <Badge key={keyword} variant="outline" className="bg-success/10 border-success/30 text-success text-xs">
                            {keyword}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-xs">No matched keywords found</span>
                      )}
                    </div>
                  </div>

                  {/* Missing Keywords */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="w-4 h-4 text-destructive" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Missing Keywords (<span className="tabular-nums">{analysisResults.missingKeywords.length}</span>)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {analysisResults.missingKeywords.length > 0 ? (
                        analysisResults.missingKeywords.map((keyword) => (
                          <Badge key={keyword} variant="outline" className="bg-destructive/10 border-destructive/30 text-destructive text-xs">
                            {keyword}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-xs">Great! No critical keywords missing</span>
                      )}
                    </div>

                    {/* Recommended Courses to Bridge Missing Keywords */}
                    {missingKeywordCourses.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-border/40">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <GraduationCap className="w-4 h-4 text-primary" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                              Recommended Courses to Bridge This Gap
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">Affiliated & Curated</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {missingKeywordCourses.map((course) => (
                            <div
                              key={course.id}
                              className="p-2.5 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/30 transition-colors flex flex-col justify-between gap-2"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">
                                    {course.provider}
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                                    {course.skill}
                                  </Badge>
                                </div>
                                <h6 className="text-xs font-semibold text-foreground line-clamp-1">{course.title}</h6>
                                <p className="text-[11px] text-muted-foreground line-clamp-1">{course.description}</p>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                  <span>⏱ {course.duration}</span>
                                  <span>⭐ {course.rating}</span>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full text-xs h-7 gap-1 mt-1 hover:text-primary hover:border-primary/50"
                                asChild
                              >
                                <a
                                  href={course.affiliateUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Enroll on {course.provider}
                                  <ExternalLink className="w-3 h-3 ml-0.5" />
                                </a>
                              </Button>
                            </div>
                          ))}
                        </div>
                        <p className="mt-2 text-[10px] text-muted-foreground/80 italic">
                          Curated partner courses. We may earn an affiliate commission at no extra cost to you.
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </SlideUp>

            {/* Summary Recommendation */}
            <SlideUp delay={0.2}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-primary" />
                    AI Recommendation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {analysisResults.summaryRecommendation}
                  </p>
                </CardContent>
              </Card>
            </SlideUp>
          </div>

          {/* Right Column - Flattened Section Breakdown */}
          <div className="lg:col-span-2 space-y-6">
            {/* Trust-First Score Breakdown */}
            <SlideUp delay={0.08}>
              <ScoreBreakdownCard
                breakdown={
                  optimizationResult?.score_breakdown ||
                  analysisResults.score_breakdown ||
                  null
                }
              />

            </SlideUp>

            <h2 className="text-lg font-bold text-foreground tracking-tight pt-2">
              Detailed Breakdown
            </h2>

            {analysisResults.sections.map((section, index) => {
              const isExpanded = expandedSections.includes(section.name);
              const scoreLabel = getScoreLabel(section.score);
              const Icon = sectionIcons[section.name] || FileText;

              return (
                <Card
                  key={section.name}
                  className="overflow-hidden border border-border/60 hover:border-border transition-colors"
                >
                  <button
                    onClick={() => toggleSection(section.name)}
                    className="w-full p-4 flex items-center justify-between hover:bg-muted/40 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm text-foreground">{section.name}</h3>
                        <p className={`text-xs ${scoreLabel.color} font-medium`}>{scoreLabel.text}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <ScoreDisplay score={section.score} size="sm" animated={false} />
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {isExpanded && section.suggestions.length > 0 && (
                    <CardContent className="pt-0 pb-4 px-4 border-t border-border/40">
                      <div className="pt-3">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
                          <Lightbulb className="w-3.5 h-3.5" />
                          Suggestions to Improve
                        </div>
                        <ul className="space-y-2">
                          {section.suggestions.map((suggestion) => {
                            const isApplied = appliedSuggestions.includes(suggestion);
                            return (
                              <li
                                key={suggestion}
                                className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                                  isApplied
                                    ? "bg-success/10 border border-success/20"
                                    : "bg-muted/30 hover:bg-muted/50"
                                }`}
                              >
                                <span className={`flex-1 text-xs leading-relaxed ${isApplied ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                  {suggestion}
                                </span>
                                <Button
                                  size="sm"
                                  variant={isApplied ? "ghost" : "outline"}
                                  onClick={() => applySuggestion(suggestion)}
                                  className="shrink-0 h-7 text-xs px-2.5"
                                >
                                  {isApplied ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 mr-1 text-success" />
                                      Applied
                                    </>
                                  ) : (
                                    "Apply"
                                  )}
                                </Button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        {/* Bottom Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10 pb-6 border-t border-border/40 pt-8">
          <Button size="lg" variant="glow" onClick={handleChooseTemplate} className="gap-2 font-semibold">
            <Edit className="w-4 h-4" />
            Choose a Template & Download
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/resume">
              Analyze Another Resume
            </Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
};

export default ResumeResults;
