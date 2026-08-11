import { useMemo } from "react";
import { AppShell } from "@/components/layout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { USE_SELF_HOSTED } from "@/api";
import { ApplicationPipeline } from "@/components/pipeline/ApplicationPipeline";
import type { PipelineJob, PipelineStage } from "@/components/pipeline/types";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function Pipeline() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();

  const { data: savedJobs = [], isLoading, error, refetch } = useQuery({
    queryKey: ["saved-jobs", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (USE_SELF_HOSTED) return [];
      const { data, error } = await supabase
        .from("saved_jobs")
        .select("*")
        .order("saved_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Submission proof (WS-02). A saved job only shows an "applied"-style badge
  // when a receipt actually exists, so the board can never claim a submission
  // that never happened.
  const { data: receipts = [] } = useQuery({
    queryKey: ["submission-receipts", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (USE_SELF_HOSTED) return [];
      const { data, error } = await supabase
        .from("submission_receipts")
        .select("job_url,verified,confirmation_number,submitted_at,outcome")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const receiptByUrl = useMemo(() => {
    const map = new Map<string, PipelineJob["receipt"]>();
    for (const r of receipts as any[]) {
      if (!r.job_url || map.has(r.job_url)) continue;
      map.set(r.job_url, {
        verified: !!r.verified,
        failed: r.outcome === "failed",
        confirmationNumber: r.confirmation_number,
        submittedAt: r.submitted_at,
      });
    }
    return map;
  }, [receipts]);

  const stageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: PipelineStage }) => {
      if (USE_SELF_HOSTED) return;
      const { error } = await supabase
        .from("saved_jobs")
        .update({ stage })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-jobs", userId] }),
    onError: (e: any) => toast.error(e?.message || "Could not update stage"),
  });

  const jobs = useMemo<PipelineJob[]>(
    () =>
      (savedJobs as any[]).map((j) => ({
        id: String(j.id),
        title: j.title,
        company: j.company,
        location: j.location ?? null,
        url: j.url ?? null,
        stage: (j.stage as PipelineStage) ?? "saved",
        savedAt: j.saved_at,
        receipt: j.url ? receiptByUrl.get(j.url) : undefined,
      })),
    [savedJobs, receiptByUrl]
  );


  return (
    <AppShell title="Pipeline" subtitle="Track every application from saved to offer">
      {isLoading ? (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[420px] rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-10 text-center space-y-3">
            <AlertCircle className="w-8 h-8 mx-auto text-destructive" />
            <p className="text-sm">Couldn't load your pipeline.</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Briefcase className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-4">
              No saved jobs yet. Save jobs from Smart Search to start tracking them here.
            </p>
            <Button asChild>
              <Link to="/jobs">Open Smart Search</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ApplicationPipeline
          jobs={jobs}
          variant="full"
          onStageChange={(id, stage) => stageMutation.mutate({ id, stage })}
        />
      )}
    </AppShell>
  );
}
