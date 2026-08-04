import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  X,
  ChevronRight,
  Sparkles,
  Terminal,
  Smile,
  Compass,
  MessageCircleQuestion,
  Palette,
  ArrowRight,
  Check,
  Send,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useAsciiAnimation } from "./useAsciiAnimation";
import { TayPet3D } from "./TayPet3D";
import { PET_TIPS } from "./petTips";
import { PET_SKINS, skinFor, usePetState } from "./petStorage";
import { PET_TOPICS, PET_TOUR, actionsForRoute, type PetTopic } from "./petKnowledge";
import type { PetState } from "./petFrames";

const TIP_INTERVAL = 8000;
const IDLE_SLEEP_MS = 45000;

type Tab = "do" | "ask" | "tour" | "look";

export interface TayariPetProps {
  /** Default destination when the pet itself is double-clicked. */
  to?: string;
  className?: string;
}

/** Very small keyword matcher so free-text questions land on a real answer. */
function matchTopic(query: string): PetTopic | null {
  const q = query.toLowerCase().trim();
  if (!q) return null;
  const words = q.split(/\W+/).filter((w) => w.length > 2);
  let best: { t: PetTopic; score: number } | null = null;
  for (const t of PET_TOPICS) {
    const hay = `${t.question} ${t.answer} ${t.id}`.toLowerCase();
    const score = words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { t, score };
  }
  return best?.t ?? null;
}

/**
 * Tay — the Job Tayari companion. Frame-driven moods (Codex CLI style), a
 * persistent memory of how the visitor likes it, contextual quick actions that
 * map to real routes, a product Q&A it can answer end to end, a resumable
 * guided tour, and skin/name/size customisation.
 */
export function TayariPet({ to = "/dashboard", className }: TayariPetProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { state: saved, patch, reset } = usePetState();

  const [mood, setMood] = useState<PetState>(saved.mood ?? "wave");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("do");
  const [leaving, setLeaving] = useState(false);
  const [tipIndex, setTipIndex] = useState(saved.tipIndex ?? 0);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<PetTopic | null>(null);
  const [miss, setMiss] = useState(false);
  const lastInteraction = useRef(Date.now());

  const skin = skinFor(saved.skinId);
  const tip = PET_TIPS[tipIndex % PET_TIPS.length];
  const frame = useAsciiAnimation(mood);
  const actions = useMemo(() => actionsForRoute(pathname), [pathname]);
  const tourStep = PET_TOUR[Math.min(saved.tourStep, PET_TOUR.length - 1)];

  const greeting = useMemo(() => {
    if (saved.dismissed) return tip.text;
    if (user && saved.visits > 1) return `Welcome back — want to pick up at step ${Math.min(saved.tourStep + 1, PET_TOUR.length)}?`;
    if (user) return "Welcome back — want me to pick up where you left off?";
    return "Ask me anything about Job Tayari, or let me walk you through it.";
  }, [user, saved.dismissed, saved.visits, saved.tourStep, tip.text]);

  // Persist mood + tip position so the next session resumes identically.
  useEffect(() => {
    if (mood === "blink") return;
    patch({ mood });
  }, [mood, patch]);
  useEffect(() => {
    patch({ tipIndex });
  }, [tipIndex, patch]);

  // Rotate tips only when the visitor left Tay chatty and the panel is closed.
  useEffect(() => {
    if (saved.dismissed || leaving || open || !saved.chatty) return;
    const id = window.setInterval(() => setTipIndex((i) => (i + 1) % PET_TIPS.length), TIP_INTERVAL);
    return () => window.clearInterval(id);
  }, [saved.dismissed, saved.chatty, leaving, open]);

  // Blink, and doze off once the page has been quiet.
  useEffect(() => {
    if (saved.dismissed || leaving) return;
    const id = window.setInterval(() => {
      if (Date.now() - lastInteraction.current > IDLE_SLEEP_MS) {
        setMood("sleep");
        return;
      }
      setMood((m) => (m === "idle" ? "blink" : m));
      window.setTimeout(() => setMood((m) => (m === "blink" ? "idle" : m)), 320);
    }, 5200);
    return () => window.clearInterval(id);
  }, [saved.dismissed, leaving]);

  const wake = useCallback(() => {
    lastInteraction.current = Date.now();
    setMood((m) => (m === "sleep" ? "idle" : m));
  }, []);

  const go = useCallback(
    (target: string, needsAuth?: boolean) => {
      wake();
      setMood("celebrate");
      setLeaving(true);
      window.setTimeout(() => {
        setLeaving(false);
        setOpen(false);
        navigate(!user && needsAuth ? `/auth?next=${encodeURIComponent(target)}` : target);
      }, 420);
    },
    [navigate, user, wake],
  );

  const askTopic = useCallback(
    (t: PetTopic) => {
      wake();
      setAnswer(t);
      setMiss(false);
      setMood(t.mood);
      setTab("ask");
      if (!saved.seenTopics.includes(t.id)) patch({ seenTopics: [...saved.seenTopics, t.id] });
    },
    [patch, saved.seenTopics, wake],
  );

  const submitQuery = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setMood("thinking");
      const t = matchTopic(query);
      if (t) {
        askTopic(t);
        setQuery("");
      } else {
        setAnswer(null);
        setMiss(true);
      }
    },
    [askTopic, query],
  );

  const dismiss = useCallback(() => patch({ dismissed: true }), [patch]);

  const toggleRenderer = useCallback(() => {
    wake();
    patch({ renderer: saved.renderer === "3d" ? "ascii" : "3d" });
  }, [patch, saved.renderer, wake]);

  // Keyboard rig: Esc closes, "t" summons Tay (even after a dismissal).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      if (e.key === "Escape") return setOpen(false);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === "t") {
        wake();
        if (saved.dismissed) patch({ dismissed: false });
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [patch, saved.dismissed, wake]);

  if (saved.dismissed) return null;

  const petName = saved.name || "Tay";
  const skinStyle = skin.vars as React.CSSProperties;

  return (
    <div
      className={cn(
        "fixed right-4 z-40 flex max-w-[min(24rem,calc(100vw-2rem))] flex-col items-end gap-2",
        "bottom-20 md:bottom-6",
        "animate-in fade-in slide-in-from-bottom-4 duration-500",
        className,
      )}
      style={skinStyle}
      onMouseEnter={wake}
    >
      {open && (
        <div className="w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2">
          {/* Capability header — say plainly what the companion can do. */}
          <div className="border-b border-border/50 px-3 py-2">
            <p className="text-xs font-semibold text-foreground">{petName}, your Job Tayari guide</p>
            <p className="text-[11px] leading-snug text-muted-foreground">
              I explain the product, answer questions and open the right screen for you.
            </p>
          </div>

          <div className="flex border-b border-border/50 text-[11px]">
            {([
              { id: "do", label: "Do", icon: Sparkles },
              { id: "ask", label: "Ask", icon: MessageCircleQuestion },
              { id: "tour", label: "Tour", icon: Compass },
              { id: "look", label: "Look", icon: Palette },
            ] as const).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  wake();
                  setTab(t.id);
                }}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 py-2 transition-colors",
                  tab === t.id ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <t.icon className="h-3 w-3" />
                {t.label}
              </button>
            ))}
          </div>

          <div className="max-h-[min(22rem,55vh)] overflow-y-auto p-2">
            {tab === "do" && (
              <ul className="space-y-0.5">
                {actions.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => go(a.to, a.auth)}
                      onMouseEnter={() => setMood("thinking")}
                      onMouseLeave={() => setMood("idle")}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted"
                    >
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium text-foreground">{a.label}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{a.hint}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {tab === "ask" && (
              <div className="space-y-2">
                <form onSubmit={submitQuery} className="flex items-center gap-1.5">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={wake}
                    placeholder="Ask about scores, Apply Assist, pricing…"
                    aria-label={`Ask ${petName} about Job Tayari`}
                    className="min-w-0 flex-1 rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs outline-none focus:border-primary/60"
                  />
                  <button
                    type="submit"
                    aria-label="Ask"
                    className="rounded-lg bg-primary p-1.5 text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>

                {answer && (
                  <div className="rounded-xl border border-border/60 bg-muted/40 p-2.5">
                    <p className="text-[11px] font-semibold text-foreground">{answer.question}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{answer.answer}</p>
                    {answer.cta && (
                      <button
                        type="button"
                        onClick={() => go(answer.cta!.to, true)}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                      >
                        {answer.cta.label} <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
                {miss && (
                  <p className="px-1 text-[11px] text-muted-foreground">
                    I don't have a straight answer for that one. Try a question below, or the Help centre.
                  </p>
                )}

                <p className="px-1 pt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Things I can explain
                </p>
                <ul className="space-y-0.5">
                  {PET_TOPICS.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => askTopic(t)}
                        className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] transition-colors hover:bg-muted"
                      >
                        <span className={cn("truncate", saved.seenTopics.includes(t.id) && "text-muted-foreground")}>
                          {t.question}
                        </span>
                        {saved.seenTopics.includes(t.id) ? (
                          <Check className="h-3 w-3 shrink-0 text-primary/70" />
                        ) : (
                          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {tab === "tour" && (
              <div className="space-y-3 p-1">
                <div className="flex items-center gap-1.5">
                  {PET_TOUR.map((s, i) => (
                    <span
                      key={s.id}
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        i < saved.tourStep ? "w-3 bg-primary/50" : i === saved.tourStep ? "w-6 bg-primary" : "w-1.5 bg-border",
                      )}
                    />
                  ))}
                </div>

                {saved.tourDone ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-foreground">You've been through the whole flow.</p>
                    <p className="text-[11px] text-muted-foreground">
                      Everything's still here whenever you want a refresher.
                    </p>
                    <button
                      type="button"
                      onClick={() => patch({ tourStep: 0, tourDone: false })}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                    >
                      <RotateCcw className="h-3 w-3" /> Restart the tour
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-foreground">{tourStep.title}</p>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">{tourStep.body}</p>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setMood(tourStep.mood);
                          go(tourStep.cta.to, true);
                          patch({
                            tourStep: Math.min(saved.tourStep + 1, PET_TOUR.length - 1),
                            tourDone: saved.tourStep >= PET_TOUR.length - 1,
                          });
                        }}
                        className="rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground hover:opacity-90"
                      >
                        {tourStep.cta.label}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          patch({
                            tourStep: Math.min(saved.tourStep + 1, PET_TOUR.length - 1),
                            tourDone: saved.tourStep >= PET_TOUR.length - 1,
                          })
                        }
                        className="text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        {saved.tourStep >= PET_TOUR.length - 1 ? "Finish" : "Skip step"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "look" && (
              <div className="space-y-3 p-1">
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Name</p>
                  <input
                    value={saved.name}
                    maxLength={16}
                    onChange={(e) => patch({ name: e.target.value })}
                    aria-label="Companion name"
                    className="w-full rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs outline-none focus:border-primary/60"
                  />
                </div>

                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Colour</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PET_SKINS.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => patch({ skinId: s.id })}
                        aria-label={s.label}
                        aria-pressed={saved.skinId === s.id}
                        title={s.label}
                        className={cn(
                          "h-6 w-6 rounded-full border transition-transform hover:scale-110",
                          saved.skinId === s.id ? "border-primary ring-2 ring-primary/40" : "border-border/60",
                        )}
                        style={{ background: s.swatch }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Size</p>
                  <input
                    type="range"
                    min={64}
                    max={120}
                    step={4}
                    value={saved.size}
                    onChange={(e) => patch({ size: Number(e.target.value) })}
                    aria-label="Companion size"
                    className="w-full accent-primary"
                  />
                </div>

                <label className="flex items-center justify-between text-[11px] text-muted-foreground">
                  Rotate tips on its own
                  <input
                    type="checkbox"
                    checked={saved.chatty}
                    onChange={(e) => patch({ chatty: e.target.checked })}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                </label>

                <div className="flex items-center justify-between border-t border-border/50 pt-2">
                  <button
                    type="button"
                    onClick={toggleRenderer}
                    className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {saved.renderer === "3d" ? <Terminal className="h-3 w-3" /> : <Smile className="h-3 w-3" />}
                    {saved.renderer === "3d" ? "ASCII mode" : "Soft mode"}
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-3 w-3" /> Reset
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border/50 px-3 py-1.5">
            <span className="text-[10px] text-muted-foreground">Press T anytime</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
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
            onDoubleClick={() => go(to, true)}
            onFocus={wake}
            onMouseEnter={() => setMood("wave")}
            onMouseLeave={() => setMood("idle")}
            aria-expanded={open}
            aria-label={`${petName}, your Job Tayari companion. ${tip.text} Open quick actions.`}
            className={cn(
              "group grid place-items-center rounded-3xl border border-border/60 bg-card/70 px-2 pb-1.5 pt-1",
              "shadow-lg backdrop-blur-md transition-all duration-200",
              "hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              leaving && "scale-95 opacity-80",
            )}
          >
            {saved.renderer === "3d" ? (
              <TayPet3D state={mood} size={saved.size} />
            ) : (
              <pre
                aria-hidden
                className="select-none whitespace-pre py-2 font-mono text-[10px] leading-[1.15] text-primary sm:text-[11px]"
              >
                {frame}
              </pre>
            )}
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground transition-colors group-hover:text-primary">
              <Sparkles className="h-3 w-3" />
              Ask {petName}
            </span>
          </button>

          <button
            type="button"
            onClick={dismiss}
            aria-label={`Hide ${petName}`}
            className="absolute -right-2 -top-2 rounded-full border border-border/60 bg-background p-1 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
