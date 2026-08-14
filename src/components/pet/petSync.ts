import { supabase } from "@/integrations/supabase/client";
import type { PetPersistedState } from "./petStorage";

/**
 * Cross-device sync + interaction telemetry for Tay.
 *
 * Local storage stays the source of truth for signed-out visitors; once a user
 * signs in we merge the server copy in (server wins for Look settings, the
 * furthest tour progress and the union of seen topics) and push changes back.
 */

/** Fields worth syncing — visit counters stay device-local. */
export type SyncedPetState = Pick<
  PetPersistedState,
  | "dismissed"
  | "minimized"
  | "renderer"
  | "mood"
  | "skinId"
  | "name"
  | "size"
  | "chatty"
  | "position"
  | "tourStep"
  | "tourDone"
  | "seenTopics"
>;

const SYNCED_KEYS: (keyof SyncedPetState)[] = [
  "dismissed",
  "minimized",
  "renderer",
  "mood",
  "skinId",
  "name",
  "size",
  "chatty",
  "position",
  "tourStep",
  "tourDone",
  "seenTopics",
];

export function pickSynced(state: PetPersistedState): SyncedPetState {
  const out = {} as Record<string, unknown>;
  for (const k of SYNCED_KEYS) out[k] = state[k];
  return out as SyncedPetState;
}

export async function fetchRemotePetState(userId: string): Promise<Partial<SyncedPetState> | null> {
  const { data, error } = await supabase
    .from("pet_preferences")
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data?.state) return null;
  return data.state as Partial<SyncedPetState>;
}

export async function pushRemotePetState(userId: string, state: SyncedPetState): Promise<void> {
  await supabase
    .from("pet_preferences")
    .upsert([{ user_id: userId, state: state as unknown as never }], { onConflict: "user_id" });
}

/** Server copy wins for looks; progress takes the furthest of the two. */
export function mergePetState(local: PetPersistedState, remote: Partial<SyncedPetState>): PetPersistedState {
  return {
    ...local,
    ...remote,
    tourStep: Math.max(local.tourStep, remote.tourStep ?? 0),
    tourDone: Boolean(local.tourDone || remote.tourDone),
    seenTopics: Array.from(new Set([...(local.seenTopics ?? []), ...(remote.seenTopics ?? [])])),
  };
}

export type PetEventName =
  | "pet_opened"
  | "pet_closed"
  | "pet_dismissed"
  | "pet_minimized"
  | "pet_restored"
  | "tab_opened"
  | "tip_shown"
  | "action_clicked"
  | "topic_opened"
  | "question_asked"
  | "tour_step_started"
  | "tour_completed"
  | "look_changed";

/** Fire-and-forget interaction log. Silent no-op when signed out. */
export function trackPetEvent(
  userId: string | undefined,
  event: PetEventName,
  fields: { tab?: string; target?: string; route?: string; metadata?: Record<string, unknown> } = {},
): void {
  if (!userId) return;
  void supabase
    .from("pet_events")
    .insert([
      {
        user_id: userId,
        event,
        tab: fields.tab,
        target: fields.target,
        route: fields.route ?? (typeof window !== "undefined" ? window.location.pathname : undefined),
        metadata: (fields.metadata ?? {}) as unknown as never,
      },
    ])
    .then(undefined, () => undefined);
}

export interface PetEventRow {
  event: string;
  tab: string | null;
  target: string | null;
  route: string | null;
  created_at: string;
}

export async function fetchPetEvents(userId: string, limit = 500): Promise<PetEventRow[]> {
  const { data, error } = await supabase
    .from("pet_events")
    .select("event,tab,target,route,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as PetEventRow[];
}
