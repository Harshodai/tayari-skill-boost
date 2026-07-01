import { useState } from "react";
import { Link, useLocation, Navigate, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreDisplay } from "@/components/ui/score-display";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Download, Edit, RotateCcw, ChevronDown, ChevronUp, Check,
  Lightbulb, Target, Briefcase, GraduationCap, FileText, AlertCircle,
  CheckCircle2, XCircle, Wand2, Sparkles, Loader2, RefreshCw,
  MessageSquare, Mail
} from "lucide-react";
import type { ResumeAnalysisResult } from "@/types/resume";
import type { GuardrailResult } from "@/api/types";
import { SlideUp } from "@/components/ui/motion";
import { Progress } from "@/components/ui/progress";
import { optimizeResume, deepATS, exportResume } from "@/api";
import { toast } from "sonner";

// Icon mapping for sections
const sectionIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "Skills Match": Target,
  "Experience Relevance": Briefcase,
  "Education Fit": GraduationCap,
  "Formatting": FileText,
};

// --- ATS scoring constants (mirror ats_engine.py; single source of truth in UI) ---
// ponytail: named constants so thresholds aren't magic numbers scattered in JSX.
const ATS_SCORE_HIGH = 80;
const ATS_SCORE_MEDIUM = 60;
const ATS_DEFAULT_BAND = 5;

// SRP: per-ATS parser profile is config data, separate from render logic.
// `key` maps to ats_engine per_ats.estimates keys; `offset` is the fallback
// heuristic when the Python per_ats estimate isn't present.
interface AtsParserProfile {
  name: string;
  key: string;
  offset: number;
  desc: string;
}
const ATS_PARSER_PROFILES: AtsParserProfile[] = [
  { name: "Greenhouse", key: "greenhouse", offset: 3, desc: "Markdown & structured text friendly" },
  { name: "Workday", key: "workday", offset: -4, desc: "Rigid table and column rules" },
  { name: "iCIMS", key: "icims", offset: -6, desc: "Strict formatting and layout rules" },
  { name: "Taleo", key: "taleo", offset: 1, desc: "Keyword heavy sorting algorithm" },
];

const ResumeResults = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const analysisResults = location.state?.analysisResults as ResumeAnalysisResult | undefined;
  const resumeFileName = location.state?.resumeFileName as string | undefined;
  const resumeText = location.state?.resumeText as string | undefined;
  const jobDescription = location.state?.jobDescription as string | undefined;
  const resumeId = location.state?.resumeId as number | undefined;

  const [expandedSections, setExpandedSections] = useState<string[]>(
    analysisResults?.sections?.[0]?.name ? [analysisResults.sections[0].name] : []
  );
  const [appliedSuggestions, setAppliedSuggestions] = useState<string[]>([]);
  const [optimizedText, setOptimizedText] = useState<string | null>(null);
  const [optimizationResult, setOptimizationResult] = useState<any>(null);
  const [guardrails, setGuardrails] = useState<GuardrailResult | null>(null);
  const [deepScore, setDeepScore] = useState<any>(null);
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
      const res = await optimizeResume(resumeId, jobDescription);
      const text = res?.optimized_text || res?.optimized_resume || res?.result;
      if (text) {
        setOptimizedText(text);
      } else {
        setOptimizedText(JSON.stringify(res, null, 2));
      }
      setOptimizationResult(res);
      if (res?.guardrails) setGuardrails(res.guardrails as GuardrailResult);
      toast.success("Resume optimized!");
    } catch (err: any) {
      const msg = err.message || "Optimization failed";
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
    } catch (err: any) {
      const msg = err.message || "Deep ATS failed";
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
    } catch (err: any) {
      const msg = err.message || "Export failed";
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

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <Button variant="ghost" asChild className="mb-2">
              <Link to="/resume">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Upload
              </Link>
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Resume Analysis Results
            </h1>
            {resumeFileName && (
              <p className="text-muted-foreground text-sm mt-1">
                Analyzed: {resumeFileName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" onClick={handleOptimize} disabled={isOptimizing || !resumeId}>
              {isOptimizing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
              Optimize
            </Button>
            <Button variant="outline" onClick={handleDeepATS} disabled={isDeepATS || !resumeId}>
              {isDeepATS ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Deep ATS
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={isExporting || !resumeId}>
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
              Export DOCX
            </Button>
            <Button variant="outline" onClick={handleChooseTemplate}>
              <Edit className="w-4 h-4 mr-2" />
              Choose Template
            </Button>
            <Button variant="outline" asChild>
              <Link to="/cover-letter">
                <MessageSquare className="w-4 h-4 mr-2" />
                Cover Letter
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/communication">
                <Mail className="w-4 h-4 mr-2" />
                Communication Hub
              </Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/resume">
                <RotateCcw className="w-4 h-4 mr-2" />
                Start Over
              </Link>
            </Button>
          </div>
        </div>

            {/* Guardrail Results Card */}
            {guardrails && (
              <SlideUp delay={0.25}>
                <Card className={guardrails.all_passed ? "border-success/40" : "border-warning/40"}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {guardrails.all_passed ? (
                        <CheckCircle2 className="w-5 h-5 text-success" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-warning" />
                      )}
                      Quality Check
                      <Badge variant={guardrails.all_passed ? "default" : "secondary"} className="ml-auto">
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
                          <span className="text-xs text-muted-foreground">
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
                  <CardTitle className="flex items-center gap-2">
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
                  <CardTitle className="flex items-center gap-2">
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
        {(optimizedText || deepScore) && !isOptimizing && !isDeepATS && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {optimizedText && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wand2 className="w-5 h-5 text-primary" />
                    Optimized Resume
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={optimizedText}
                    onChange={(e) => setOptimizedText(e.target.value)}
                    className="min-h-[420px] font-mono text-sm leading-relaxed"
                  />
                  <div className="flex gap-2 mt-4">
                    <Button onClick={() => navigator.clipboard.writeText(optimizedText).then(() => toast.success("Copied!"))}>
                      Copy
                    </Button>
                    <Button variant="outline" onClick={handleExport}>
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {deepScore && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Deep ATS Score
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold">
                      {deepScore.score ?? deepScore.ats_score ?? "N/A"}
                    </div>
                    <p className="text-muted-foreground text-sm">Overall Score</p>
                  </div>
                  {deepScore.checks && (
                    <div className="space-y-2">
                      {Object.entries(deepScore.checks).map(([key, val]: [string, any]) => (
                        <div key={key} className="flex items-center justify-between text-sm">
                          <span className="capitalize">{key.replace(/_/g, " ")}</span>
                          <Badge variant={val?.passed ? "default" : "destructive"}>
                            {val?.passed ? "Pass" : "Fail"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  {deepScore.recommendations && (
                    <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                      <p className="font-medium">Recommendations:</p>
                      {(deepScore.recommendations as string[]).map((r, i) => (
                        <p key={i} className="text-muted-foreground">• {r}</p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {optimizationResult && !deepScore && (
              <Card className="flex flex-col h-full border border-border/60 shadow-lg">
                <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                      <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                      AI Tailoring Feedback & Critique
                    </CardTitle>
                    {optimizationResult.alignment_report?.is_aligned ? (
                      <Badge variant="outline" className="bg-success/10 border-success/30 text-success flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                        Verified Truthful
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-warning/10 border-warning/30 text-warning flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-warning" />
                        Fabrication Alerts
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-5 pt-4 overflow-y-auto max-h-[500px]">
                  {/* Score & Passes comparison */}
                  <div className="flex items-center justify-between bg-muted/40 rounded-lg p-3 border border-border/30">
                    <div>
                      <span className="text-xs text-muted-foreground block font-medium uppercase tracking-wider">Before Score</span>
                      <span className="text-2xl font-bold text-muted-foreground">{analysisResults?.overallScore}%</span>
                    </div>
                    <div className="text-primary font-bold text-lg">→</div>
                    <div>
                      <span className="text-xs text-primary block font-medium uppercase tracking-wider">Tailored Score</span>
                      <span className="text-2xl font-bold text-primary">{optimizationResult.new_heuristic_score}%</span>
                    </div>
                    <div className="border-l border-border/60 pl-3">
                      <span className="text-xs text-muted-foreground block">Refinement</span>
                      <span className="font-semibold text-sm">{optimizationResult.refinement_passes} pass(es)</span>
                    </div>
                  </div>

                  {/* ── Optimization Summary ──────────────────────────── */}
                  {optimizationResult.optimization_summary && (
                    <div className="grid grid-cols-2 gap-2">
                      {/* Semantic similarity */}
                      {optimizationResult.optimization_summary.semantic_score_before != null && (
                        <div className="bg-muted/40 rounded-lg p-2.5 border border-border/30 space-y-1">
                          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">Semantic Match</span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm font-semibold text-muted-foreground">
                              {optimizationResult.optimization_summary.semantic_score_before}%
                            </span>
                            <span className="text-primary font-bold text-xs">→</span>
                            <span className="text-lg font-bold text-primary">
                              {optimizationResult.optimization_summary.semantic_score_after ?? optimizationResult.optimization_summary.semantic_score_before}%
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1">
                            <div
                              className="bg-primary h-1 rounded-full transition-all duration-700"
                              style={{ width: `${optimizationResult.optimization_summary.semantic_score_after ?? 0}%` }}
                            />
                          </div>
                          {optimizationResult.semantic_similarity_after?.interpretation && (
                            <span className="text-xs text-muted-foreground leading-tight block">
                              {optimizationResult.semantic_similarity_after.interpretation}
                            </span>
                          )}
                        </div>
                      )}

                      {/* STAR score */}
                      {optimizationResult.optimization_summary.avg_star_score != null && (
                        <div className="bg-muted/40 rounded-lg p-2.5 border border-border/30 space-y-1">
                          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">STAR Score</span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-primary">
                              {optimizationResult.optimization_summary.avg_star_score}
                            </span>
                            <span className="text-xs text-muted-foreground">/4 avg</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1">
                            <div
                              className="bg-amber-500 h-1 rounded-full transition-all duration-700"
                              style={{ width: `${(optimizationResult.optimization_summary.avg_star_score / 4) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground block">
                            {optimizationResult.star_analysis?.bullets_scored ?? 0} bullets scored
                          </span>
                        </div>
                      )}

                      {/* Buzzwords cleaned */}
                      {optimizationResult.optimization_summary.buzzwords_cleaned != null && (
                        <div className="bg-muted/40 rounded-lg p-2.5 border border-border/30">
                          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">Buzzwords Cleaned</span>
                          <span className="text-2xl font-bold text-green-500">{optimizationResult.optimization_summary.buzzwords_cleaned}</span>
                        </div>
                      )}

                      {/* JD keyword coverage */}
                      {optimizationResult.keyword_matrix?.hard_skill_coverage != null && (
                        <div className="bg-muted/40 rounded-lg p-2.5 border border-border/30">
                          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">Hard Skill Coverage</span>
                          <span className={`text-2xl font-bold ${
                            optimizationResult.keyword_matrix.hard_skill_coverage >= 80 ? 'text-green-500' :
                            optimizationResult.keyword_matrix.hard_skill_coverage >= 50 ? 'text-amber-500' : 'text-destructive'
                          }`}>{optimizationResult.keyword_matrix.hard_skill_coverage}%</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── STAR Bullet Analysis ───────────────────────────── */}
                  {optimizationResult.star_analysis?.bullets_needing_improvement?.length > 0 && (
                    <div className="space-y-3 pt-1 border-t border-border/40">
                      <h4 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                        <Target className="w-4 h-4 text-amber-500" />
                        STAR Bullet Analysis
                      </h4>
                      <div className="space-y-2">
                        {optimizationResult.star_analysis.bullets_needing_improvement.slice(0, 4).map((b: any, idx: number) => (
                          <div key={idx} className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground font-mono truncate max-w-[220px]">{b.bullet}</span>
                              <Badge variant="outline" className={`ml-1 shrink-0 ${
                                b.star_score >= 3 ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                b.star_score >= 2 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                'bg-destructive/10 text-destructive border-destructive/20'
                              }`}>
                                STAR {b.star_grade}
                              </Badge>
                            </div>
                            {b.suggestion && (
                              <p className="text-amber-600 dark:text-amber-400 leading-relaxed">
                                💡 {b.suggestion}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── JD Keyword Matrix ─────────────────────────────── */}
                  {optimizationResult.keyword_matrix?.hard_skills_matrix?.length > 0 && (
                    <div className="space-y-3 pt-1 border-t border-border/40">
                      <h4 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                        <Sparkles className="w-4 h-4 text-primary" />
                        JD Keyword Matrix
                      </h4>
                      <div className="grid grid-cols-1 gap-3">
                        {/* Hard Skills */}
                        {optimizationResult.keyword_matrix.hard_skills_matrix?.length > 0 && (
                          <div>
                            <span className="text-xs font-semibold text-blue-500 uppercase tracking-wider block mb-1.5">Hard Skills</span>
                            <div className="flex flex-wrap gap-1.5">
                              {optimizationResult.keyword_matrix.hard_skills_matrix.slice(0, 12).map((item: any) => (
                                <Badge
                                  key={item.keyword}
                                  variant="outline"
                                  className={`text-xs ${
                                    item.in_resume
                                      ? 'bg-green-500/10 text-green-600 border-green-500/30'
                                      : 'bg-destructive/10 text-destructive border-destructive/20'
                                  }`}
                                >
                                  {item.in_resume ? '✓' : '✗'} {item.keyword}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Soft Skills */}
                        {optimizationResult.keyword_matrix.soft_skills_matrix?.length > 0 && (
                          <div>
                            <span className="text-xs font-semibold text-purple-500 uppercase tracking-wider block mb-1.5">Soft Skills</span>
                            <div className="flex flex-wrap gap-1.5">
                              {optimizationResult.keyword_matrix.soft_skills_matrix.slice(0, 8).map((item: any) => (
                                <Badge
                                  key={item.keyword}
                                  variant="outline"
                                  className={`text-xs ${
                                    item.in_resume
                                      ? 'bg-green-500/10 text-green-600 border-green-500/30'
                                      : 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                                  }`}
                                >
                                  {item.in_resume ? '✓' : '~'} {item.keyword}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Domain */}
                        {optimizationResult.keyword_matrix.domain_matrix?.length > 0 && (
                          <div>
                            <span className="text-xs font-semibold text-cyan-500 uppercase tracking-wider block mb-1.5">Domain Terms</span>
                            <div className="flex flex-wrap gap-1.5">
                              {optimizationResult.keyword_matrix.domain_matrix.slice(0, 8).map((item: any) => (
                                <Badge
                                  key={item.keyword}
                                  variant="outline"
                                  className={`text-xs ${
                                    item.in_resume
                                      ? 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30'
                                      : 'bg-muted text-muted-foreground border-border/40'
                                  }`}
                                >
                                  {item.in_resume ? '✓' : '○'} {item.keyword}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Keyword Gap Analysis (meaningful terms only) ──── */}
                  <div className="space-y-3 pt-1 border-t border-border/40">
                    <h4 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                      <Target className="w-4 h-4 text-primary" />
                      Keyword Gap Analysis
                    </h4>
                    
                    {/* Injectable/Added Keywords */}
                    <div className="space-y-1.5">
                      <span className="text-xs text-muted-foreground font-medium block">
                        Keywords Woven In (From Master Resume):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {optimizationResult.injectable_keywords?.length > 0 ? (
                          optimizationResult.injectable_keywords.map((kw: string) => (
                            <Badge key={kw} variant="secondary" className="bg-success/10 text-success border-success/20 text-xs">
                              +{kw}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No extra injectable keywords found.</span>
                        )}
                      </div>
                    </div>

                    {/* Skill Gaps */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-xs text-muted-foreground font-medium block">
                        Remaining Skill Gaps (Not in master resume):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {optimizationResult.non_injectable_keywords?.length > 0 ? (
                          optimizationResult.non_injectable_keywords.map((kw: string) => (
                            <Badge key={kw} variant="outline" className="bg-destructive/5 text-destructive border-destructive/20 text-xs">
                              {kw}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground italic text-success">All job keywords matched!</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* AI Buzzwords */}
                  <div className="space-y-3 pt-1 border-t border-border/40">
                    <h4 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                      <Wand2 className="w-4 h-4 text-primary" />
                      AI Buzzword Cleanup
                    </h4>
                    {optimizationResult.removed_ai_phrases?.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {optimizationResult.removed_ai_phrases.map((item: any, idx: number) => (
                          <div key={idx} className="bg-muted/50 rounded p-2 border border-border/30 flex items-center justify-between">
                            <span className="line-through text-muted-foreground font-mono">{item.buzzword}</span>
                            <span className="text-primary font-bold">→</span>
                            <span className="font-semibold text-foreground">{item.replacement || "removed"}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">No generic AI buzzwords or clichés detected.</span>
                    )}
                  </div>

                  {/* Metric quantification suggestions */}
                  <div className="space-y-3 pt-1 border-t border-border/40">
                    <h4 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                      <Lightbulb className="w-4 h-4 text-primary" />
                      Experience Bullet Recommendations
                    </h4>
                    {optimizationResult.metric_suggestions?.length > 0 ? (
                      <ul className="space-y-2">
                        {optimizationResult.metric_suggestions.map((sug: string, idx: number) => (
                          <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1.5">
                            <span className="text-primary font-bold mt-0.5">•</span>
                            <span>{sug}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs text-success italic flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        Excellent! All experience bullets are well-quantified with metrics.
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Overall Score & Keywords */}
          <div className="space-y-6">
            {/* Overall Score Card */}
            <SlideUp>
              <Card>
                <CardHeader className="text-center">
                  <CardTitle>Overall Match Score</CardTitle>
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
                  <div className="mt-2 text-xs font-mono text-muted-foreground bg-muted/50 px-3 py-1 rounded-full border border-border/50">
                    Confidence Range: {Math.max(0, analysisResults.overallScore - 5)}% - {Math.min(100, analysisResults.overallScore + 5)}%
                  </div>

                  <p className="text-muted-foreground text-xs text-center mt-3">
                    Your resume matches {analysisResults.overallScore}% of the job requirements
                  </p>

                  {/* Score Plateau Warning */}
                  {analysisResults.overallScore >= 80 && (
                    <div className="mt-4 p-3 rounded-lg border border-warning/20 bg-warning/5 text-center space-y-2">
                      <p className="text-xs text-warning-foreground leading-relaxed">
                        ⚠️ **Score Plateau:** Above 80%, the bottleneck shifts from keywords to interview skills. Mock interviews now yield higher callback gains.
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
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5 uppercase tracking-wider text-muted-foreground">
                    <Target className="w-4 h-4 text-primary" />
                    ATS Parser Compatibility
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground">
                      Estimated scoring compatibility based on typical parser rules:
                    </p>
                    <Link to="/methodology" className="text-[10px] text-primary hover:underline shrink-0">
                      How we score →
                    </Link>
                  </div>
                  {/* ponytail: prefer real per_ats estimates (Python ats_engine) when present;
                      fall back to the offset heuristic on pure-Go analyzer paths. Band from
                      per_ats.band when available, else ±5. */}
                  {ATS_PARSER_PROFILES.map((ats) => {
                    const realEstimate = analysisResults.per_ats?.estimates?.[ats.key];
                    const atsScore = realEstimate != null
                      ? realEstimate
                      : Math.max(10, Math.min(100, analysisResults.overallScore + ats.offset));
                    const band = analysisResults.per_ats?.band ?? ATS_DEFAULT_BAND;
                    const atsLabel = atsScore >= ATS_SCORE_HIGH ? "High" : atsScore >= ATS_SCORE_MEDIUM ? "Medium" : "Low";
                    const progressColor = atsScore >= ATS_SCORE_HIGH ? "success" as const : atsScore >= ATS_SCORE_MEDIUM ? "warning" as const : "destructive" as const;
                    return (
                      <div key={ats.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">{ats.name}</span>
                            <span className="text-[9px] text-muted-foreground">{ats.desc}</span>
                          </div>
                          <span className="font-mono font-bold text-muted-foreground flex items-center gap-1">
                            {atsScore}% <span className="text-[8px] text-muted-foreground/70 font-normal">±{band}</span> <Badge variant={atsScore >= 80 ? "success" : atsScore >= 60 ? "warning" : "destructive"} className="text-[8px] px-1.5 py-0">{atsLabel}</Badge>
                          </span>
                        </div>
                        <Progress value={atsScore} size="xs" colorScheme={progressColor} />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </SlideUp>

            {/* Keywords Card */}
            <SlideUp delay={0.1}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    Keyword Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Matched Keywords */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-success" />
                      <span className="text-sm font-medium">Matched Keywords</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {analysisResults.matchedKeywords.length > 0 ? (
                        analysisResults.matchedKeywords.map((keyword) => (
                          <Badge key={keyword} variant="outline" className="bg-success/10 border-success/30 text-success">
                            {keyword}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-sm">No matched keywords found</span>
                      )}
                    </div>
                  </div>

                  {/* Missing Keywords */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="w-4 h-4 text-destructive" />
                      <span className="text-sm font-medium">Missing Keywords</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {analysisResults.missingKeywords.length > 0 ? (
                        analysisResults.missingKeywords.map((keyword) => (
                          <Badge key={keyword} variant="outline" className="bg-destructive/10 border-destructive/30 text-destructive">
                            {keyword}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-sm">Great! No critical keywords missing</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </SlideUp>

            {/* Summary Recommendation */}
            <SlideUp delay={0.2}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-primary" />
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

          {/* Right Column - Section Breakdown */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Detailed Breakdown
            </h2>

            {analysisResults.sections.map((section, index) => {
              const isExpanded = expandedSections.includes(section.name);
              const scoreLabel = getScoreLabel(section.score);
              const Icon = sectionIcons[section.name] || FileText;

              return (
                <Card
                  key={section.name}
                  className="animate-fade-in-up overflow-hidden"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <button
                    onClick={() => toggleSection(section.name)}
                    className="w-full p-4 flex items-center justify-between hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-foreground">{section.name}</h3>
                        <p className={`text-sm ${scoreLabel.color}`}>{scoreLabel.text}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <ScoreDisplay score={section.score} size="sm" animated={false} />
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {isExpanded && section.suggestions.length > 0 && (
                    <CardContent className="pt-0 pb-4 px-4 border-t border-border/50">
                      <div className="pt-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
                          <Lightbulb className="w-4 h-4" />
                          Suggestions to Improve
                        </div>
                        <ul className="space-y-2">
                          {section.suggestions.map((suggestion) => {
                            const isApplied = appliedSuggestions.includes(suggestion);
                            return (
                              <li
                                key={suggestion}
                                className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${isApplied
                                  ? "bg-success/10 border border-success/20"
                                  : "bg-accent/50"
                                  }`}
                              >
                                <span className={`flex-1 text-sm ${isApplied ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                  {suggestion}
                                </span>
                                <Button
                                  size="sm"
                                  variant={isApplied ? "ghost" : "outline"}
                                  onClick={() => applySuggestion(suggestion)}
                                  className="flex-shrink-0"
                                >
                                  {isApplied ? (
                                    <>
                                      <Check className="w-4 h-4 mr-1 text-success" />
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

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
          <Button size="lg" variant="glow" onClick={handleChooseTemplate}>
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
