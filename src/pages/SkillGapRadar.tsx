import { apiFetchResponse } from "@/api";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Target, BookOpen, ExternalLink, CheckCircle, AlertTriangle, Sparkles, UserCheck, Zap, Layers } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";

import { AppShell } from "@/components/layout";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/api";

const SAMPLE_RADAR_JDS = [
  {
    title: "Staff Frontend Architect",
    skills: ["React", "TypeScript", "Next.js", "Tailwind CSS", "GraphQL"],
    jd: `Role: Staff Frontend Architect
Requirements:
- Deep expertise in React 19, TypeScript, and state machines.
- WebAssembly (Wasm) audio/video processing and Canvas 2D rendering.
- Playwright E2E automation and performance budgeting (Core Web Vitals).
- Experience with GraphQL caching, distributed telemetry, and edge middleware.`,
  },
  {
    title: "Distributed Systems Lead",
    skills: ["Go", "Docker", "PostgreSQL", "Linux", "REST APIs"],
    jd: `Role: Lead Systems Infrastructure Engineer
Requirements:
- Strong backend programming in Go and Rust.
- Multi-region Redis caching, Kafka event streaming, and distributed consensus.
- Kubernetes operator development, Terraform, and eBPF kernel telemetry.
- Zero-downtime database migration tooling with PostgreSQL.`,
  },
];

export function SkillGapRadar() {
  const { user } = useAuth();
  const [jobDescription, setJobDescription] = useState("");
  const [userSkills, setUserSkills] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    async function loadSkills() {
      try {
        const profile = await apiFetch<any>("/v1/profile").catch(() => null);
        if (profile?.skills && Array.isArray(profile.skills) && profile.skills.length > 0) {
          setUserSkills(profile.skills);
        }
      } catch {
        // user profile skills optional
      }
    }
    loadSkills();
  }, []);

  const loadSampleJd = (preset: typeof SAMPLE_RADAR_JDS[0]) => {
    setJobDescription(preset.jd);
    setUserSkills(preset.skills);
    setError(null);
    setResult(null);
    toast({ title: `Loaded ${preset.title}`, description: "Job description and candidate skills populated." });
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobDescription.trim()) {
      setError("Please paste a target job description.");
      return;
    }
    setAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const skillsToSend = userSkills.length > 0 ? userSkills : ["General Technical Skills"];
      const resp = await apiFetchResponse("/v1/skill-gap/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_skills: skillsToSend,
          job_description: jobDescription,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        setResult(data);
      } else {
        const data = await resp.json().catch(() => null);
        setError(data?.detail || "Skill-gap analysis could not be completed.");
      }
    } catch {
      setError("Skill-gap analysis is unavailable. Check your connection and retry.");
      toast({ title: "Analysis unavailable", description: "No fallback analysis was shown." });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <AppShell>
      <div className="container max-w-5xl mx-auto py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3 font-display">
              <Target className="h-8 w-8 text-teal-400" />
              Skill Gap Radar & Free Resource Engine
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Compare target job requirements against your Knowledge Graph. Instantly discover missing technical skills and access curated, free learning resources to close gaps.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_RADAR_JDS.map((preset) => (
              <Button
                key={preset.title}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => loadSampleJd(preset)}
                className="text-xs h-7 font-medium active:scale-[0.98]"
              >
                Sample: {preset.title}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Input */}
          <Card className="md:col-span-1 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" /> Target Job Requirements
              </CardTitle>
              <CardDescription className="text-xs">Paste job description to extract skill gaps.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {userSkills.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-mono text-muted-foreground">Your Profile Skills:</span>
                  <div className="flex flex-wrap gap-1">
                    {userSkills.slice(0, 6).map((s) => (
                      <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {s}
                      </Badge>
                    ))}
                    {userSkills.length > 6 && (
                      <span className="text-[10px] text-muted-foreground">+{userSkills.length - 6} more</span>
                    )}
                  </div>
                </div>
              )}

              <Textarea
                rows={8}
                placeholder="Paste job description requirements..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="text-xs font-mono leading-relaxed"
              />
              <Button onClick={handleAnalyze} disabled={analyzing} className="w-full font-semibold shadow-md active:scale-[0.98]">
                <Sparkles className="h-4 w-4 mr-2" /> {analyzing ? "Analyzing Gaps..." : "Analyze Skill Gaps"}
              </Button>
            </CardContent>
          </Card>

          {/* Results */}
          <Card className="md:col-span-2 shadow-sm">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Skill Match & Learning Resources</span>
                {result && (
                  <Badge variant="outline" className="text-xs font-mono text-teal-400 border-teal-400/30">
                    {result.match_percentage}% Match
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
              {!result && !analyzing && (
                <div className="py-12 text-center text-muted-foreground space-y-4">
                  {error ? (
                    <>
                      <div role="alert" className="text-destructive text-sm">{error}</div>
                      <Button type="button" variant="outline" onClick={() => void handleAnalyze({ preventDefault: () => undefined } as React.FormEvent)}>Retry</Button>
                    </>
                  ) : (
                    <div>Click "Analyze Skill Gaps" to evaluate your resume against target requirements.</div>
                  )}
                </div>
              )}

              {result && (
                <div className="space-y-6">
                  {/* Match Meter */}
                  <div className="p-4 rounded-xl border bg-muted/30 space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span>Requirement Overlap Ratio:</span>
                      <span className="font-mono text-teal-500 font-bold">{result.match_percentage}%</span>
                    </div>
                    <Progress value={result.match_percentage} className="h-2.5" />
                  </div>

                  {/* Matched Skills */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider mb-2 text-muted-foreground font-mono">Matched Skills Found</h4>
                    <div className="flex flex-wrap gap-2">
                      {result.matched_skills.map((s: string) => (
                        <Badge key={s} variant="secondary" className="flex items-center gap-1.5 py-1 px-2.5 text-xs">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> {s}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Missing Skills + Resources */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">Missing Skills & Curated Learning Paths</h4>
                    <div className="space-y-2.5">
                      {result.missing_gaps.map((gap: any, idx: number) => (
                        <div key={idx} className="p-3.5 rounded-xl bg-muted/40 border flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-foreground">{gap.skill}</span>
                              <Badge variant="outline" className="text-[10px] font-mono">{gap.importance} PRIORITY</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" /> {gap.resource_name} ({gap.resource_type})
                            </div>
                          </div>
                          <a href={gap.resource_url} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline" className="text-xs shrink-0 active:scale-[0.98]">
                              Start Learning <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                            </Button>
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

export default SkillGapRadar;
