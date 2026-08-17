import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { FadeIn, StaggerContainer } from "@/components/ui/motion";
import {
  TrendingUp,
  BarChart3,
  GitBranch,
  Play,
  Plus,
  Loader2,
  Sparkles,
  Award,
  BookOpen,
  ArrowRight,
  TrendingDown,
  Layers
} from "lucide-react";
import {
  listResumes,
  createResumeVariant,
  listResumeVariants,
  getFunnelData,
  getBanditStats,
  Resume,
  ResumeVariant,
  BanditStat
} from "@/api";

const PredictiveAnalytics = () => {
  const { toast } = useToast();

  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>("");
  const [variants, setVariants] = useState<ResumeVariant[]>([]);
  const [banditStats, setBanditStats] = useState<BanditStat[]>([]);
  const [funnel, setFunnel] = useState<Record<string, number>>({
    saved: 0,
    applied: 0,
    interview: 0,
    offer: 0
  });

  // Loading states
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Variant form
  const [variantName, setVariantName] = useState("");
  const [variantText, setVariantText] = useState("");

  const fetchData = async () => {
    try {
      const resumeList = await listResumes();
      setResumes(resumeList);
      if (resumeList.length > 0) {
        setSelectedResumeId(String(resumeList[0].id));
      }
      
      const funnelRes = await getFunnelData();
      setFunnel(funnelRes);

      const banditRes = await getBanditStats();
      setBanditStats(banditRes);
    } catch (err: any) {
      console.error("Failed to load analytics data:", err);
      toast({
        variant: "destructive",
        title: "Error loading analytics",
        description: err.message || "Could not load stats.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch variants when active resume changes
  useEffect(() => {
    if (!selectedResumeId) return;
    const fetchVariants = async () => {
      try {
        const list = await listResumeVariants(selectedResumeId);
        setVariants(list);
      } catch (err: any) {
        console.error("Failed to fetch variants:", err);
      }
    };
    fetchVariants();
  }, [selectedResumeId]);

  const handleCreateVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResumeId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a parent resume first."
      });
      return;
    }
    if (!variantName || !variantText) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please provide a variant name and resume text."
      });
      return;
    }

    setCreating(true);
    try {
      const newVar = await createResumeVariant(selectedResumeId, {
        name: variantName,
        original_text: variantText
      });
      setVariants(prev => [newVar, ...prev]);
      setVariantName("");
      setVariantText("");
      const scoreAvailable = typeof newVar.scores?.overall_score === "number";
      toast({
        title: scoreAvailable ? "Variant created!" : "Variant saved without a score",
        description: scoreAvailable
          ? `Successfully scored and registered variant "${variantName}".`
          : `Variant "${variantName}" was saved, but predictive scoring is currently unavailable.`,
      });
      
      // Refresh bandit statistics
      const stats = await getBanditStats();
      setBanditStats(stats);
    } catch (err: any) {
      console.error("Failed to create variant:", err);
      toast({
        variant: "destructive",
        title: "Creation failed",
        description: err.message || "Failed to save and score variant."
      });
    } finally {
      setCreating(false);
    }
  };

  // Funnel calculations
  const totalApplications = funnel.applied + funnel.interview + funnel.offer;
  const screenRate = totalApplications > 0 ? Math.round(((funnel.interview + funnel.offer) / totalApplications) * 100) : 0;
  const offerRate = totalApplications > 0 ? Math.round((funnel.offer / totalApplications) * 100) : 0;

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-3">
            <Layers className="w-3.5 h-3.5" /> Thompson Sampling Active
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight font-display">
            A/B Resume Funnel & Scorer
          </h1>
          <p className="text-muted-foreground mt-1">
            Perform Thompson Sampling multi-armed bandit A/B testing on resume variants, track conversions, and analyze callback probability scores.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">Aggregating callback and variant statistics...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Funnel & Quick Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Kanban conversion funnel */}
              <Card className="lg:col-span-8 border border-border/40 shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" /> Application Funnel Analytics
                  </CardTitle>
                  <CardDescription>Funnel conversion rates derived from Kanban board movements.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Funnel blocks */}
                  <div className="space-y-4">
                    {[
                      { label: "Saved Jobs", count: funnel.saved, pct: 100, color: "bg-muted" },
                      { label: "Applications Sent (Pulls)", count: totalApplications, pct: 100, color: "bg-primary/80" },
                      { label: "Interviews Booked", count: funnel.interview + funnel.offer, pct: screenRate, color: "bg-accent/80" },
                      { label: "Offers Received (Conversions)", count: funnel.offer, pct: offerRate, color: "bg-success/80" },
                    ].map((stage, i) => (
                      <div key={i} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span>{stage.label}</span>
                          <span className="text-muted-foreground">{stage.count} ({stage.pct}%)</span>
                        </div>
                        <div className="w-full h-3.5 rounded bg-muted/30 overflow-hidden border border-border/30">
                          <div className={`h-full ${stage.color} transition-all duration-700`} style={{ width: `${stage.pct}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Conversion Metrics summary */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                <Card className="border border-border/40 bg-gradient-to-br from-card to-card/95">
                  <CardContent className="p-6 space-y-6">
                    <div>
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Candidate Interview Rate</span>
                      <span className="text-4xl font-black text-foreground mt-1 block">{screenRate}%</span>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ratio of applications moved from Sent to Interviewing.
                      </p>
                    </div>

                    <div className="border-t pt-4">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Final Offer Conversion Rate</span>
                      <span className="text-4xl font-black text-foreground mt-1 block">{offerRate}%</span>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ratio of applications resulting in formal job offers.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* A/B Bandit Variant Tracker */}
            <Card className="border border-border/40 shadow-md">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-primary" /> Active A/B Testing Variant Stats (Thompson Sampling)
                </CardTitle>
                <CardDescription>
                  Pulls and conversion counts representing variant performance. Dynamic bandit selection allocates submissions to top-performing resumes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {banditStats.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic text-center py-6">
                    No active A/B testing variants registered. Create a variant below to start testing.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-border/50 text-left text-muted-foreground uppercase tracking-wider text-xs">
                          <th className="pb-3 font-semibold">Variant Name</th>
                          <th className="pb-3 font-semibold">Resume Source</th>
                          <th className="pb-3 font-semibold text-center">Pulls (Submissions)</th>
                          <th className="pb-3 font-semibold text-center">Conversions (Interviews)</th>
                          <th className="pb-3 font-semibold text-right">Conversion Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {banditStats.map((stat, i) => {
                          const rate = stat.pulls > 0 ? Math.round((stat.conversions / stat.pulls) * 100) : 0;
                          return (
                            <tr key={i} className="border-b border-border/30 hover:bg-muted/10">
                              <td className="py-3 font-bold text-foreground">{stat.name}</td>
                              <td className="py-3 text-muted-foreground">{stat.resume_title}</td>
                              <td className="py-3 text-center font-mono">{stat.pulls}</td>
                              <td className="py-3 text-center font-mono">{stat.conversions}</td>
                              <td className="py-3 text-right font-bold text-primary font-mono">{rate}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Create Variant Form & List */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Creator form */}
              <div className="lg:col-span-5">
                <Card className="glass border-border/40 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Plus className="w-5 h-5 text-primary" /> Create Resume Variant
                    </CardTitle>
                    <CardDescription>
                      Create a slight modification/variant to A/B test against your base resume.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleCreateVariant} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Parent Resume</label>
                        <select
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          value={selectedResumeId}
                          onChange={(e) => setSelectedResumeId(e.target.value)}
                        >
                          {resumes.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.title}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Variant Name</label>
                        <Input
                          placeholder="e.g. Highlights Action Verbs, Cloud Focus"
                          value={variantName}
                          onChange={(e) => setVariantName(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Modified Resume Text</label>
                        <Textarea
                          placeholder="Paste or write the altered resume text here..."
                          rows={8}
                          value={variantText}
                          onChange={(e) => setVariantText(e.target.value)}
                          required
                        />
                      </div>

                      <Button type="submit" className="w-full font-semibold" disabled={creating}>
                        {creating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Scoring & Saving...
                          </>
                        ) : (
                          <>
                            Scoring & Save Variant
                          </>
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              {/* Scored variant list */}
              <div className="lg:col-span-7 space-y-4">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                  Resume Variants list ({variants.length})
                </h3>
                {variants.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No variants mapped for this resume yet.</p>
                ) : (
                  <div className="space-y-4">
                    {variants.map((v) => (
                      <Card key={v.id} className="border border-border/40 shadow-sm overflow-hidden">
                        <CardHeader className="p-4 pb-2 bg-muted/20 border-b border-border/20">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-foreground text-sm">{v.name}</h4>
                            <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 text-xs font-bold">
                              {typeof v.scores?.overall_score === "number"
                                ? `Score: ${v.scores.overall_score}%`
                                : "Score unavailable"}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                          {/* Scoring dimensions */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                            <div className="p-2 border rounded bg-card">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Formatting</span>
                              <div className="text-sm font-bold text-foreground mt-0.5">{typeof v.scores?.formatting_score === "number" ? `${v.scores.formatting_score}%` : "Unavailable"}</div>
                            </div>
                            <div className="p-2 border rounded bg-card">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Metrics</span>
                              <div className="text-sm font-bold text-foreground mt-0.5">{typeof v.scores?.metrics_score === "number" ? `${v.scores.metrics_score}%` : "Unavailable"}</div>
                            </div>
                            <div className="p-2 border rounded bg-card">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Readability</span>
                              <div className="text-sm font-bold text-foreground mt-0.5">{typeof v.scores?.readability_score === "number" ? `${v.scores.readability_score}%` : "Unavailable"}</div>
                            </div>
                            <div className="p-2 border rounded bg-card">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Keywords</span>
                              <div className="text-sm font-bold text-foreground mt-0.5">{typeof v.scores?.keyword_score === "number" ? `${v.scores.keyword_score}%` : "Unavailable"}</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default PredictiveAnalytics;
