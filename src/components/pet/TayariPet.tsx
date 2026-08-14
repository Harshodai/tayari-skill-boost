import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Minimize2,
  Maximize2,
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
  MoveHorizontal,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useAsciiAnimation } from "./useAsciiAnimation";
import { TayPet3D } from "./TayPet3D";
import { TayPetMark } from "./TayPetMark";
import { PET_TIPS } from "./petTips";
import { PET_SKINS, skinFor, usePetState } from "./petStorage";
import { PET_TOPICS, actionsForRoute, type PetTopic } from "./petKnowledge";
import {
  usePetProgress,
  personalizedTips,
  personalizedTour,
  personalizeTopic,
  nextBestStep,
} from "./petProgress";
import { fetchRemotePetState, pushRemotePetState, mergePetState, pickSynced, trackPetEvent } from "./petSync";
import type { PetState } from "./petFrames";

const TIP_INTERVAL = 8000;
const IDLE_SLEEP_MS = 45000;
const GREET_MS = 4200;

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

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Tay — the Job Tayari companion. Frame-driven moods, memory that follows the
 * user across devices, progress-aware guidance, full keyboard/screen-reader
 * support and an interaction log feeding /companion-insights.
 */
export function TayariPet({ to = "/dashboard", className }: TayariPetProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { state: saved, patch, reset, replace } = usePetState();
  const progress = usePetProgress(user?.id);

  const [mood, setMood] = useState<PetState>("wave");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("do");
  const [leaving, setLeaving] = useState(false);
  const [tipIndex, setTipIndex] = useState(saved.tipIndex ?? 0);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<PetTopic | null>(null);
  const [miss, setMiss] = useState(false);
  const [greeting, setGreeting] = useState(true);
  const lastInteraction = useRef(Date.now());
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const syncedOnce = useRef(false);

  const skin = skinFor(saved.skinId);
  const frame = useAsciiAnimation(mood);
  const actions = useMemo(() => actionsForRoute(pathname), [pathname]);
  const tour = useMemo(() => personalizedTour(progress), [progress]);
  const tourStep = tour[Math.min(saved.tourStep, Math.max(tour.length - 1, 0))];
  const nextStep = useMemo(() => nextBestStep(progress), [progress]);

  // Personalised lines first, generic product tips after.
  const tips = useMemo(() => {
    const custom = personalizedTips(progress);
    return custom.length ? [...custom, ...PET_TIPS.map((t) => t.text)] : PET_TIPS.map((t) => t.text);
  }, [progress]);
  const tipText = tips[tipIndex % tips.length];

  const helloLine = useMemo(() => {
    const name = saved.name || "Tay";
    if (!user) return `${timeGreeting()} — I'm ${name}. Ask me anything about Job Tayari.`;
    if (saved.visits > 1) return `${timeGreeting()}, welcome back. ${nextStep.text}`;
    return `${timeGreeting()} — I'm ${name}, your guide. ${nextStep.text}`;
  }, [saved.name, saved.visits, user, nextStep.text]);

  const bubbleText = greeting ? helloLine : open ? nextStep.text : tipText;

  const track = useCallback(
    (event: Parameters<typeof trackPetEvent>[1], fields?: Parameters<typeof trackPetEvent>[2]) =>
      trackPetEvent(user?.id, event, { route: pathname, ...fields }),
    [user?.id, pathname],
  );

  /* ---------------- cross-device sync ---------------- */
  useEffect(() => {
    if (!user?.id || syncedOnce.current) return;
    syncedOnce.current = true;
    fetchRemotePetState(user.id).then((remote) => {
      if (remote) replace((local) => mergePetState(local, remote));
    });
  }, [user?.id, replace]);

  useEffect(() => {
    if (!user?.id || !syncedOnce.current) return;
    const id = window.setTimeout(() => void pushRemotePetState(user.id, pickSynced(saved)), 800);
    return () => window.clearTimeout(id);
  }, [user?.id, saved]);

  /* ---------------- greeting wave ---------------- */
  useEffect(() => {
    if (saved.minimized) return;
    setMood("wave");
    const id = window.setTimeout(() => {
      setGreeting(false);
      setMood("idle");
    }, GREET_MS);
    return () => window.clearTimeout(id);
  }, [saved.minimized]);

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
    if (saved.minimized || leaving || open || greeting || !saved.chatty) return;
    const id = window.setInterval(() => {
      setTipIndex((i) => (i + 1) % tips.length);
      track("tip_shown");
    }, TIP_INTERVAL);
    return () => window.clearInterval(id);
  }, [saved.minimized, saved.chatty, leaving, open, greeting, tips.length, track]);

  // Blink, and doze off once the page has been quiet.
  useEffect(() => {
    if (saved.minimized || leaving) return;
    const id = window.setInterval(() => {
      if (Date.now() - lastInteraction.current > IDLE_SLEEP_MS) {
        setMood("sleep");
        return;
      }
      setMood((m) => (m === "idle" ? "blink" : m));
      window.setTimeout(() => setMood((m) => (m === "blink" ? "idle" : m)), 320);
    }, 5200);
    return () => window.clearInterval(id);
  }, [saved.minimized, leaving]);

  // Small, periodic movement keeps Tay feeling alive without stealing focus.
  useEffect(() => {
    if (saved.minimized || leaving || open || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      setMood("wave");
      window.setTimeout(() => setMood((current) => current === "wave" ? "idle" : current), 900);
    }, 15000);
    return () => window.clearInterval(id);
  }, [saved.minimized, leaving, open]);

  const wake = useCallback(() => {
    lastInteraction.current = Date.now();
    setMood((m) => (m === "sleep" ? "idle" : m));
  }, []);

  const openPanel = useCallback(
    (next: boolean) => {
      wake();
      setGreeting(false);
      setOpen(next);
      track(next ? "pet_opened" : "pet_closed");
    },
    [track, wake],
  );

  const go = useCallback(
    (target: string, needsAuth?: boolean, label?: string) => {
      wake();
      track("action_clicked", { target: label ?? target, tab });
      setMood("celebrate");
      setLeaving(true);
      window.setTimeout(() => {
        setLeaving(false);
        setOpen(false);
        navigate(!user && needsAuth ? `/auth?next=${encodeURIComponent(target)}` : target);
      }, 420);
    },
    [navigate, user, wake, track, tab],
  );

  const askTopic = useCallback(
    (t: PetTopic) => {
      wake();
      setAnswer(personalizeTopic(t, progress));
      setMiss(false);
      setMood(t.mood);
      setTab("ask");
      track("topic_opened", { target: t.id, tab: "ask" });
      if (!saved.seenTopics.includes(t.id)) patch({ seenTopics: [...saved.seenTopics, t.id] });
    },
    [patch, saved.seenTopics, wake, progress, track],
  );

  const submitQuery = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setMood("thinking");
      const t = matchTopic(query);
      track("question_asked", { target: query.slice(0, 80), tab: "ask" });
      if (t) {
        askTopic(t);
        setQuery("");
      } else {
        setAnswer(null);
        setMiss(true);
      }
    },
    [askTopic, query, track],
  );

  const minimize = useCallback(() => {
    wake();
    setOpen(false);
    patch({ dismissed: false, minimized: true, mood: "idle" });
    track("pet_minimized");
  }, [patch, track, wake]);
  const restore = useCallback(() => {
    wake();
    patch({ dismissed: false, minimized: false, mood: "wave" });
    track("pet_restored");
  }, [patch, track, wake]);

  const toggleRenderer = useCallback(() => {
    wake();
    track("look_changed", { target: "renderer", tab: "look" });
    patch({ renderer: saved.renderer === "3d" ? "ascii" : "3d" });
  }, [patch, saved.renderer, wake, track]);

  const advanceTour = useCallback(() => {
    const done = saved.tourStep >= tour.length - 1;
    patch({ tourStep: Math.min(saved.tourStep + 1, Math.max(tour.length - 1, 0)), tourDone: done });
    track(done ? "tour_completed" : "tour_step_started", { target: tourStep?.id, tab: "tour" });
  }, [patch, saved.tourStep, tour.length, track, tourStep?.id]);

  // Keyboard rig: Esc closes the panel and returns focus, "t" summons Tay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      if (e.key === "Escape") {
        if (open) {
          setOpen(false);
          triggerRef.current?.focus();
        }
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === "t") {
        wake();
        if (saved.minimized) patch({ dismissed: false, minimized: false, mood: "wave" });
        setOpen((o) => {
          trackPetEvent(user?.id, o ? "pet_closed" : "pet_opened", { route: pathname });
          return !o;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [patch, saved.minimized, wake, open, user?.id, pathname]);

  // Move focus into the panel when it opens (dialog semantics).
  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLElement>("button, input, [tabindex]:not([tabindex='-1'])");
    first?.focus();
  }, [open, tab]);

  // Simple focus loop so keyboard users can't tab out behind the panel.
  const onPanelKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const nodes = panelRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])",
    );
    if (!nodes || nodes.length === 0) return;
    const list = Array.from(nodes);
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);


  const petName = saved.name || "Tay";
  const skinStyle = skin.vars as React.CSSProperties;
  const left = saved.position === "bl";
  if (saved.minimized) {
    return (
      <div
        className={cn(
          "fixed z-40 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-8",
          left ? "left-3 md:left-6" : "right-3 md:right-6",
          className,
        )}
        style={skinStyle}
        role="complementary"
      >
        <button
          type="button"
          onClick={restore}
          onMouseEnter={() => setMood("wave")}
          onFocus={wake}
          aria-label={`Restore ${petName}`}
          className="group flex items-center gap-2 rounded-2xl border border-primary/30 bg-card/90 px-2 py-2 text-left shadow-xl shadow-primary/10 backdrop-blur-md transition-all duration-200 hover:-translate-y-1 hover:border-primary/70 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <TayPetMark state={mood} size={48} />
          <span className="hidden pr-2 sm:block"><span className="block text-xs font-semibold text-foreground">{petName}</span><span className="block text-[10px] text-muted-foreground">Open companion</span></span>
          <Maximize2 className="mr-1 h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed z-40 flex max-w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-2",
        left ? "left-3 items-start md:left-6" : "right-3 items-end md:right-6",
        // clears the mobile tab bar and safe-area inset
        "bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-8",
        "animate-in fade-in slide-in-from-bottom-4 duration-500",
        className,
      )}
      style={skinStyle}
      onMouseEnter={wake}
      role="complementary"
      aria-label={`${petName}, Job Tayari companion`}
    >
      {/* Screen-reader announcements for mood + tip changes. */}
      <span aria-live="polite" aria-atomic="true" className="sr-only">
        {`${petName} is ${mood === "blink" ? "idle" : mood}. ${bubbleText}`}
      </span>

      {open && (
        <div
          ref={panelRef}
          onKeyDown={onPanelKeyDown}
          role="dialog"
          aria-modal="false"
          aria-label={`${petName} companion panel`}
          className="w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2"
        >
          <div className="border-b border-border/50 px-3 py-2">
            <h2 className="text-xs font-semibold text-foreground">{petName}, your Job Tayari guide</h2>
            <p className="text-[11px] leading-snug text-muted-foreground">
              I explain the product, answer questions and open the right screen for you.
            </p>
          </div>

          <div role="tablist" aria-label="Companion sections" className="flex border-b border-border/50 text-[11px]">
            {([
              { id: "do", label: "Do", icon: Sparkles },
              { id: "ask", label: "Ask", icon: MessageCircleQuestion },
              { id: "tour", label: "Tour", icon: Compass },
              { id: "look", label: "Look", icon: Palette },
            ] as const).map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`pet-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`pet-panel-${t.id}`}
                onClick={() => {
                  wake();
                  setTab(t.id);
                  track("tab_opened", { tab: t.id });
                }}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  tab === t.id ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <t.icon className="h-3 w-3" aria-hidden />
                {t.label}
              </button>
            ))}
          </div>

          <div
            className="max-h-[min(22rem,55vh)] overflow-y-auto p-2"
            role="tabpanel"
            id={`pet-panel-${tab}`}
            aria-labelledby={`pet-tab-${tab}`}
          >
            {tab === "do" && (
              <div className="space-y-2">
                {/* Progress-aware next best step, ahead of the generic list. */}
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-primary">Your next step</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-foreground">{nextStep.text}</p>
                  <button
                    type="button"
                    onClick={() => go(nextStep.to, true, nextStep.label)}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground hover:opacity-90"
                  >
                    {nextStep.label} <ChevronRight className="h-3 w-3" aria-hidden />
                  </button>
                </div>

                <ul className="space-y-0.5">
                  {actions.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => go(a.to, a.auth, a.id)}
                        onMouseEnter={() => setMood("thinking")}
                        onMouseLeave={() => setMood("idle")}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium text-foreground">{a.label}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{a.hint}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>

                {user && (
                  <button
                    type="button"
                    onClick={() => go("/companion-insights", true, "insights")}
                    className="inline-flex items-center gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <BarChart3 className="h-3 w-3" aria-hidden /> How I'm helping you
                  </button>
                )}
              </div>
            )}

            {tab === "ask" && (
              <div className="space-y-2">
                <form onSubmit={submitQuery} className="flex items-center gap-1.5">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={wake}
                    placeholder="Ask about scores, AutoPilot, pricing…"
                    aria-label={`Ask ${petName} about Job Tayari`}
                    className="min-w-0 flex-1 rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs outline-none focus:border-primary/60"
                  />
                  <button
                    type="submit"
                    aria-label="Send question"
                    className="rounded-lg bg-primary p-1.5 text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    <Send className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </form>

                {answer && (
                  <div className="rounded-xl border border-border/60 bg-muted/40 p-2.5">
                    <p className="text-[11px] font-semibold text-foreground">{answer.question}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{answer.answer}</p>
                    {answer.cta && (
                      <button
                        type="button"
                        onClick={() => go(answer.cta!.to, true, answer.cta!.label)}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                      >
                        {answer.cta.label} <ChevronRight className="h-3 w-3" aria-hidden />
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
                        className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className={cn("truncate", saved.seenTopics.includes(t.id) && "text-muted-foreground")}>
                          {t.question}
                        </span>
                        {saved.seenTopics.includes(t.id) ? (
                          <Check className="h-3 w-3 shrink-0 text-primary/70" aria-hidden />
                        ) : (
                          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {tab === "tour" && (
              <div className="space-y-3 p-1">
                <div
                  className="flex items-center gap-1.5"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={tour.length}
                  aria-valuenow={saved.tourDone ? tour.length : saved.tourStep}
                  aria-label="Tour progress"
                >
                  {tour.map((s, i) => (
                    <span
                      key={s.id}
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        i < saved.tourStep ? "w-3 bg-primary/50" : i === saved.tourStep ? "w-6 bg-primary" : "w-1.5 bg-border",
                      )}
                    />
                  ))}
                </div>

                {saved.tourDone || !tourStep ? (
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
                      <RotateCcw className="h-3 w-3" aria-hidden /> Restart the tour
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
                          go(tourStep.cta.to, true, tourStep.id);
                          advanceTour();
                        }}
                        className="rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground hover:opacity-90"
                      >
                        {tourStep.cta.label}
                      </button>
                      <button
                        type="button"
                        onClick={advanceTour}
                        className="text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        {saved.tourStep >= tour.length - 1 ? "Finish" : "Skip step"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "look" && (
              <div className="space-y-3 p-1">
                <div>
                  <label htmlFor="pet-name" className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
                    Name
                  </label>
                  <input
                    id="pet-name"
                    value={saved.name}
                    maxLength={16}
                    onChange={(e) => patch({ name: e.target.value })}
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
                        onClick={() => {
                          patch({ skinId: s.id });
                          track("look_changed", { target: s.id, tab: "look" });
                        }}
                        aria-label={`${s.label} colour`}
                        aria-pressed={saved.skinId === s.id}
                        title={s.label}
                        className={cn(
                          "h-6 w-6 rounded-full border transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          saved.skinId === s.id ? "border-primary ring-2 ring-primary/40" : "border-border/60",
                        )}
                        style={{ background: s.swatch }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="pet-size" className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
                    Size
                  </label>
                  <input
                    id="pet-size"
                    type="range"
                    min={64}
                    max={120}
                    step={4}
                    value={saved.size}
                    onChange={(e) => patch({ size: Number(e.target.value) })}
                    className="w-full accent-primary"
                  />
                </div>

                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Position</p>
                  <button
                    type="button"
                    onClick={() => {
                      patch({ position: left ? "br" : "bl" });
                      track("look_changed", { target: left ? "bottom-right" : "bottom-left", tab: "look" });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <MoveHorizontal className="h-3 w-3" aria-hidden />
                    Move to {left ? "bottom right" : "bottom left"}
                  </button>
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
                    {saved.renderer === "3d" ? <Terminal className="h-3 w-3" aria-hidden /> : <Smile className="h-3 w-3" aria-hidden />}
                    {saved.renderer === "3d" ? "ASCII mode" : "Soft mode"}
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden /> Reset
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border/50 px-3 py-1.5">
            <span className="text-[10px] text-muted-foreground">Press T anytime</span>
            <button
              type="button"
              onClick={() => {
                minimize();
                triggerRef.current?.focus();
              }}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
            >
              <Minimize2 className="h-3 w-3" aria-hidden /> Minimize
            </button>
          </div>
        </div>
      )}

      <div className={cn("flex items-end gap-2", left && "flex-row-reverse")}>
        {/* Speech bubble */}
        <div
          className={cn(
            "relative hidden flex-1 rounded-2xl border border-border/60 bg-card/80 p-3 shadow-lg backdrop-blur-md sm:block",
            left ? "pl-8" : "pr-8",
            greeting && "border-primary/40",
          )}
        >
          <p className="text-xs leading-relaxed text-foreground/90">{bubbleText}</p>
          <button
            type="button"
            onClick={() => {
              wake();
              setGreeting(false);
              setTipIndex((i) => (i + 1) % tips.length);
              track("tip_shown", { target: "manual" });
            }}
            aria-label="Show next tip"
            className={cn(
              "absolute top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              left ? "left-2" : "right-2",
            )}
          >
            <ChevronRight className={cn("h-3.5 w-3.5", left && "rotate-180")} aria-hidden />
          </button>
          <span
            aria-hidden
            className={cn(
              "absolute bottom-4 h-2.5 w-2.5 rotate-45 border-border/60 bg-card/80",
              left ? "-left-1 border-b border-l" : "-right-1 border-b border-r",
            )}
          />
        </div>

        {/* The pet itself */}
        <div className="relative">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => openPanel(!open)}
            onDoubleClick={() => go(to, true, "pet-doubleclick")}
            onFocus={wake}
            onMouseEnter={() => setMood("wave")}
            onMouseLeave={() => setMood("idle")}
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-label={`${petName}, your Job Tayari companion. ${bubbleText} Press to open the companion panel.`}
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
              <Sparkles className="h-3 w-3" aria-hidden />
              Ask {petName}
            </span>
          </button>

          <button
            type="button"
            onClick={minimize}
            aria-label={`Minimize ${petName}`}
            className={cn(
              "absolute -top-2 rounded-full border border-border/60 bg-background p-1 text-muted-foreground shadow-sm transition-colors hover:border-primary/50 hover:text-primary",
              left ? "-left-2" : "-right-2",
            )}
          >
            <Minimize2 className="h-3 w-3" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
