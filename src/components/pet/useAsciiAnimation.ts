import { useEffect, useRef, useState } from "react";
import { FRAME_TICK_DEFAULT, PET_FRAMES, PET_TICKS, type PetState } from "./petFrames";

/**
 * Frame ticker for the ASCII pet, ported from the Codex CLI's
 * `AsciiAnimation`: one interval per state, index wraps over the state's
 * frames, and the timer resets whenever the state changes so a new mood always
 * starts on frame 0. Honours `prefers-reduced-motion` by freezing on frame 0.
 */
export function useAsciiAnimation(state: PetState): string {
  const [index, setIndex] = useState(0);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
    setIndex(0);

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const frames = PET_FRAMES[state];
    if (frames.length <= 1) return;

    const tick = PET_TICKS[state] ?? FRAME_TICK_DEFAULT;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % frames.length);
    }, tick);
    return () => window.clearInterval(id);
  }, [state]);

  const frames = PET_FRAMES[state];
  return frames[index % frames.length];
}
