import { apiFetch } from "@/api";

// ponytail: all Supabase Edge Function calls and direct supabase.from("agent_runs")
// queries have been replaced with Go API Gateway calls via apiFetch so the Apply
// Agent runs correctly in self-hosted environments (Go → Python AI worker →
// PostgreSQL agent_runs / agent_run_steps tables).

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

// ponytail: formerly supabase.functions.invoke("apply-agent", { body: { action: "start", ... } }).
// Now routes through the Go gateway → Python AI engine → PostgreSQL agent_runs row.
export async function startApplyAgent(input: {
  jobTitle: string;
  company?: string;
  jobUrl?: string;
  jobDescription: string;
  resumeText: string;
}): Promise<{ runId: string; packet: ApplicationPacket }> {
  const res = await apiFetch<{ run_id?: string; runId?: string; packet?: ApplicationPacket; [key: string]: unknown }>(
    "/v1/ai/agent/career/apply",
    {
      method: "POST",
      body: JSON.stringify({
        job_title: input.jobTitle,
        company: input.company ?? "",
        job_url: input.jobUrl ?? "",
        job_description: input.jobDescription,
        resume_text: input.resumeText,
      }),
    }
  );
  const runId = (res.runId ?? res.run_id ?? "") as string;
  if (!runId) throw new Error("Agent returned no run_id");
  return { runId, packet: (res.packet ?? {}) as ApplicationPacket };
}

// ponytail: formerly supabase.functions.invoke("apply-agent", { body: { action, runId } }).
export async function transitionRun(runId: string, action: "submit" | "cancel") {
  return apiFetch<{ status: string }>(`/v1/agent-runs/${encodeURIComponent(runId)}/transition`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

// ponytail: formerly supabase.from("agent_runs").select("*").order().limit().
export async function listAgentRuns(): Promise<AgentRun[]> {
  const res = await apiFetch<AgentRun[] | { runs: AgentRun[] }>("/v1/agent-runs");
  return Array.isArray(res) ? res : ((res as any)?.runs ?? []);
}

// ponytail: formerly supabase.from("agent_runs").select("*").eq("id", runId).maybeSingle().
export async function getAgentRun(runId: string): Promise<AgentRun | null> {
  try {
    return await apiFetch<AgentRun>(`/v1/agent-runs/${encodeURIComponent(runId)}`);
  } catch {
    return null;
  }
}

// ponytail: formerly supabase.from("agent_run_steps").select("*").eq("run_id", runId).order("idx").
export async function listAgentRunSteps(runId: string): Promise<AgentRunStep[]> {
  const res = await apiFetch<AgentRunStep[] | { steps: AgentRunStep[] }>(
    `/v1/agent-runs/${encodeURIComponent(runId)}/steps`
  );
  return Array.isArray(res) ? res : ((res as any)?.steps ?? []);
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
