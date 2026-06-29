import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { USE_SELF_HOSTED, listAnalysisHistory, getFunnelData } from "@/api";
import type { ResumeAnalysisRecord } from "@/types/resume";

/**
 * Types used by the dashboard data hook.
 */
export interface SavedJob {
  id: string | number;
  title: string;
  company: string;
  location?: string | null;
  url?: string | null;
  saved_at: string;
}

export interface RoadmapItem {
  id: string | number;
  status: string;
  step_key: string;
  // other fields are ignored for the dashboard
}

export interface InterviewSession {
  id: string | number;
  role: string;
  difficulty: string;
  created_at: string;
}

export interface FunnelData {
  saved: number;
  applied: number;
  interview: number;
  offer: number;
}

/**
 * Centralised data fetching for the Dashboard page.
 * Returns the raw query results (or empty arrays on self‑hosted mode) and the userId.
 */
export function useDashboardData(userId?: string) {
  const analysesQuery = useQuery({
    queryKey: ["resume-analyses", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (USE_SELF_HOSTED) {
        const res = await listAnalysisHistory();
        return res.map((item: any) => ({
          id: String(item.id),
          user_id: item.user_id ?? "",
          resume_filename: `Resume #${item.resume_id}`,
          overall_score: item.score ?? 0,
          created_at: item.created_at,
          analysis_data: { overallScore: item.score ?? 0, sections: [], matchedKeywords: [], missingKeywords: [], summaryRecommendation: "" },
          job_title: undefined,
          company_name: undefined,
        })) as ResumeAnalysisRecord[];
      }
      const { data, error } = await supabase.from("resume_analyses").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ResumeAnalysisRecord[];
    },
  });

  const savedJobsQuery = useQuery({
    queryKey: ["saved-jobs", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (USE_SELF_HOSTED) return [] as SavedJob[];
      const { data, error } = await supabase.from("saved_jobs").select("*").order("saved_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const roadmapQuery = useQuery({
    queryKey: ["roadmap-progress", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (USE_SELF_HOSTED) return [] as RoadmapItem[];
      const { data, error } = await supabase.from("roadmap_progress").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const interviewsQuery = useQuery({
    queryKey: ["interview-sessions", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (USE_SELF_HOSTED) return [] as InterviewSession[];
      const { data, error } = await supabase.from("interview_sessions").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const funnelQuery = useQuery({
    queryKey: ["funnel-data", userId],
    enabled: !!userId,
    queryFn: async () => {
      try {
        const data = await getFunnelData();
        return data ?? { saved: 0, applied: 0, interview: 0, offer: 0 };
      } catch {
        return { saved: 0, applied: 0, interview: 0, offer: 0 };
      }
    },
  });

  // ponytail: aggregate load/error across all queries — single loading flag for the page.
  const isLoading =
    analysesQuery.isLoading ||
    savedJobsQuery.isLoading ||
    roadmapQuery.isLoading ||
    interviewsQuery.isLoading ||
    funnelQuery.isLoading;
  const isError =
    analysesQuery.isError ||
    savedJobsQuery.isError ||
    roadmapQuery.isError ||
    interviewsQuery.isError;
  const refetch = () =>
    Promise.all([
      analysesQuery.refetch(),
      savedJobsQuery.refetch(),
      roadmapQuery.refetch(),
      interviewsQuery.refetch(),
      funnelQuery.refetch(),
    ]);

  return {
    analyses: analysesQuery.data ?? [],
    savedJobs: savedJobsQuery.data ?? [],
    roadmap: roadmapQuery.data ?? [],
    interviews: interviewsQuery.data ?? [],
    funnel: funnelQuery.data ?? { saved: 0, applied: 0, interview: 0, offer: 0 },
    isLoading,
    isError,
    refetch,
  };
}
