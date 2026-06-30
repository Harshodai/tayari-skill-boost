import { useEffect, useRef } from "react";

// -------------------------------------------------------------------
// M4 — one-time localStorage → server migration guard.
//
// Per TAYARI_MEMORY_LAYER_DESIGN §6, the memory layer moves client-only
// state to server-backed storage. This hook runs once per browser, guarded
// by the `tayari_migrated_v2` localStorage flag, so server-first code can
// rely on the migration having been acknowledged.
//
// ponytail: no bulk data copy — the only legacy localStorage blob is
// `automation_runs` (ephemeral simulated runs in AutomationContext), which
// is not worth round-tripping to the server. The flag is the contract; add
// a real copy step here if a durable client-only store is introduced later.
// -------------------------------------------------------------------

const MIGRATION_FLAG = "tayari_migrated_v2";

export function useMigrateAutomationRuns(): void {
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    try {
      if (localStorage.getItem(MIGRATION_FLAG)) return;
      // No durable client-only memory store exists today — flag only.
      localStorage.setItem(MIGRATION_FLAG, new Date().toISOString());
    } catch {
      // localStorage may be unavailable (private mode) — non-fatal.
    }
  }, []);
}