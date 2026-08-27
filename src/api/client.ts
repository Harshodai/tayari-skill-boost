export const API_URL = import.meta.env.VITE_API_URL || "/api";
export const USE_SELF_HOSTED = import.meta.env.VITE_USE_SELF_HOSTED === "true";

export function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

export function getHeaders(isFormData = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// ponytail: structured error so callers can branch on status; 401 always clears token + redirects.
export class ApiError extends Error {
  status: number;
  body: Record<string, unknown> | undefined;
  constructor(message: string, status: number, body?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * The Go gateway isn't reachable. In hosted (backend-only) deploys it isn't
 * deployed at all, so pages that call it must say so instead of hanging or
 * throwing an opaque "Failed to fetch" / "Unexpected token '<'".
 */
export class BackendUnavailableError extends ApiError {
  constructor(message = "Advanced features need the local Job Tayari engine, which isn't running in this environment.") {
    super(message, 0);
    this.name = "BackendUnavailableError";
  }
}

export function isBackendUnavailable(error: unknown): boolean {
  return error instanceof BackendUnavailableError;
}

export function handleUnauthorized(): never {
  localStorage.removeItem("auth_token");
  // Only force a global client-side sign-out in self-hosted mode, where the
  // Go gateway issues and owns the user's ONLY session — a 401 there really
  // does mean that session is invalid. In Supabase mode the Go gateway is a
  // secondary API called with a forwarded Supabase token; a 401 from it
  // means that one gateway call failed (e.g. a real deployment's Go/Supabase
  // config drifted, or a specific route needs a scope this token lacks) —
  // not that the user's actual Supabase session is invalid. Supabase's own
  // client (AuthContext's onAuthStateChange) is the sole source of truth for
  // that. Broadcasting auth:unauthorized here used to wipe the entire app's
  // client-side auth state — including direct-Supabase features that never
  // called the Go gateway at all — over a single unrelated 401.
  if (USE_SELF_HOSTED) {
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
  }
  throw new ApiError("Session expired", 401);
}

export async function checkResponse(response: Response): Promise<void> {
  if (response.ok) return;
  if (response.status === 401) handleUnauthorized();
  const error = await response.json().catch(() => ({} as Record<string, unknown>));
  // 5xx gateway errors mean the Go+Python stack is up but degraded (e.g. the
  // gateway maps an unreachable AI engine to 502) — surface it as backend
  // unavailable, not a generic HTTP error.
  if (response.status === 502 || response.status === 503 || response.status === 504) {
    throw new BackendUnavailableError(
      (error && (error.error as string)) || "Advanced features need the local Job Tayari engine, which isn't running in this environment."
    );
  }
  throw new ApiError(
    (error && (error.error as string)) || `HTTP ${response.status}`,
    response.status,
    error
  );
}

export type ApiFetchOptions = RequestInit & {
  asBlob?: boolean;
};

import { PrivacyLedgerEntry } from "./types";

export async function fetchPrivacyLedger(): Promise<{ ledger: PrivacyLedgerEntry[] }> {
  return apiFetch<{ ledger: PrivacyLedgerEntry[] }>("/v1/privacy/ledger");
}

export async function clearPrivacyLedger(): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>("/v1/privacy/clear-ledger", {
    method: "POST",
  });
}

/**
 * Raw fetch against the gateway that does NOT run checkResponse — no global
 * 401 handling, no token clearing. Use for auth endpoints (login/register)
 * where a 401/409 is an expected form error, not an expired session.
 */
export async function apiFetchRaw(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  try {
    return await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...getHeaders(isFormData),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new BackendUnavailableError();
  }
}

export async function apiFetchResponse(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const response = await apiFetchRaw(path, options);
  await checkResponse(response);
  return response;
}


export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { asBlob, ...fetchOptions } = options;
  const response = await apiFetchResponse(path, fetchOptions);
  if (asBlob) {
    return (await response.blob()) as unknown as T;
  }
  if (response.status === 204) {
    return undefined as unknown as T;
  }
  const text = await response.text();
  if (!text || !text.trim()) {
    return undefined as unknown as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    // A 200 that isn't JSON means the SPA fallback answered, i.e. no gateway
    // is mounted at API_URL. Surface that instead of a raw SyntaxError.
    throw new BackendUnavailableError();
  }
}
