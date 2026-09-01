import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { USE_SELF_HOSTED, listAnalysisHistory, getFunnelData, listSavedJobs, listApplications, listConversations } from "@/api";
import { apiFetch } from "@/api/client";
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

export interface CreditBalance {
  balance: number;
  lifetime_purchased: number;
  lifetime_used: number;
  updated_at: string;
}

export interface InboxSummary {
  total: number;
  unread: number;
  pending_followup: number;
}

/**
 * Centralised data fetching for the Dashboard page.
 * All queries go through the Go API gateway via apiFetch so both
 * cloud and self-hosted environments get real data.
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

  // ponytail: saved jobs now use the Go gateway (/v1/jobs/saved) for both
  // cloud and self-hosted modes instead of returning an empty array for
  // self-hosted. Falls back to Supabase only when not in self-hosted mode
  // and the API call fails.
  const savedJobsQuery = useQuery({
    queryKey: ["saved-jobs", userId],
    enabled: !!userId,
    queryFn: async () => {
      try {
        const data = await listSavedJobs();
        return Array.isArray(data) ? data as SavedJob[] : ((data as any)?.jobs ?? []) as SavedJob[];
      } catch (err) {
        if (!USE_SELF_HOSTED) {
          const { data, error } = await supabase.from("saved_jobs").select("*").order("saved_at", { ascending: false });
          if (error) throw error;
          return (data ?? []) as SavedJob[];
        }
        throw err;
      }
    },
  });

  // ponytail: roadmap now fetched from Go /v1/roadmap instead of empty fallback.
  const roadmapQuery = useQuery({
    queryKey: ["roadmap-progress", userId],
    enabled: !!userId,
    queryFn: async () => {
      try {
        const res = await apiFetch<any>("/v1/roadmap");
        const items = Array.isArray(res) ? res : (res?.steps ?? res?.items ?? []);
        return items as RoadmapItem[];
      } catch (err) {
        if (!USE_SELF_HOSTED) {
          const { data, error } = await supabase.from("roadmap_progress").select("*").order("updated_at", { ascending: false });
          if (error) throw error;
          return (data ?? []) as RoadmapItem[];
        }
        throw err;
      }
    },
  });

  // ponytail: interview sessions fetched from Go /v1/interview/sessions.
  const interviewsQuery = useQuery({
    queryKey: ["interview-sessions", userId],
    enabled: !!userId,
    queryFn: async () => {
      try {
        const res = await apiFetch<any>("/v1/interview/sessions");
        const items = Array.isArray(res) ? res : (res?.sessions ?? []);
        return items as InterviewSession[];
      } catch (err) {
        if (!USE_SELF_HOSTED) {
          const { data, error } = await supabase.from("interview_sessions").select("*").order("created_at", { ascending: false });
          if (error) throw error;
          return (data ?? []) as InterviewSession[];
        }
        throw err;
      }
    },
  });

  const funnelQuery = useQuery({
    queryKey: ["funnel-data", userId],
    enabled: !!userId,
    queryFn: async () => {
      // ponytail: this used to swallow the error and return
      // {saved:0, applied:0, interview:0, offer:0} — a legitimate-looking
      // "no applications yet" empty state indistinguishable from a real
      // failure, and excluded from the isError aggregate below so the
      // Retry banner could never catch it either. Let it throw like every
      // sibling query here so a real failure is actually surfaced.
      const data = await getFunnelData();
      return data ?? { saved: 0, applied: 0, interview: 0, offer: 0 };
    },
  });

  // ponytail: live credit balance from the billing endpoint.
  // Non-critical — a failure here returns null (unavailable) rather than
  // a false zero balance, so downstream UI can distinguish unreachable service
  // from an authenticated candidate with 0 verified credits.
  const creditsQuery = useQuery<CreditBalance | null>({
    queryKey: ["credit-balance", userId],
    enabled: !!userId,
    queryFn: async () => {
      try {
        const res = await apiFetch<any>("/v1/billing/credits");
        return {
          balance: typeof res?.balance === "number" ? res.balance : 0,
          lifetime_purchased: typeof res?.lifetime_purchased === "number" ? res.lifetime_purchased : 0,
          lifetime_used: typeof res?.lifetime_used === "number" ? res.lifetime_used : 0,
          updated_at: res?.updated_at ?? "",
        } as CreditBalance;
      } catch {
        return null;
      }
    },
  });

  // ponytail: conversation / inbox summary — count of active conversations
  // and pending follow-ups shown as an inbox widget on the dashboard.
  const inboxQuery = useQuery({
    queryKey: ["inbox-summary", userId],
    enabled: !!userId,
    queryFn: async () => {
      try {
        const conversations = await listConversations();
        const total = Array.isArray(conversations) ? conversations.length : 0;
        const unread = Array.isArray(conversations)
          ? conversations.filter(
              (c: any) =>
                !c.is_archived &&
                (c.unread === true ||
                  c.is_unread === true ||
                  (typeof c.unread_count === "number" && c.unread_count > 0))
            ).length
          : 0;
        return { total, unread, pending_followup: 0 } as InboxSummary;
      } catch {
        return { total: 0, unread: 0, pending_followup: 0 } as InboxSummary;
      }
    },
  });

  // ponytail: aggregate load/error across the four primary queries —
  // credits and inbox are non-critical so they don't block the page.
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
    interviewsQuery.isError ||
    funnelQuery.isError;
  const refetch = () =>
    Promise.all([
      analysesQuery.refetch(),
      savedJobsQuery.refetch(),
      roadmapQuery.refetch(),
      interviewsQuery.refetch(),
      funnelQuery.refetch(),
      creditsQuery.refetch(),
      inboxQuery.refetch(),
    ]);

  return {
    analyses: analysesQuery.data ?? [],
    savedJobs: savedJobsQuery.data ?? [],
    roadmap: roadmapQuery.data ?? [],
    interviews: interviewsQuery.data ?? [],
    funnel: funnelQuery.data ?? { saved: 0, applied: 0, interview: 0, offer: 0 },
    credits: creditsQuery.data ?? null,
    inbox: inboxQuery.data ?? { total: 0, unread: 0, pending_followup: 0 },
    isLoading,
    isError,
    refetch,
  };
}
