import { useCallback, useEffect, useState } from "react";
import type { PetState } from "./petFrames";

/**
 * Durable state for Tay. Everything the companion learns about a visitor —
 * whether they hid it, which renderer/skin/name they picked, how far through
 * the guided tour they got, which topics they already read — survives a reload
 * so the pet feels like the same character every session.
 */
export const PET_STORAGE_KEY = "tayari_pet_state_v2";

export type PetRenderer = "3d" | "ascii";

/** Which screen corner Tay parks in. */
export type PetPosition = "br" | "bl";

export interface PetSkin {
  id: string;
  label: string;
  /** CSS custom-property overrides applied to the pet subtree. */
  vars: Record<string, string>;
  swatch: string;
}

export const PET_SKINS: PetSkin[] = [
  { id: "signature", label: "Signature", vars: {}, swatch: "hsl(var(--primary))" },
  {
    id: "aurora",
    label: "Aurora",
    vars: { "--primary": "172 68% 44%", "--accent": "199 89% 60%" },
    swatch: "hsl(172 68% 44%)",
  },
  {
    id: "sunset",
    label: "Sunset",
    vars: { "--primary": "18 88% 58%", "--accent": "340 82% 62%" },
    swatch: "hsl(18 88% 58%)",
  },
  {
    id: "violet",
    label: "Violet",
    vars: { "--primary": "263 70% 62%", "--accent": "292 76% 66%" },
    swatch: "hsl(263 70% 62%)",
  },
  {
    id: "graphite",
    label: "Graphite",
    vars: { "--primary": "215 16% 52%", "--accent": "199 30% 66%" },
    swatch: "hsl(215 16% 52%)",
  },
];

export interface PetPersistedState {
  dismissed: boolean;
  renderer: PetRenderer;
  /** Corner of the viewport Tay sits in. */
  position: PetPosition;
  /** Last mood the pet settled into — restored so it "wakes up" as it left. */
  mood: PetState;
  tipIndex: number;
  skinId: string;
  name: string;
  size: number;
  /** Index of the next guided-tour step to show. */
  tourStep: number;
  tourDone: boolean;
  /** Knowledge topics the visitor has already opened. */
  seenTopics: string[];
  /** Chatty vs. quiet: whether the speech bubble rotates tips on its own. */
  chatty: boolean;
  lastSeen: number;
  visits: number;
}

export const DEFAULT_PET_STATE: PetPersistedState = {
  dismissed: false,
  renderer: "3d",
  position: "br",
  mood: "wave",
  tipIndex: 0,
  skinId: "signature",
  name: "Tay",
  size: 84,
  tourStep: 0,
  tourDone: false,
  seenTopics: [],
  chatty: true,
  lastSeen: 0,
  visits: 0,
};

function read(): PetPersistedState {
  if (typeof window === "undefined") return DEFAULT_PET_STATE;
  try {
    const raw = window.localStorage.getItem(PET_STORAGE_KEY);
    if (!raw) {
      // Honour the v1 dismissal flag so returning users aren't re-greeted.
      const legacy = window.localStorage.getItem("tayari_pet_dismissed") === "1";
      const legacyRenderer = window.localStorage.getItem("tayari_pet_renderer");
      return {
        ...DEFAULT_PET_STATE,
        dismissed: legacy,
        renderer: legacyRenderer === "ascii" ? "ascii" : "3d",
      };
    }
    const parsed = JSON.parse(raw) as Partial<PetPersistedState>;
    return { ...DEFAULT_PET_STATE, ...parsed, seenTopics: parsed.seenTopics ?? [] };
  } catch {
    return DEFAULT_PET_STATE;
  }
}

function write(state: PetPersistedState) {
  try {
    window.localStorage.setItem(PET_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage blocked — the pet just forgets between sessions */
  }
}

/** Persisted pet state with a partial-merge setter. */
export function usePetState() {
  const [state, setState] = useState<PetPersistedState>(read);

  // Count the visit once per mount so the greeting can adapt.
  useEffect(() => {
    setState((s) => {
      const next = { ...s, visits: s.visits + 1, lastSeen: Date.now() };
      write(next);
      return next;
    });
  }, []);

  const patch = useCallback((p: Partial<PetPersistedState>) => {
    setState((s) => {
      const next = { ...s, ...p, lastSeen: Date.now() };
      write(next);
      return next;
    });
  }, []);

  /** Functional whole-state update — used when merging the server copy in. */
  const replace = useCallback((fn: (current: PetPersistedState) => PetPersistedState) => {
    setState((s) => {
      const next = fn(s);
      write(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    write(DEFAULT_PET_STATE);
    setState({ ...DEFAULT_PET_STATE, visits: 1 });
  }, []);

  return { state, patch, replace, reset };
}

export function skinFor(id: string): PetSkin {
  return PET_SKINS.find((s) => s.id === id) ?? PET_SKINS[0];
}
