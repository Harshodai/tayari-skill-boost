import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PetTopic, PetTourStep } from "./petKnowledge";
import { PET_TOUR } from "./petKnowledge";

/**
 * Real progress signals so Tay stops giving generic advice. Everything is read
 * from the user's own rows (RLS-scoped) — no writes, no side effects.
 */
export interface PetProgress {
  loading: boolean;
  signedIn: boolean;
  hasProfile: boolean;
  hasResume: boolean;
  bestScore: number | null;
  savedJobs: number;
  applied: number;
  interviews: number;
}

export const EMPTY_PROGRESS: PetProgress = {
  loading: true,
  signedIn: false,
  hasProfile: false,
  hasResume: false,
  bestScore: null,
  savedJobs: 0,
  applied: 0,
  interviews: 0,
};

export function usePetProgress(userId?: string): PetProgress {
  const [progress, setProgress] = useState<PetProgress>(EMPTY_PROGRESS);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setProgress({ ...EMPTY_PROGRESS, loading: false });
      return;
    }
    (async () => {
      const [profile, analyses, jobs, sessions] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
        supabase.from("resume_analyses").select("overall_score").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
        supabase.from("saved_jobs").select("stage").eq("user_id", userId),
        supabase.from("interview_sessions").select("id").eq("user_id", userId),
      ]);
      if (cancelled) return;
      const scores = (analyses.data ?? []).map((a) => a.overall_score ?? 0);
      const stages = (jobs.data ?? []).map((j) => j.stage as string);
      setProgress({
        loading: false,
        signedIn: true,
        hasProfile: Boolean(profile.data?.full_name),
        hasResume: scores.length > 0,
        bestScore: scores.length ? Math.max(...scores) : null,
        savedJobs: stages.length,
        applied: stages.filter((s) => s !== "saved").length,
        interviews: (sessions.data ?? []).length,
      });
    })().catch(() => {
      if (!cancelled) setProgress({ ...EMPTY_PROGRESS, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return progress;
}

/** The single most useful next move, phrased for the person's actual state. */
export function nextBestStep(p: PetProgress): { text: string; label: string; to: string } {
  if (!p.signedIn) return { text: "Create an account and I'll keep your resume, matches and pipeline in one place.", label: "Get started", to: "/auth" };
  if (!p.hasProfile) return { text: "Tell me the role you're aiming for — one minute, and every score after that gets sharper.", label: "Finish setup", to: "/onboarding" };
  if (!p.hasResume) return { text: "Upload your resume once and I'll reuse it for scoring, tailoring and interview answers.", label: "Upload resume", to: "/resume" };
  if (p.savedJobs === 0) return { text: `Your resume is in (best score ${p.bestScore ?? 0}). Let's find roles that actually fit it.`, label: "Open Smart Search", to: "/jobs" };
  if (p.applied === 0) return { text: `You have ${p.savedJobs} saved role${p.savedJobs === 1 ? "" : "s"}. Run Apply Assist on the strongest one.`, label: "Apply to a saved role", to: "/pipeline" };
  if (p.interviews === 0) return { text: `${p.applied} application${p.applied === 1 ? "" : "s"} out. Time to prep the interview before it lands.`, label: "Prep an interview", to: "/interview/prep" };
  return { text: `${p.applied} applications and ${p.interviews} prep session${p.interviews === 1 ? "" : "s"} in. Keep the pipeline moving.`, label: "Open pipeline", to: "/pipeline" };
}

/** Personalised tips replacing the generic rotation once we know the user. */
export function personalizedTips(p: PetProgress): string[] {
  if (!p.signedIn) return [];
  const tips: string[] = [nextBestStep(p).text];
  if (p.hasResume && p.bestScore !== null && p.bestScore < 70)
    tips.push(`Your best ATS score is ${p.bestScore}. Tailoring to a single job description usually adds 10-15 points.`);
  if (p.savedJobs > 0 && p.applied === 0) tips.push("Saved roles go stale fast — most postings fill within two weeks.");
  if (p.applied > 0) tips.push(`Track every reply on the pipeline board; you have ${p.applied} in flight.`);
  if (p.interviews > 0) tips.push("Reuse your strongest STAR answers across interviews — they're saved in your answer bank.");
  return tips;
}

/** Topic answers get a progress-aware first line. */
export function personalizeTopic(t: PetTopic, p: PetProgress): PetTopic {
  if (!p.signedIn) return t;
  if (t.id === "ats" && p.bestScore !== null)
    return { ...t, answer: `Your best ATS score so far is ${p.bestScore}. ${t.answer}` };
  if (t.id === "pipeline" && p.savedJobs > 0)
    return { ...t, answer: `You have ${p.savedJobs} role${p.savedJobs === 1 ? "" : "s"} on the board right now. ${t.answer}` };
  if (t.id === "start" && p.hasResume)
    return { ...t, answer: "Your resume is already in, so you can skip straight to searching. " + t.answer };
  return t;
}

/** Skip tour steps the user has already completed for real. */
export function personalizedTour(p: PetProgress): PetTourStep[] {
  if (!p.signedIn) return PET_TOUR;
  return PET_TOUR.filter((s) => {
    if (s.id === "tour-profile" && p.hasProfile) return false;
    if (s.id === "tour-resume" && p.hasResume) return false;
    if (s.id === "tour-search" && p.savedJobs > 0) return false;
    if (s.id === "tour-apply" && p.applied > 0) return false;
    return true;
  });
}
