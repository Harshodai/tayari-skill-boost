import { apiFetchResponse } from "@/api";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, X, ArrowRight, Loader2, Zap, WifiOff } from "lucide-react";
import { Layout } from "@/components/layout";


export default function FreeAtsScan() {
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
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

  const handleScan = async () => {
    if (offline) {
      setError("You are offline. Reconnect before starting a scan.");
      return;
    }
    if (!resumeText.trim() || !jobDescription.trim()) {
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
          resume_text: resumeText,
          job_description: jobDescription,
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      const returnedScore = data?.overall_score ?? data?.result?.overall_score;
      if (typeof returnedScore !== "number" || !Number.isFinite(returnedScore)) {
        throw new Error("The service returned no measurable score. Please try again.");
      }
      setResult(data);
    } catch (caught: any) {
      if (caught?.name !== "AbortError") {
        if (caught?.status === 429) {
          setError("Rate limit reached. Please wait a moment before trying again, or create a free account for higher limits.");
        } else if (caught?.status === 400 || caught?.status === 422) {
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

  const cancelScan = () => {
    abortRef.current?.abort();
    setLoading(false);
    setError("Scan cancelled. Your pasted text remains in this form.");
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
          <div className="text-center mb-10">
            <h1 className="font-display text-balance text-3xl md:text-4xl font-bold mb-3 tracking-tight">
              Free <span className="text-gradient">ATS Resume Scan</span>
            </h1>
            <p className="text-balance text-muted-foreground text-lg">
              Paste your resume and a job description to see how you score. No signup required.
            </p>
          </div>

          {offline && (
            <div role="status" aria-live="polite" className="mb-6 flex items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              <WifiOff className="h-4 w-4" /> You are offline. Scans need a connection to the configured service.
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div>
              <label htmlFor="resume-text" className="block text-sm font-medium mb-2">Your Resume</label>
              <textarea
                id="resume-text"
                aria-describedby="resume-help"
                aria-invalid={Boolean(error && !resumeText.trim())}
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste your full resume text here..."
                rows={12}
                className="w-full px-4 py-3 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y"
              />
              <p id="resume-help" className="mt-1 text-xs text-muted-foreground">Paste only the text needed for this scan; do not include secrets.</p>
            </div>
            <div>
              <label htmlFor="job-description" className="block text-sm font-medium mb-2">Job Description</label>
              <textarea
                id="job-description"
                aria-invalid={Boolean(error && !jobDescription.trim())}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job description here..."
                rows={12}
                className="w-full px-4 py-3 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y"
              />
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 mb-8">
            <Button
              size="lg"
              onClick={handleScan}
              disabled={loading || offline}
              aria-busy={loading}
              className="px-8 active:scale-[0.98]"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Zap className="w-5 h-5 mr-2" />}
              {loading ? "Scanning..." : "Scan My Resume"}
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
              <Card className="text-center">
                <CardHeader>
                  <CardTitle className="font-display text-lg">ATS Match Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-6xl font-black mb-4 font-mono tabular-nums ${scoreColor}`}>
                    {score}%
                  </div>
                  <Progress value={score} className="h-3 mb-4" />
                  <p className="text-balance text-muted-foreground text-sm">
                    {score >= 80 ? "Strong match! Your resume is well-aligned with this role." :
                     score >= 60 ? "Decent match. Some improvements could boost your callback rate." :
                     "Low match. Significant tailoring needed for this role."}
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
                          <span key={s} className="px-3 py-1 rounded-full bg-success/10 text-success text-sm border border-success/20">
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
                      <X className="w-5 h-5" /> Missing Keywords
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {missing.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {missing.map((s: string) => (
                          <span key={s} className="px-3 py-1 rounded-full bg-destructive/10 text-destructive text-sm border border-destructive/20">
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
              <h2 className="font-display text-balance text-2xl font-bold mb-3 tracking-tight">Want the full picture?</h2>
              <p className="text-balance text-muted-foreground mb-6 max-w-md mx-auto">
                Sign up for additional scans, deeper section analysis, AI-assisted drafting, and personalized optimization within the limits shown for your plan.
              </p>
              <div className="flex items-center justify-center gap-4">
                <Button size="lg" asChild className="active:scale-[0.98]">
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
                <Link to="/auth" className="text-primary hover:underline">Log in</Link> for unlimited scans and deeper analysis.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
