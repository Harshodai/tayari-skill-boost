import { useMemo } from "react";
import { isBackendUnavailable } from "@/api/client";

/**
 * Detect a BackendUnavailableError (status 0 — Go gateway unreachable, e.g.
 * hosted-Supabase-only deploys) from a @tanstack/react-query error, a mutation
 * error, an Error instance, or null. Returns true only when the wrapped value
 * is exactly a BackendUnavailableError — never a 401, 500, or generic network
 * blip. Usage:
 *
 *   const { error } = useQuery(...);
 *   const backendUnavailable = useBackendUnavailable(error);
 *
 *   const mutation = useMutation(...);
 *   const backendUnavailable = useBackendUnavailable(mutation.error);
 *
 * Note: react-query's `error` is `Error | null`; passing it through unchanged
 * is the supported shape. Also accepts the raw Error thrown inside a queryFn
 * (useful when you want to branch before throwing).
 */
export function useBackendUnavailable(error: unknown): boolean {
  return useMemo(() => isBackendUnavailable(error), [error]);
}