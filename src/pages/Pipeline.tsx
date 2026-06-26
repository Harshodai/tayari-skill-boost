import { useMemo } from "react";
import { AppShell } from "@/components/layout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { USE_SELF_HOSTED } from "@/api";
import { ApplicationPipeline } from "@/components/pipeline/ApplicationPipeline";
import type { PipelineJob } from "@/components/pipeline/types";
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function Pipeline() {
  const { user } = useAuth();
  const userId = user?.id;

  const { data: savedJobs = [], isLoading } = useQuery({
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

  const jobs = useMemo<PipelineJob[]>(
    () =>
      (savedJobs as any[]).map((j) => ({
        id: String(j.id),
        title: j.title,
        company: j.company,
        location: j.location ?? null,
        url: j.url ?? null,
        stage: "saved",
        savedAt: j.saved_at,
      })),
    [savedJobs]
  );

  return (
    <AppShell title="Pipeline" subtitle="Track every application from saved to offer">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading pipeline…</p>
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
        <ApplicationPipeline jobs={jobs} variant="full" />
      )}
    </AppShell>
  );
}
