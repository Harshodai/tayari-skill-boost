import { apiFetchResponse } from "@/api";
/**
 * Account management API calls.
 *
 * deleteUserAccount — GDPR Art. 17 right to erasure. Sends DELETE /v1/me to the
 * Go gateway, which cascades the wipe across all user-owned tables and then
 * removes the auth user via Supabase GoTrue Admin.
 *
 * exportUserData — GDPR Art. 20 data portability. Sends GET /v1/me/export and
 * returns a Blob (application/zip) so the caller can trigger a browser download.
 */
import { apiFetch, API_URL, getHeaders, checkResponse, ApiError } from "./client";

export async function deleteUserAccount(): Promise<{ status: string; user_id: string }> {
  return apiFetch<{ status: string; user_id: string }>("/v1/me", { method: "DELETE" });
}

// ponytail: P5a twin DELETE /v1/user/data is data-only. It must NEVER fall
// back to DELETE /v1/me (full-account erasure) — a 404/405 is surfaced as
// unavailable so the UI can tell the user data-only wipe isn't supported
// instead of silently deleting their account.
export async function deleteUserData(): Promise<{ status: string; user_id: string }> {
  try {
    return await apiFetch<{ status: string; user_id: string }>("/v1/user/data", { method: "DELETE" });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 405)) {
      throw new ApiError("Data-only deletion is currently unavailable. Your account was not deleted.", 503);
    }
    throw err;
  }
}

export async function exportUserData(): Promise<Blob> {
  // handleExportAccount returns application/zip; use fetch directly
  // so we get a raw Blob rather than going through apiFetch's JSON decode.
  const response = await apiFetchResponse(`/v1/me/export`, {
    method: "GET",
    headers: getHeaders(),
  });
  await checkResponse(response);
  return response.blob();
}

