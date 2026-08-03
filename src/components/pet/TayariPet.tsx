import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, ChevronRight, LayoutDashboard, Search, FileText, Sparkles, Terminal, Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useAsciiAnimation } from "./useAsciiAnimation";
import { TayPet3D } from "./TayPet3D";
import { PET_TIPS } from "./petTips";
import type { PetState } from "./petFrames";

const DISMISS_KEY = "tayari_pet_dismissed";
const RENDER_KEY = "tayari_pet_renderer";
const TIP_INTERVAL = 7000;
const IDLE_SLEEP_MS = 45000;

type Renderer = "3d" | "ascii";

interface QuickAction {
  label: string;
  hint: string;
  to: string;
  icon: typeof Search;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Open dashboard", hint: "Your pipeline at a glance", to: "/dashboard", icon: LayoutDashboard },
  { label: "Find matching jobs", hint: "Ranked against your profile", to: "/job-search", icon: Search },
  { label: "Score my resume", hint: "ATS check vs. a job description", to: "/resume-optimizer", icon: FileText },
  { label: "Run Apply Assist", hint: "Save → tailor → cover letter", to: "/applications", icon: Sparkles },
];

export interface TayariPetProps {
  /** Where the pet takes the user when clicked. */
  to?: string;
  className?: string;
}

/**
 * Tay — the Job Tayari companion. Same behavioural rig as the Codex CLI mascot
 * (mood states driven by a frame ticker, idle → sleep, wake on interaction),
 * with a soft dimensional SVG renderer by default and the original ASCII
 * renderer one keypress away.
 */
export function TayariPet({ to = "/dashboard", className }: TayariPetProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  });
  const [renderer, setRenderer] = useState<Renderer>(() => {
    if (typeof window === "undefined") return "3d";
    return window.localStorage.getItem(RENDER_KEY) === "ascii" ? "ascii" : "3d";
  });
  const [tipIndex, setTipIndex] = useState(0);
  const [mood, setMood] = useState<PetState>("wave");
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const lastInteraction = useRef(Date.now());

  const tip = PET_TIPS[tipIndex % PET_TIPS.length];
  const frame = useAsciiAnimation(mood);

  const greeting = useMemo(
    () => (user ? "Welcome back — want me to pick up where you left off?" : tip.text),
    [user, tip.text],
  );

  // Settle from the greeting wave into the tip's own mood.
  useEffect(() => {
    const t = window.setTimeout(() => setMood(tip.mood), 1400);
    return () => window.clearTimeout(t);
  }, [tip.mood]);

  // Rotate the tips (paused while the action panel is open).
  useEffect(() => {
    if (dismissed || leaving || open) return;
    const id = window.setInterval(() => setTipIndex((i) => (i + 1) % PET_TIPS.length), TIP_INTERVAL);
    return () => window.clearInterval(id);
  }, [dismissed, leaving, open]);

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

  const go = useCallback(
    (target: string) => {
      wake();
      setMood("celebrate");
      setLeaving(true);
      window.setTimeout(() => {
        navigate(user ? target : `/auth?next=${encodeURIComponent(target)}`);
      }, 520);
    },
    [navigate, user, wake],
  );

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* storage unavailable — pet simply returns next visit */
    }
  }, []);

  const toggleRenderer = useCallback(() => {
    wake();
    setRenderer((r) => {
      const next: Renderer = r === "3d" ? "ascii" : "3d";
      try {
        window.localStorage.setItem(RENDER_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [wake]);

  // Keyboard rig: Esc closes the panel, "t" summons Tay.
  useEffect(() => {
    if (dismissed) return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      if (e.key === "Escape") return setOpen(false);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === "t") {
        wake();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismissed, wake]);

  if (dismissed) return null;

  return (
    <div
      className={cn(
        "fixed right-4 z-40 flex max-w-[min(24rem,calc(100vw-2rem))] flex-col items-end gap-2",
        "bottom-20 md:bottom-6",
        "animate-in fade-in slide-in-from-bottom-4 duration-500",
        className,
      )}
      onMouseEnter={wake}
    >
      {/* Action panel */}
      {open && (
        <div className="w-72 rounded-2xl border border-border/60 bg-card/90 p-2 shadow-xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2">
          <p className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            What should I do?
          </p>
          <ul className="space-y-0.5">
            {QUICK_ACTIONS.map((a) => (
              <li key={a.to}>
                <button
                  type="button"
                  onClick={() => go(a.to)}
                  onMouseEnter={() => setMood("thinking")}
                  onMouseLeave={() => setMood("idle")}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted"
                >
                  <a.icon className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-foreground">{a.label}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{a.hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-1 flex items-center justify-between border-t border-border/50 px-2 pt-1.5">
            <button
              type="button"
              onClick={toggleRenderer}
              className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {renderer === "3d" ? <Terminal className="h-3 w-3" /> : <Smile className="h-3 w-3" />}
              {renderer === "3d" ? "ASCII mode" : "Soft mode"}
            </button>
            <kbd className="rounded border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">T</kbd>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Speech bubble */}
        <div className="relative hidden flex-1 rounded-2xl border border-border/60 bg-card/80 p-3 pr-8 shadow-lg backdrop-blur-md sm:block">
          <p className="text-xs leading-relaxed text-foreground/90">{open ? greeting : tip.text}</p>
          <button
            type="button"
            onClick={() => {
              wake();
              setTipIndex((i) => (i + 1) % PET_TIPS.length);
            }}
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
            onClick={() => {
              wake();
              setOpen((o) => !o);
            }}
            onDoubleClick={() => go(to)}
            onFocus={wake}
            onMouseEnter={() => setMood("wave")}
            onMouseLeave={() => setMood("idle")}
            aria-expanded={open}
            aria-label={`Tay, your Job Tayari companion. ${tip.text} Open quick actions.`}
            className={cn(
              "group grid place-items-center rounded-3xl border border-border/60 bg-card/70 px-2 pb-1.5 pt-1",
              "shadow-lg backdrop-blur-md transition-all duration-200",
              "hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              leaving && "scale-95 opacity-80",
            )}
          >
            {renderer === "3d" ? (
              <TayPet3D state={mood} size={84} />
            ) : (
              <pre
                aria-hidden
                className="select-none whitespace-pre py-2 font-mono text-[10px] leading-[1.15] text-primary sm:text-[11px]"
              >
                {frame}
              </pre>
            )}
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground transition-colors group-hover:text-primary">
              <LayoutDashboard className="h-3 w-3" />
              Ask Tay
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
    </div>
  );
}
