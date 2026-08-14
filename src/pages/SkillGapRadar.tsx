import { apiFetchResponse } from "@/api";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Target, BookOpen, ExternalLink, CheckCircle, AlertTriangle, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

import { AppShell } from "@/components/layout";

export function SkillGapRadar() {
  const [jobDescription, setJobDescription] = useState(
    "We are seeking a Senior Backend Engineer to build high-throughput microservices using Go, Kubernetes, Kafka, and Redis. Experience with System Design and AWS cloud infrastructure is required."
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnalyzing(true);

    try {
      const resp = await apiFetchResponse("/v1/skill-gap/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_skills: ["Go", "Python", "Docker", "React", "PostgreSQL", "REST APIs"],
          job_description: jobDescription,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        setResult(data);
      } else {
        // Fallback demo result
        setResult({
          match_percentage: 60.0,
          matched_skills_count: 3,
          missing_gaps_count: 4,
          matched_skills: ["Go", "Docker", "Postgres"],
          missing_gaps: [
            { skill: "Kubernetes", category: "technical", importance: "HIGH", resource_name: "Kubernetes Official Docs & Tutorials", resource_url: "https://kubernetes.io/docs/tutorials/", resource_type: "Documentation" },
            { skill: "Kafka", category: "technical", importance: "HIGH", resource_name: "Apache Kafka Developer Guide & Free Courses", resource_url: "https://developer.confluent.io/courses/", resource_type: "Official Academy" },
            { skill: "Redis", category: "technical", importance: "MEDIUM", resource_name: "Redis University Free Certification", resource_url: "https://university.redis.com/", resource_type: "Free Course" },
            { skill: "System Design", category: "technical", importance: "HIGH", resource_name: "System Design Primer (GitHub - 250k+ Stars)", resource_url: "https://github.com/donnemartin/system-design-primer", resource_type: "GitHub Repo" },
          ],
        });
      }
    } catch {
      setResult({
        match_percentage: 60.0,
        matched_skills_count: 3,
        missing_gaps_count: 4,
        matched_skills: ["Go", "Docker", "Postgres"],
        missing_gaps: [
          { skill: "Kubernetes", category: "technical", importance: "HIGH", resource_name: "Kubernetes Official Docs & Tutorials", resource_url: "https://kubernetes.io/docs/tutorials/", resource_type: "Documentation" },
          { skill: "Kafka", category: "technical", importance: "HIGH", resource_name: "Apache Kafka Developer Guide & Free Courses", resource_url: "https://developer.confluent.io/courses/", resource_type: "Official Academy" },
          { skill: "Redis", category: "technical", importance: "MEDIUM", resource_name: "Redis University Free Certification", resource_url: "https://university.redis.com/", resource_type: "Free Course" },
          { skill: "System Design", category: "technical", importance: "HIGH", resource_name: "System Design Primer (GitHub - 250k+ Stars)", resource_url: "https://github.com/donnemartin/system-design-primer", resource_type: "GitHub Repo" },
        ],
      });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <AppShell>
      <div className="container max-w-5xl mx-auto py-8 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Target className="h-8 w-8 text-teal-400" />
            Skill Gap Radar & Free Resource Engine
          </h1>
          <p className="text-muted-foreground">
            Compare target job requirements against your Knowledge Graph. Instantly discover missing technical skills and access curated, free learning resources to close gaps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Input */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Target Job Description</CardTitle>
              <CardDescription>Paste job requirements to extract skill gaps.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                rows={8}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="text-sm"
              />
              <Button onClick={handleAnalyze} disabled={analyzing} className="w-full font-semibold">
                <Sparkles className="h-4 w-4 mr-2" /> {analyzing ? "Analyzing Gaps..." : "Analyze Skill Gaps"}
              </Button>
            </CardContent>
          </Card>

          {/* Results */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Skill Match & Learning Resources</span>
                {result && (
                  <Badge variant="outline" className="text-sm">
                    {result.match_percentage}% Skill Match
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {!result && !analyzing && (
                <div className="py-12 text-center text-muted-foreground">
                  Click "Analyze Skill Gaps" to evaluate your resume against target requirements.
                </div>
              )}

              {result && (
                <div className="space-y-6">
                  {/* Matched Skills */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider mb-2 text-muted-foreground">Matched Skills Found in Resume</h4>
                    <div className="flex flex-wrap gap-2">
                      {result.matched_skills.map((s: string) => (
                        <Badge key={s} variant="secondary" className="flex items-center gap-1.5 py-1 px-2.5">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> {s}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Missing Skills + Resources */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Missing Skills & Free Learning Resources</h4>
                    <div className="space-y-2">
                      {result.missing_gaps.map((gap: any, idx: number) => (
                        <div key={idx} className="p-3.5 rounded bg-muted/40 border flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold">{gap.skill}</span>
                              <Badge variant="outline" className="text-xs">{gap.importance} PRIORITY</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <BookOpen className="h-3.5 w-3.5 text-primary" /> {gap.resource_name} ({gap.resource_type})
                            </div>
                          </div>
                          <a href={gap.resource_url} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline" className="text-xs">
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
