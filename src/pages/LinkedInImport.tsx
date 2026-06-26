import { useState } from "react";
import { AppShell } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { SlideUp } from "@/components/ui/motion";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/api";
import {
  Linkedin, Loader2, Sparkles, CheckCircle2, XCircle,
  AlertCircle, ArrowRight, FileText, Brain, Target, Star, Lightbulb
} from "lucide-react";

const LinkedInImport = () => {
  const navigate = useNavigate();
  const [profileText, setProfileText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleAnalyze = async () => {
    if (!profileText.trim()) {
      toast.error("Paste your LinkedIn profile content first");
      return;
    }
    setAnalyzing(true);
    try {
      const res = await apiFetch<any>("/linkedin/analyze", {
        method: "POST",
        body: JSON.stringify({ profile_text: profileText }),
      });
      setResult(res);
      toast.success("LinkedIn profile analyzed!");
    } catch (err: any) {
      toast.error(err.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const sectionScore = (name: string) => result?.sections?.[name] || null;

  const scoreColor = (s: number) =>
    s >= 80 ? "text-success" : s >= 60 ? "text-warning" : "text-destructive";

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
            <Linkedin className="w-4 h-4" />
            LinkedIn Profile Import
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight font-display mb-3">
            Analyze Your LinkedIn Profile
          </h1>
          <p className="text-muted-foreground text-sm">
            Paste your LinkedIn profile content to get AI-powered scoring and optimization suggestions for each section.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Linkedin className="w-5 h-5 text-primary" />
                Profile Content
              </CardTitle>
              <CardDescription>
                Navigate to your LinkedIn profile, select all text (Cmd+A), copy, and paste below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={profileText}
                onChange={(e) => setProfileText(e.target.value)}
                placeholder="Paste your full LinkedIn profile text here..."
                className="min-h-[300px] font-mono text-sm"
              />
              <div className="flex items-center gap-3">
                <Button onClick={handleAnalyze} disabled={analyzing || !profileText.trim()} className="flex-1">
                  {analyzing ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  Analyze Profile
                </Button>
                <Button variant="outline" onClick={() => setProfileText("")}>
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {analyzing && (
              <Card>
                <CardContent className="py-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Analyzing your LinkedIn profile...</p>
                </CardContent>
              </Card>
            )}

            {result && (
              <>
                <SlideUp>
                  <Card className="text-center">
                    <CardContent className="py-8">
                      <div className="text-5xl font-bold mb-2" style={{ color: result.overall_score >= 80 ? "#22c55e" : result.overall_score >= 60 ? "#eab308" : "#ef4444" }}>
                        {result.overall_score}
                      </div>
                      <p className="text-muted-foreground text-sm">LinkedIn Profile Score</p>
                      <div className="flex flex-wrap justify-center gap-2 mt-4">
                        {result.missing_elements?.map((e: string, i: number) => (
                          <Badge key={i} variant="secondary" className="bg-destructive/10 text-destructive border-destructive/20">
                            Missing: {e}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </SlideUp>

                <SlideUp delay={0.1}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Target className="w-4 h-4 text-primary" />
                        Section Scores
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {["headline", "about", "experience", "education", "skills"].map((section) => {
                        const s = sectionScore(section);
                        if (!s) return null;
                        return (
                          <div key={section}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium capitalize">{section}</span>
                              <span className={`text-sm font-bold ${scoreColor(s.score)}`}>{s.score}</span>
                            </div>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${s.score}%`,
                                  backgroundColor: s.score >= 80 ? "#22c55e" : s.score >= 60 ? "#eab308" : "#ef4444",
                                }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{s.feedback}</p>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </SlideUp>
              </>
            )}
          </div>
        </div>

        {result && (
          <SlideUp delay={0.2}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-warning" />
                  Key Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.key_recommendations?.map((r: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Star className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-3 mt-6">
                  <Button onClick={() => navigate("/resume")}>
                    <FileText className="w-4 h-4 mr-2" />
                    Create Resume from Profile
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/profile")}>
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Update Profile
                  </Button>
                </div>
              </CardContent>
            </Card>
          </SlideUp>
        )}

        {!result && !analyzing && (
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="py-12 text-center">
              <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
              <h3 className="font-semibold text-foreground mb-1">AI-Powered Profile Analysis</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Paste your LinkedIn profile text above and get scored on headline, about section, experience descriptions, education, and skills — with actionable suggestions for each.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
};

export default LinkedInImport;
