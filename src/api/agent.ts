import { apiFetch } from "./client";

export interface AgentRuntimeSnapshot {
  model_routing: {
    provider_mode: string;
    default_engine: string;
    tiers: Record<string, {
      available: boolean;
      engine: string;
      reason?: string;
    }>;
    fallback_policy: "explicit_only" | string;
    secrets_exposed: false;
  };
  supported_tiers: string[];
  swarm: {
    enabled: boolean;
    max_specialists: number;
    max_parallel: number;
    per_step_timeout_seconds: number;
    failure_isolation: boolean;
    autonomous_sensitive_actions: false;
  };
  memory: {
    layers: string[];
    owner_scoped: boolean;
    best_effort_degradation: boolean;
    credentials_and_passwords: false;
  };
}

export const getAgentRuntime = () =>
  apiFetch<{ success: boolean; data: AgentRuntimeSnapshot }>("/v1/ai/agent/runtime");
