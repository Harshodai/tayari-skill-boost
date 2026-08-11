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
  constructor(message = "Advanced features need the local Tayari engine, which isn't running in this environment.") {
    super(message, 0);
    this.name = "BackendUnavailableError";
  }
}

export function isBackendUnavailable(error: unknown): boolean {
  return error instanceof BackendUnavailableError;
}

export function handleUnauthorized(): never {
  localStorage.removeItem("auth_token");
  window.dispatchEvent(new CustomEvent("auth:unauthorized"));
  throw new ApiError("Session expired", 401);
}

export async function checkResponse(response: Response): Promise<void> {
  if (response.ok) return;
  if (response.status === 401) handleUnauthorized();
  const error = await response.json().catch(() => ({} as Record<string, unknown>));
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

export async function exportUserData(): Promise<Blob> {
  return apiFetch<Blob>("/v1/user/export-data", { asBlob: true });
}

export async function deleteUserAccount(): Promise<void> {
  return apiFetch<void>("/v1/user/account", { method: "DELETE" });
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { asBlob, ...fetchOptions } = options;
  const isFormData = typeof FormData !== "undefined" && fetchOptions.body instanceof FormData;
  const defaultHeaders = getHeaders(isFormData);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      headers: {
        ...defaultHeaders,
        ...(fetchOptions.headers || {}),
      },
    });
  } catch {
    // Connection refused / DNS failure / offline: the gateway isn't there.
    throw new BackendUnavailableError();
  }

  await checkResponse(response);
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
