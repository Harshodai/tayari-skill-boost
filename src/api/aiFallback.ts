import { supabase } from "@/integrations/supabase/client";
import { isBackendUnavailable } from "./client";

/**
 * Hosted AI fallback.
 *
 * AI features are implemented in the self-hosted Go + Python stack. When that
 * stack isn't reachable (the hosted app, or a laptop without Docker running),
 * we run the same operation on Lovable AI through the `ai-core` function
 * instead of showing a dead end.
 */
export async function invokeAiCore<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("ai-core", { body: payload });
  if (error) {
    // supabase-js wraps non-2xx; surface the function's own message when present.
    const message =
      (data as { error?: string } | null)?.error ??
      error.message ??
      "AI request failed. Please try again.";
    throw new Error(message);
  }
  if (data && typeof data === "object" && "error" in (data as Record<string, unknown>)) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data as T;
}

/**
 * Run the gateway call first; if the gateway isn't deployed or is degraded,
 * transparently run the hosted AI equivalent.
 */
export async function withAiFallback<T>(
  gatewayCall: () => Promise<T>,
  fallbackPayload: Record<string, unknown>,
): Promise<T> {
  try {
    return await gatewayCall();
  } catch (error) {
    if (isBackendUnavailable(error)) {
      return invokeAiCore<T>(fallbackPayload);
    }
    throw error;
  }
}
