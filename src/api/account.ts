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
import { apiFetch, API_URL, getHeaders, checkResponse } from "./client";

export async function deleteUserAccount(): Promise<{ status: string; user_id: string }> {
  return apiFetch<{ status: string; user_id: string }>("/v1/me", { method: "DELETE" });
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

