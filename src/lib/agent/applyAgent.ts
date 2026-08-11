import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/api";

export type AgentRunStatus =
  | "queued"
  | "running"
  | "awaiting_review"
  | "submitted"
  | "cancelled"
  | "failed";

export interface AgentRun {
  id: string;
  job_title: string | null;
  company: string | null;
  job_url: string | null;
  mode: string;
  status: AgentRunStatus;
  progress: number;
  current_step: string | null;
  outcome: string | null;
  submitted_at: string | null;
  created_at: string;
}

export interface AgentRunStep {
  id: string;
  run_id: string;
  idx: number;
  name: string;
  status: "pending" | "running" | "done" | "failed";
  detail: string | null;
  logs: string | null;
  screenshot_url: string | null;
  created_at: string;
}

export interface ApplicationPacket {
  match_score?: number;
  match_reasons?: string[];
  gaps?: string[];
  screening_answers?: { question: string; answer: string }[];
  cover_note?: string;
  missing_facts?: string[];
  truthfulness_check?: string;
}

export async function startApplyAgent(input: {
  jobTitle: string;
  company?: string;
  jobUrl?: string;
  jobDescription: string;
  resumeText: string;
}): Promise<{ runId: string; packet: ApplicationPacket }> {
  const { data, error } = await supabase.functions.invoke("apply-agent", {
    body: { action: "start", ...input },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as { runId: string; packet: ApplicationPacket };
}

export async function transitionRun(runId: string, action: "submit" | "cancel") {
  const { data, error } = await supabase.functions.invoke("apply-agent", {
    body: { action, runId },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function listAgentRuns(): Promise<AgentRun[]> {
  const { data, error } = await supabase
    .from("agent_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as AgentRun[];
}

export async function getAgentRun(runId: string): Promise<AgentRun | null> {
  const { data, error } = await supabase.from("agent_runs").select("*").eq("id", runId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AgentRun) ?? null;
}

export async function listAgentRunSteps(runId: string): Promise<AgentRunStep[]> {
  const { data, error } = await supabase
    .from("agent_run_steps")
    .select("*")
    .eq("run_id", runId)
    .order("idx", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AgentRunStep[];
}

// WS-03 take-over: pauses the run server-side and enqueues a pending
// question in the human-answer queue, then the caller routes to /questions.
// Goes through the Go gateway (the single front door), not Python.
export async function takeOverRun(
  runId: string,
): Promise<{ ok: boolean; question_id?: string; run_id: string }> {
  return apiFetch<{ ok: boolean; question_id?: string; run_id: string }>(
    `/v1/agent-runs/${runId}/take-over`,
    { method: "POST" },
  );
}
