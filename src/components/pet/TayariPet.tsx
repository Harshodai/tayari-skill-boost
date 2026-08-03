import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, ChevronRight, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useAsciiAnimation } from "./useAsciiAnimation";
import { PET_TIPS } from "./petTips";
import type { PetState } from "./petFrames";

const DISMISS_KEY = "tayari_pet_dismissed";
const TIP_INTERVAL = 6000;
const IDLE_SLEEP_MS = 45000;

export interface TayariPetProps {
  /** Where the pet takes the user when clicked. */
  to?: string;
  className?: string;
}

/**
 * Tay — an ASCII companion pet, in the spirit of the Codex CLI's animated TUI
 * mascot. It narrates what Job Tayari can do and, when clicked, walks the user
 * into their dashboard.
 */
export function TayariPet({ to = "/dashboard", className }: TayariPetProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  });
  const [tipIndex, setTipIndex] = useState(0);
  const [mood, setMood] = useState<PetState>("wave");
  const [leaving, setLeaving] = useState(false);
  const lastInteraction = useRef(Date.now());

  const tip = PET_TIPS[tipIndex % PET_TIPS.length];
  const frame = useAsciiAnimation(mood);

  // Settle from the greeting wave into the tip's own mood.
  useEffect(() => {
    const t = window.setTimeout(() => setMood(tip.mood), 1400);
    return () => window.clearTimeout(t);
  }, [tip.mood]);

  // Rotate the tips.
  useEffect(() => {
    if (dismissed || leaving) return;
    const id = window.setInterval(() => {
      setTipIndex((i) => (i + 1) % PET_TIPS.length);
    }, TIP_INTERVAL);
    return () => window.clearInterval(id);
  }, [dismissed, leaving]);

  // Occasional blink, and doze off when the page has been quiet for a while.
  useEffect(() => {
    if (dismissed || leaving) return;
    const id = window.setInterval(() => {
      if (Date.now() - lastInteraction.current > IDLE_SLEEP_MS) {
        setMood("sleep");
        return;
      }
      setMood((m) => (m === "idle" ? "blink" : m));
      window.setTimeout(() => setMood((m) => (m === "blink" ? "idle" : m)), 320);
    }, 5200);
    return () => window.clearInterval(id);
  }, [dismissed, leaving]);

  const wake = useCallback(() => {
    lastInteraction.current = Date.now();
    setMood((m) => (m === "sleep" ? "idle" : m));
  }, []);

  const nextTip = useCallback(() => {
    wake();
    setTipIndex((i) => (i + 1) % PET_TIPS.length);
  }, [wake]);

  const handleGo = useCallback(() => {
    wake();
    setMood("celebrate");
    setLeaving(true);
    window.setTimeout(() => {
      navigate(user ? to : `/auth?next=${encodeURIComponent(to)}`);
    }, 520);
  }, [navigate, to, user, wake]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* storage unavailable — pet simply returns next visit */
    }
  }, []);

  if (dismissed) return null;

  return (
    <div
      className={cn(
        "fixed right-4 z-40 flex max-w-[min(22rem,calc(100vw-2rem))] items-end gap-2",
        "bottom-20 md:bottom-6",
        "animate-in fade-in slide-in-from-bottom-4 duration-500",
        className,
      )}
      onMouseEnter={wake}
    >
      {/* Speech bubble */}
      <div className="relative hidden flex-1 rounded-2xl border border-border/60 bg-card/80 p-3 pr-8 shadow-lg backdrop-blur-md sm:block">
        <p className="text-xs leading-relaxed text-foreground/90">{tip.text}</p>
        <button
          type="button"
          onClick={nextTip}
          aria-label="Next tip"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <span
          aria-hidden
          className="absolute -right-1 bottom-4 h-2.5 w-2.5 rotate-45 border-b border-r border-border/60 bg-card/80"
        />
      </div>

      {/* The pet itself */}
      <div className="relative">
        <button
          type="button"
          onClick={handleGo}
          onFocus={wake}
          onMouseEnter={() => setMood("wave")}
          aria-label={`Tay, your Job Tayari companion. ${tip.text} Open your dashboard.`}
          className={cn(
            "group grid place-items-center rounded-2xl border border-border/60 bg-card/80 px-3 py-2",
            "shadow-lg backdrop-blur-md transition-transform duration-200",
            "hover:-translate-y-1 hover:border-primary/50 focus-visible:outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            leaving && "scale-95",
          )}
        >
          <pre
            aria-hidden
            className="select-none whitespace-pre font-mono text-[10px] leading-[1.15] text-primary sm:text-[11px]"
          >
            {frame}
          </pre>
          <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground transition-colors group-hover:text-primary">
            <LayoutDashboard className="h-3 w-3" />
            Dashboard
          </span>
        </button>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide Tay"
          className="absolute -right-2 -top-2 rounded-full border border-border/60 bg-background p-1 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
