import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Target, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiFetch, listResumes, getResume } from "@/api";

/**
 * K3 — "Skills you're missing" widget.
 * POSTs {job_description, resume_text} to /v1/skill-gaps (Python taxonomy
 * set-difference) and renders the top-N gaps, each linking to the matching
 * CareerRoadmap node. Fetches the user's latest resume itself so the parent
 * only needs to pass the job description (SRP: owns its data).
 */

const SKILL_GAP_ENDPOINT = "/v1/skill-gaps";
const MAX_GAP_DISPLAY = 3; // mirror Python MAX_GAPS

interface SkillGap {
  skill: string;
  directly_required: boolean;
  roadmap_node_id: string;
}
interface SkillGapResult {
  role_skills: string[];
  user_skills: string[];
  gaps: SkillGap[];
  overlap_score: number;
}

interface SkillGapWidgetProps {
  jobDescription: string;
  /** Optional preloaded resume text; if absent the widget fetches the latest. */
  resumeText?: string;
}

export function SkillGapWidget({ jobDescription, resumeText }: SkillGapWidgetProps) {
  const [result, setResult] = useState<SkillGapResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async (resume: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<SkillGapResult>(SKILL_GAP_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job_description: jobDescription, resume_text: resume }),
        });
        if (!cancelled) setResult(data);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Skill-gap analysis failed";
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (!jobDescription) return;
    if (resumeText !== undefined) {
      run(resumeText);
      return;
    }
    // Fetch latest resume text, then analyze. Fallback to "" (all role skills = gaps).
    (async () => {
      try {
        const list = await listResumes();
        if (cancelled || list.length === 0) {
          run("");
          return;
        }
        const latest = await getResume(list[0].id);
        run(latest.original_text || "");
      } catch {
        if (!cancelled) run("");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobDescription, resumeText]);

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Skills you're missing</CardTitle>
        </div>
        {result && (
          <p className="text-xs text-muted-foreground">
            {Math.round(result.overlap_score * 100)}% role coverage
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Analyzing role vs your resume…
          </div>
        )}
        {error && !loading && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        {!loading && !error && result && result.gaps.length === 0 && (
          <p className="text-sm text-muted-foreground">
            <Sparkles className="inline h-3 w-3 mr-1" />
            You already cover the role's core skills.
          </p>
        )}
        {!loading && !error && result?.gaps.map((gap) => (
          <Link
            key={gap.skill}
            to={`/roadmap?node=${encodeURIComponent(gap.roadmap_node_id)}`}
            className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 hover:bg-accent/50 transition-colors group"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              {gap.skill}
              {gap.directly_required ? (
                <Badge variant="secondary" className="text-[10px]">required</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">adjacent</Badge>
              )}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary">
              Roadmap <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        ))}
        {!loading && !error && result && result.gaps.length > MAX_GAP_DISPLAY && (
          <p className="text-xs text-muted-foreground pt-1">
            +{result.gaps.length - MAX_GAP_DISPLAY} more
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default SkillGapWidget;