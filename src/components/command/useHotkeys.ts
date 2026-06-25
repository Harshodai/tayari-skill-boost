import { useEffect, useRef } from "react";

type HotkeyHandler = (e: KeyboardEvent) => void;

/**
 * Lightweight hotkey hook.
 * - Single keys: "/", "?", "Escape"
 * - Mod combos: "mod+k" (mod = Cmd on mac, Ctrl elsewhere)
 * - Sequences: "g d", "g j" (each token <=200ms apart)
 * Skips when focus is in an input/textarea/contenteditable unless `allowInInput`.
 */
export function useHotkeys(
  bindings: Record<string, HotkeyHandler>,
  options: { allowInInput?: boolean } = {},
) {
  const seqRef = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const inEditable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (target?.isContentEditable ?? false);
      if (inEditable && !options.allowInInput) {
        // still allow mod-combo hotkeys (e.g. cmd+k) in inputs
        if (!(e.metaKey || e.ctrlKey)) return;
      }

      const isMod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      // mod combos
      if (isMod) {
        const combo = `mod+${key}`;
        const h = bindings[combo];
        if (h) {
          e.preventDefault();
          h(e);
          return;
        }
      }

      // single keys (no modifier)
      if (!isMod && !e.altKey) {
        // sequence detection
        const now = Date.now();
        if (seqRef.current && now - seqRef.current.at < 600) {
          const seq = `${seqRef.current.key} ${key}`;
          const h = bindings[seq];
          seqRef.current = null;
          if (h) {
            e.preventDefault();
            h(e);
            return;
          }
        }
        const h = bindings[key];
        if (h) {
          e.preventDefault();
          h(e);
          return;
        }
        // start a sequence on "g"
        if (key === "g") {
          seqRef.current = { key, at: now };
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [bindings, options.allowInInput]);
}
