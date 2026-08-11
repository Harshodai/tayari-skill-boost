import { useState } from "react";
import { AppShell } from "@/components/layout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { USE_SELF_HOSTED } from "@/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, CheckCircle2, HelpCircle, SkipForward } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type AgentQuestion = {
  id: string;
  run_id: string | null;
  job_title: string | null;
  company: string | null;
  field_label: string;
  field_type: string;
  options: unknown;
  answer: string | null;
  status: string;
  created_at: string;
};

/** Options are stored as jsonb; tolerate anything that isn't a string array. */
function readOptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((o): o is string => typeof o === "string");
}

/**
 * WS-05 — the human-answer queue.
 *
 * Every autonomous applier eventually hits a question it cannot honestly
 * answer: visa status, salary expectation, "why do you want to work here".
 * The industry's answer is to guess, which is how people end up with their
 * name on applications containing hallucinated facts. Ours is to stop and ask,
 * and this is where those questions land.
 */
export default function AgentQuestions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const {
    data: questions = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["agent_questions", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<AgentQuestion[]> => {
      if (USE_SELF_HOSTED) return [];
      const { data, error } = await supabase
        .from("agent_questions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AgentQuestion[];
    },
  });

  const respond = useMutation({
    mutationFn: async ({
      id,
      answer,
      status,
    }: {
      id: string;
      answer: string | null;
      status: "answered" | "skipped";
    }) => {
      const { error } = await supabase
        .from("agent_questions")
        .update({
          answer,
          status,
          answered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["agent_questions", user?.id] });
      toast({
        title: variables.status === "answered" ? "Answer saved" : "Question skipped",
        description:
          variables.status === "answered"
            ? "The agent will use this the next time it hits this field."
            : "The agent will leave this field blank and flag the application.",
      });
    },
    onError: (err: unknown) => {
      toast({
        title: "Could not save your answer",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const pending = questions.filter((q) => q.status === "pending");
  const resolved = questions.filter((q) => q.status !== "pending");

  const renderInput = (q: AgentQuestion) => {
    const options = readOptions(q.options);
    const value = drafts[q.id] ?? "";

    if (options.length > 0) {
      return (
        <Select value={value} onValueChange={(v) => setDrafts((d) => ({ ...d, [q.id]: v }))}>
          <SelectTrigger aria-label={q.field_label}>
            <SelectValue placeholder="Choose an answer" />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (q.field_type === "textarea") {
      return (
        <Textarea
          aria-label={q.field_label}
          rows={4}
          value={value}
          placeholder="Your answer, in your own words"
          onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
        />
      );
    }

    return (
      <Input
        aria-label={q.field_label}
        value={value}
        placeholder="Your answer"
        onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
      />
    );
  };

  return (
    <AppShell
      title="Agent questions"
      subtitle="Questions the apply agent refused to guess on. Your answers, never invented ones."
    >
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-10 text-center space-y-3">
            <AlertCircle className="w-8 h-8 mx-auto text-destructive" />
            <p className="text-sm">Couldn't load your question queue.</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : questions.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <HelpCircle className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nothing to answer. When the agent hits a field it can't answer from your profile,
              it stops and asks you here instead of guessing.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                Waiting on you ({pending.length})
              </h2>
              {pending.map((q) => (
                <Card key={q.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{q.field_label}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {[q.job_title, q.company].filter(Boolean).join(" · ") ||
                        "Unattached question"}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {renderInput(q)}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={!drafts[q.id]?.trim() || respond.isPending}
                        onClick={() =>
                          respond.mutate({
                            id: q.id,
                            answer: drafts[q.id].trim(),
                            status: "answered",
                          })
                        }
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1.5" />
                        Save answer
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={respond.isPending}
                        onClick={() =>
                          respond.mutate({ id: q.id, answer: null, status: "skipped" })
                        }
                      >
                        <SkipForward className="w-4 h-4 mr-1.5" />
                        Skip
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>
          )}

          {resolved.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                Answered ({resolved.length})
              </h2>
              {resolved.map((q) => (
                <Card key={q.id} className="opacity-80">
                  <CardContent className="py-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{q.field_label}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {q.answer || "Skipped — left blank"}
                      </p>
                    </div>
                    <Badge variant={q.status === "answered" ? "secondary" : "outline"}>
                      {q.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}
