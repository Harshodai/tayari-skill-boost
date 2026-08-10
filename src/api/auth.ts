import { apiFetch } from "@/api/client";

export interface AuthRateLimitResponse {
  allowed: boolean;
  remainingAttempts: number;
  blockedUntil: string | null;
}

// ponytail: thin wrapper over apiFetch — no edge-fn invoke, works in both
// self-hosted and hosted since both point @/api at the Go gateway.
export async function getAuthRateLimit(email: string): Promise<AuthRateLimitResponse> {
  return apiFetch<AuthRateLimitResponse>("/v1/auth/rate-limit", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}
