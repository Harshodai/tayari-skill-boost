import {
  Download, Wand2, Sparkles, CheckCircle2, AlertCircle, Target, Lightbulb, Check,
  GraduationCap, ExternalLink,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { DeepATSResponse, ResumeOptimizationResponse } from "@/api/types";
import { InstructionLedgerCard } from "@/components/resume/InstructionLedgerCard";
import { BulletDiffCard } from "@/components/resume/BulletDiffCard";
import type { CourseRecommendation } from "@/data/courseRecommendations";

export interface OptimizationResultsPanelProps {
  optimizedText: string | null;
  setOptimizedText: (text: string) => void;
  deepScore: DeepATSResponse | null;
  optimizationResult: ResumeOptimizationResponse | null;
  overallScore: number | undefined;
  isOptimizing: boolean;
  isDeepATS: boolean;
  nonInjectableCourses: CourseRecommendation[];
  onExport: () => void;
}

/** Extracted from ResumeResults.tsx (was a single 429-line inline block) — same JSX, unchanged behavior. */
export function OptimizationResultsPanel({
  optimizedText,
  setOptimizedText,
  deepScore,
  optimizationResult,
  overallScore,
  isOptimizing,
  isDeepATS,
  nonInjectableCourses,
  onExport,
}: OptimizationResultsPanelProps) {
  if (!((optimizedText || deepScore) && !isOptimizing && !isDeepATS)) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {optimizedText && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
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
              <Button variant="outline" onClick={onExport}>
                <Download className="w-4 h-4 mr-2" />
                Export DOCX
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {deepScore && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="w-5 h-5 text-primary" />
              Deep ATS Score
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-2">
              <div className="text-4xl font-bold tabular-nums text-foreground">
                {deepScore.score ?? deepScore.ats_score ?? "N/A"}
              </div>
              <p className="text-muted-foreground text-sm mt-1">Overall ATS Fit Score</p>
            </div>
            {deepScore.checks && (
              <div className="space-y-2">
                {Object.entries(deepScore.checks).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between text-sm py-1 border-b border-border/40 last:border-0">
                    <span className="capitalize text-muted-foreground">{key.replace(/_/g, " ")}</span>
                    <Badge variant={val?.passed ? "default" : "destructive"} className="text-xs">
                      {val?.passed ? "Pass" : "Fail"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            {deepScore.recommendations && (
              <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1">
                <p className="font-medium text-foreground">Recommendations:</p>
                {(deepScore.recommendations as string[]).map((r, i) => (
                  <p key={i} className="text-muted-foreground text-xs">• {r}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {optimizationResult && !deepScore && (
        <Card className="flex flex-col h-full border border-border/60 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                AI Tailoring Feedback & Critique
              </CardTitle>
              {optimizationResult.alignment_report?.is_aligned ? (
                <Badge variant="outline" className="bg-success/10 border-success/30 text-success flex items-center gap-1 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  Verified Truthful
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-warning/10 border-warning/30 text-warning flex items-center gap-1 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 text-warning" />
                  Fabrication Alerts
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-4 overflow-y-auto max-h-[500px]">
            {/* Flattened Score & Passes comparison */}
            <div className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
              <div>
                <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">Before</span>
                <span className="text-2xl font-bold tabular-nums text-muted-foreground">{overallScore}%</span>
              </div>
              <div className="text-primary font-bold text-lg">→</div>
              <div>
                <span className="text-[10px] text-primary block font-bold uppercase tracking-wider">Tailored</span>
                <span className="text-2xl font-bold tabular-nums text-primary">{optimizationResult.new_heuristic_score}%</span>
              </div>
              <div className="border-l border-border/60 pl-3">
                <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">Refinement</span>
                <span className="font-semibold text-sm tabular-nums">{optimizationResult.refinement_passes} pass(es)</span>
              </div>
            </div>

            {/* ── Flattened Optimization Summary ──────────────────────────── */}
            {optimizationResult.optimization_summary && (
              <div className="grid grid-cols-2 gap-2.5">
                {/* Semantic similarity */}
                {optimizationResult.optimization_summary.semantic_score_before != null && (
                  <div className="bg-muted/20 rounded-lg p-2.5 space-y-1">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Semantic Match</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                        {optimizationResult.optimization_summary.semantic_score_before}%
                      </span>
                      <span className="text-primary font-bold text-xs">→</span>
                      <span className="text-lg font-bold tabular-nums text-primary">
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
                      <span className="text-[11px] text-muted-foreground leading-tight block">
                        {optimizationResult.semantic_similarity_after.interpretation}
                      </span>
                    )}
                  </div>
                )}

                {/* STAR score */}
                {optimizationResult.optimization_summary.avg_star_score != null && (
                  <div className="bg-muted/20 rounded-lg p-2.5 space-y-1">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">STAR Score</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold tabular-nums text-primary">
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
                    <span className="text-[11px] text-muted-foreground block tabular-nums">
                      {optimizationResult.star_analysis?.bullets_scored ?? 0} bullets scored
                    </span>
                  </div>
                )}

                {/* Buzzwords cleaned */}
                {optimizationResult.optimization_summary.buzzwords_cleaned != null && (
                  <div className="bg-muted/20 rounded-lg p-2.5">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Buzzwords Cleaned</span>
                    <span className="text-2xl font-bold tabular-nums text-success">{optimizationResult.optimization_summary.buzzwords_cleaned}</span>
                  </div>
                )}

                {/* JD keyword coverage */}
                {optimizationResult.keyword_matrix?.hard_skill_coverage != null && (
                  <div className="bg-muted/20 rounded-lg p-2.5">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Hard Skill Coverage</span>
                    <span className={`text-2xl font-bold tabular-nums ${
                      optimizationResult.keyword_matrix.hard_skill_coverage >= 80 ? 'text-success' :
                      optimizationResult.keyword_matrix.hard_skill_coverage >= 50 ? 'text-warning' : 'text-destructive'
                    }`}>{optimizationResult.keyword_matrix.hard_skill_coverage}%</span>
                  </div>
                )}
              </div>
            )}

            {/* ── Flattened STAR Bullet Analysis ───────────────────────────── */}
            {(optimizationResult.star_analysis?.bullets_needing_improvement?.length ?? 0) > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-border/40">
                <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-foreground">
                  <Target className="w-3.5 h-3.5 text-amber-500" />
                  STAR Bullet Analysis
                </h4>
                <div className="space-y-2">
                  {optimizationResult.star_analysis?.bullets_needing_improvement?.slice(0, 4).map((b, idx) => (
                    <div key={idx} className="bg-muted/20 rounded-lg p-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-mono truncate max-w-[220px]">{b.bullet}</span>
                        <Badge variant="outline" className={`ml-1 shrink-0 text-[10px] ${
                          (b.star_score ?? 0) >= 3 ? 'bg-success/10 text-success border-success/20' :
                          (b.star_score ?? 0) >= 2 ? 'bg-warning/10 text-warning border-warning/20' :
                          'bg-destructive/10 text-destructive border-destructive/20'
                        }`}>
                          STAR {b.star_grade}
                        </Badge>
                      </div>
                      {b.suggestion && (
                        <p className="text-muted-foreground leading-relaxed">
                          💡 {b.suggestion}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Flattened JD Keyword Matrix ─────────────────────────────── */}
            {(optimizationResult.keyword_matrix?.hard_skills_matrix?.length ?? 0) > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-border/40">
                <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-foreground">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  JD Keyword Matrix
                </h4>
                <div className="grid grid-cols-1 gap-2.5">
                  {/* Hard Skills */}
                  {(optimizationResult.keyword_matrix?.hard_skills_matrix?.length ?? 0) > 0 && (
                    <div>
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider block mb-1">Hard Skills</span>
                      <div className="flex flex-wrap gap-1">
                        {optimizationResult.keyword_matrix?.hard_skills_matrix?.slice(0, 12).map((item) => (
                          <Badge
                            key={item.keyword}
                            variant="outline"
                            className={`text-[11px] ${
                              item.in_resume
                                ? 'bg-success/10 text-success border-success/30'
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
                  {(optimizationResult.keyword_matrix?.soft_skills_matrix?.length ?? 0) > 0 && (
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Soft Skills</span>
                      <div className="flex flex-wrap gap-1">
                        {optimizationResult.keyword_matrix?.soft_skills_matrix?.slice(0, 8).map((item) => (
                          <Badge
                            key={item.keyword}
                            variant="outline"
                            className={`text-[11px] ${
                              item.in_resume
                                ? 'bg-success/10 text-success border-success/30'
                                : 'bg-warning/10 text-warning border-warning/20'
                            }`}
                          >
                            {item.in_resume ? '✓' : '~'} {item.keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Flattened Keyword Gap Analysis ──── */}
            <div className="space-y-2.5 pt-2 border-t border-border/40">
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-foreground">
                <Target className="w-3.5 h-3.5 text-primary" />
                Keyword Gap Analysis
              </h4>

              {/* Injectable/Added Keywords */}
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-medium block">
                  Keywords Woven In (From Master Resume):
                </span>
                <div className="flex flex-wrap gap-1">
                  {(optimizationResult.injectable_keywords?.length ?? 0) > 0 ? (
                    optimizationResult.injectable_keywords?.map((kw: string) => (
                      <Badge key={kw} variant="secondary" className="bg-success/10 text-success border-success/20 text-[11px]">
                        +{kw}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground italic">No extra injectable keywords found.</span>
                  )}
                </div>
              </div>

              {/* Skill Gaps */}
              <div className="space-y-1 pt-1">
                <span className="text-xs text-muted-foreground font-medium block">
                  Remaining Skill Gaps (Not in master resume):
                </span>
                <div className="flex flex-wrap gap-1">
                  {(optimizationResult.non_injectable_keywords?.length ?? 0) > 0 ? (
                    optimizationResult.non_injectable_keywords?.map((kw: string) => (
                      <Badge key={kw} variant="outline" className="bg-destructive/5 text-destructive border-destructive/20 text-[11px]">
                        {kw}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-success italic">All job keywords matched!</span>
                  )}
                </div>

                {/* Recommended Courses to Bridge This Gap */}
                {nonInjectableCourses.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-border/40">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4 text-primary" />
                        <h5 className="text-xs font-bold uppercase tracking-wider text-foreground">
                          Recommended Courses to Bridge This Gap
                        </h5>
                      </div>
                      <span className="text-[10px] text-muted-foreground">Curated Programs</span>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {nonInjectableCourses.map((course) => (
                        <div
                          key={course.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/30 transition-colors"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-foreground line-clamp-1">{course.title}</span>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">
                                {course.provider}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                                {course.skill}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-1">{course.description}</p>
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                              <span>⏱ {course.duration}</span>
                              <span>⭐ {course.rating} ({course.reviewCount})</span>
                              <span>📊 {course.level}</span>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 text-xs h-7 gap-1 hover:text-primary hover:border-primary/50"
                            asChild
                          >
                            <a
                              href={course.affiliateUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Enroll & Bridge
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
            </div>

            {/* AI Buzzwords */}
            <div className="space-y-2.5 pt-2 border-t border-border/40">
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-foreground">
                <Wand2 className="w-3.5 h-3.5 text-primary" />
                AI Buzzword Cleanup
              </h4>
              {(optimizationResult.removed_ai_phrases?.length ?? 0) > 0 ? (
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {optimizationResult.removed_ai_phrases?.map((item, idx) => (
                    <div key={idx} className="bg-muted/20 rounded p-2 flex items-center justify-between">
                      <span className="line-through text-muted-foreground font-mono text-[11px]">{item.buzzword}</span>
                      <span className="text-primary font-bold text-xs">→</span>
                      <span className="font-semibold text-foreground text-[11px]">{item.replacement || "removed"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground italic">No generic AI buzzwords detected.</span>
              )}
            </div>

            {/* Metric quantification suggestions */}
            <div className="space-y-2.5 pt-2 border-t border-border/40">
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-foreground">
                <Lightbulb className="w-3.5 h-3.5 text-primary" />
                Experience Bullet Recommendations
              </h4>
              {(optimizationResult.metric_suggestions?.length ?? 0) > 0 ? (
                <ul className="space-y-1.5">
                  {optimizationResult.metric_suggestions?.map((sug: string, idx: number) => (
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
      {Boolean(optimizationResult?.instruction_ledger && (optimizationResult.instruction_ledger as any[]).length > 0) && (
        <div className="col-span-1 lg:col-span-2">
          <InstructionLedgerCard entries={optimizationResult?.instruction_ledger as any} />
        </div>
      )}
      {Boolean(optimizationResult?.bullet_diffs && (optimizationResult.bullet_diffs as any[]).length > 0) && (
        <div className="col-span-1 lg:col-span-2">
          <BulletDiffCard diffs={optimizationResult?.bullet_diffs as any} />
        </div>
      )}
    </div>
  );
}
