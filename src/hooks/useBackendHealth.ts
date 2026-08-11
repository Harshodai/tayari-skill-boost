import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import { useBackendUnavailable } from "@/components/useBackendUnavailable";

/**
 * Probes the Go gateway's /v1/health endpoint once and reports whether the
 * backend is unavailable (status 0, BackendUnavailableError). Use this in any
 * page that depends on Go+Python features. Pages whose primary content works
 * without the backend (e.g. Dashboard, which reads from Supabase) should still
 * render their normal content alongside the banner — the banner is additive.
 *
 * retry: false  — don't hammer a dead gateway three times.
 * staleTime:    60s — a single probe is cached for a minute of navigation.
 * refetchOnWindowFocus: false — a dead backend doesn't come back on tab focus.
 *
 * Returns `{ unavailable: boolean, refetch }` — render
 * <BackendUnavailableBanner /> when `unavailable` is true, and call
 * `refetch()` to re-probe on demand (it rejects when the gateway is still
 * unreachable — use try/catch). Backward compatible: existing consumers
 * destructure only `unavailable`.
 */
export function useBackendHealth(): { unavailable: boolean; refetch: () => Promise<unknown> } {
  const { error, refetch } = useQuery({
    queryKey: ["backend-health"],
    queryFn: () => apiFetch<{ status: string }>("/v1/health"),
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const unavailable = useBackendUnavailable(error);
  // ponytail: refetch must reject when the gateway is still unreachable —
  // the hook doc promises it, and ResumeUpload's retry handler relies on
  // resolve == healthy. throwOnError makes react-query propagate the queryFn
  // error (BackendUnavailableError) through the returned promise instead of
  // swallowing it into the error state.
  const refetchWithThrowOnError = () => refetch({ throwOnError: true });
  return { unavailable, refetch: refetchWithThrowOnError };
}