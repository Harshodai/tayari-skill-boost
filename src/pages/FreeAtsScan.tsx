import { apiFetchResponse } from "@/api";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Check, X, ArrowRight, Loader2, Zap, WifiOff, Sparkles, Download, Copy, FileText, CheckCircle2 } from "lucide-react";
import { Layout } from "@/components/layout";
import { toast } from "sonner";
import { SAMPLE_PRESETS, type SamplePreset } from "@/data/samplePresets";

export default function FreeAtsScan() {
  const location = useLocation();
  const initialResume = (location.state?.resumeText as string) || "";
  const initialJob = (location.state?.jobDescription as string) || "";
  const initialPreset = (location.state?.activePreset as string) || null;
  const autoScanRequested = Boolean(location.state?.autoScan);

  const [resumeText, setResumeText] = useState(initialResume);
  const [jobDescription, setJobDescription] = useState(initialJob);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [activePreset, setActivePreset] = useState<string | null>(initialPreset);
  const abortRef = useRef<AbortController | null>(null);
  const autoScanTriggeredRef = useRef(false);

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
    toast.success(`Loaded sample: ${preset.label} (${preset.company})`);
  };

  const executeScan = async (rText: string, jText: string) => {
    if (offline) {
      setError("You are offline. Reconnect before starting a scan.");
      return;
    }
    if (!rText.trim() || !jText.trim()) {
      setError("Please fill in both fields before scanning.");
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
          resume_text: rText,
          job_description: jText,
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      const returnedScore = data?.overall_score ?? data?.result?.overall_score;
      if (typeof returnedScore !== "number" || !Number.isFinite(returnedScore)) {
        throw new Error("The service returned no measurable score. Please try again.");
      }
      setResult(data);
    } catch (caught: unknown) {
      const errObj = caught as { name?: string; status?: number; message?: string } | null;
      if (errObj?.name !== "AbortError") {
        if (errObj?.status === 429) {
          setError("Rate limit reached. Please wait a moment before trying again, or create a free account for higher limits.");
        } else if (errObj?.status === 400 || errObj?.status === 422) {
          setError("Invalid input. Please check your resume and job description text and try again.");
        } else {
          setError(caught instanceof Error ? caught.message : "Analysis failed. Please try again.");
        }
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setLoading(false);
    }
  };

  const handleScan = () => executeScan(resumeText, jobDescription);

  useEffect(() => {
    if (autoScanRequested && !autoScanTriggeredRef.current && initialResume.trim() && initialJob.trim()) {
      autoScanTriggeredRef.current = true;
      executeScan(initialResume, initialJob);
    }
  }, [autoScanRequested, initialResume, initialJob]);

  const cancelScan = () => {
    abortRef.current?.abort();
    setLoading(false);
    setError("Scan cancelled. Your pasted text remains in this form.");
  };

  const exportReport = () => {
    if (!result) return;
    const reportData = {
      score,
      breakdown,
      matched,
      missing,
      recommendations,
      timestamp: new Date().toISOString(),
      generator: "Job Tayari ATS Verification Heuristic v2",
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ats_scan_audit_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Audit report downloaded as JSON");
  };

  const score = result?.overall_score ?? result?.result?.overall_score;
  const breakdown = result?.score_breakdown ?? result?.result?.section_scores ?? {};
  const matched = result?.matching_skills ?? result?.result?.matched_keywords ?? [];
  const missing = result?.missing_skills ?? result?.result?.missing_keywords ?? [];
  const recommendations = result?.recommendations ?? result?.result?.recommendations ?? [];

  const scoreColor = score >= 80 ? "text-success" : score >= 60 ? "text-warning" : "text-destructive";

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-hero py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Free ATS Decompiler & Reverse Scanner</span>
            </div>
            <h1 className="font-display text-balance text-3xl md:text-4xl lg:text-5xl font-bold mb-3 tracking-tight">
              See the <span className="text-gradient">signals worth checking</span> before you apply.
            </h1>
            <p className="text-balance text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
              Compare your resume with a role, then use the heuristic results to guide a more deliberate review. No signup required.
            </p>
          </div>

          {/* Quick Presets for Instant 1-Click Testing */}
          <div className="mb-6 rounded-xl border border-border/60 bg-card/60 p-3.5 backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 font-mono">
                <FileText className="h-3.5 w-3.5 text-primary" /> Load Sample Requisition & Resume:
              </span>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant={activePreset === preset.label || activePreset === preset.company ? "secondary" : "outline"}
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

          {offline && (
            <div role="status" aria-live="polite" className="mb-6 flex items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              <WifiOff className="h-4 w-4" /> You are offline. Scans need a connection to the configured service.
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="resume-text" className="block text-sm font-medium">Your Resume</label>
                {resumeText && (
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {resumeText.split(/\s+/).filter(Boolean).length} words
                  </span>
                )}
              </div>
              <textarea
                id="resume-text"
                aria-describedby="resume-help"
                aria-invalid={Boolean(error && !resumeText.trim())}
                value={resumeText}
                onChange={(e) => {
                  setResumeText(e.target.value);
                  setActivePreset(null);
                }}
                placeholder="Paste your full resume text here..."
                rows={12}
                className="w-full px-4 py-3 rounded-xl border border-border bg-card text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary resize-y font-mono text-xs leading-relaxed"
              />
              <p id="resume-help" className="mt-1 text-xs text-muted-foreground">Paste only the text needed for this scan; do not include secrets.</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="job-description" className="block text-sm font-medium">Job Description</label>
                {jobDescription && (
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {jobDescription.split(/\s+/).filter(Boolean).length} words
                  </span>
                )}
              </div>
              <textarea
                id="job-description"
                aria-invalid={Boolean(error && !jobDescription.trim())}
                value={jobDescription}
                onChange={(e) => {
                  setJobDescription(e.target.value);
                  setActivePreset(null);
                }}
                placeholder="Paste the job description here..."
                rows={12}
                className="w-full px-4 py-3 rounded-xl border border-border bg-card text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary resize-y font-mono text-xs leading-relaxed"
              />
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 mb-8">
            <Button
              size="lg"
              onClick={handleScan}
              disabled={loading || offline}
              aria-busy={loading}
              className="px-8 font-semibold active:scale-[0.98] shadow-md"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Zap className="w-5 h-5 mr-2" />}
              {loading ? "Scanning ATS Signals..." : "Review my resume"}
            </Button>
            {loading && (
              <Button type="button" size="lg" variant="outline" onClick={cancelScan} className="active:scale-[0.98]">
                Cancel scan
              </Button>
            )}
          </div>

          {error && (
            <Card role="alert" aria-live="assertive" className="border-destructive/50 mb-8">
              <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6">
                <p className="text-destructive text-sm">{error}</p>
                <div className="flex items-center gap-2 shrink-0">
                  {error.toLowerCase().includes("rate limit") ? (
                    <Button size="sm" asChild className="active:scale-[0.98]">
                      <Link to="/auth?redirect=/pricing">Create Free Account</Link>
                    </Button>
                  ) : (
                    !loading && !offline && resumeText.trim() && jobDescription.trim() && (
                      <Button type="button" size="sm" variant="outline" onClick={handleScan} className="active:scale-[0.98]">Try again</Button>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {result && (
            <div className="space-y-6 mb-8">
              {/* Header Action Bar */}
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary">
                  Scan Completed
                </Badge>
                <Button size="sm" variant="outline" onClick={exportReport} className="text-xs h-8">
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Export Audit JSON
                </Button>
              </div>

              {/* Main Scorecard */}
              <Card className="text-center bg-card/70 border-border/80 shadow-xl backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="font-display text-lg">Role-alignment signal</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-6xl font-black mb-4 font-mono tabular-nums ${scoreColor}`}>
                    {score}%
                  </div>
                  <Progress value={score} className="h-3 mb-4 max-w-md mx-auto" />
                  <p className="text-balance text-muted-foreground text-sm max-w-lg mx-auto">
                    {score >= 80 ? "Strong alignment signal. Review the role-specific details before you decide the materials are ready." :
                     score >= 60 ? "Some signals align and some deserve a closer look. Use the gaps to guide a focused revision." :
                     "Lower alignment signal. Consider whether this role is the right target and which truthful details need clearer context."}
                  </p>
                </CardContent>
              </Card>

              {Object.keys(breakdown).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="font-display text-lg">Score Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Object.entries(breakdown).map(([key, val]) => (
                      <div key={key}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="capitalize">{key.replace(/_/g, " ")}</span>
                          <span className="font-semibold font-mono tabular-nums">{val as number}%</span>
                        </div>
                        <Progress value={val as number} className="h-2" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-display text-lg text-success flex items-center gap-2">
                      <Check className="w-5 h-5" /> Matched Skills
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {matched.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {matched.map((s: string) => (
                          <span key={s} className="px-3 py-1 rounded-full bg-success/10 text-success text-sm border border-success/20 font-medium">
                            {s}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No exact keyword matches found.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="font-display text-lg text-destructive flex items-center gap-2">
                      <X className="w-5 h-5" /> Terms to review
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {missing.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {missing.map((s: string) => (
                          <span key={s} className="px-3 py-1 rounded-full bg-destructive/10 text-destructive text-sm border border-destructive/20 font-medium">
                            {s}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No missing keywords detected.</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {recommendations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="font-display text-lg">Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {recommendations.map((r: string, i: number) => (
                        <li key={i} className="flex items-start gap-3 text-sm">
                          <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {result && (
            <div className="text-center py-10 border-t border-border">
              <h2 className="font-display text-balance text-2xl font-bold mb-3 tracking-tight">Ready to turn this signal into a better next step?</h2>
              <p className="text-balance text-muted-foreground mb-6 max-w-md mx-auto">
                Create an account to keep this work in context, continue with deeper analysis, and prepare your materials within the limits shown for your plan.
              </p>
              <div className="flex items-center justify-center gap-4">
                <Button size="lg" asChild className="active:scale-[0.98] font-semibold">
                  <Link to="/auth?redirect=/pricing">
                    Create Free Account <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild className="active:scale-[0.98]">
                  <Link to="/pricing">
                    See Pricing
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {!result && (
            <div className="text-center py-10">
              <p className="text-muted-foreground text-sm">
                Already have an account?{" "}
                <Link to="/auth" className="text-primary hover:underline">Log in</Link> to continue your review with the limits shown in your account.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
