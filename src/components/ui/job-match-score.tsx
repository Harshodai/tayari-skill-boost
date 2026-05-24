import * as React from "react";
import { cn } from "@/lib/utils";

interface JobMatchScoreProps {
  score: number; // 0-100
  size?: "sm" | "md" | "lg";
  label?: string;
  sublabel?: string;
  showBar?: boolean;
  animated?: boolean;
  className?: string;
}

type Tier = "good" | "ok" | "bad";

function tierFor(score: number): Tier {
  if (score >= 80) return "good";
  if (score >= 50) return "ok";
  return "bad";
}

const tierColors: Record<Tier, { text: string; bar: string; ring: string; glow: string; label: string }> = {
  good: {
    text: "text-success",
    bar: "bg-success",
    ring: "stroke-success",
    glow: "shadow-[0_0_30px_-5px_hsl(var(--success)/0.5)]",
    label: "Strong match",
  },
  ok: {
    text: "text-warning",
    bar: "bg-warning",
    ring: "stroke-warning",
    glow: "shadow-[0_0_30px_-5px_hsl(var(--warning)/0.45)]",
    label: "Needs work",
  },
  bad: {
    text: "text-destructive",
    bar: "bg-destructive",
    ring: "stroke-destructive",
    glow: "shadow-[0_0_30px_-5px_hsl(var(--destructive)/0.45)]",
    label: "Weak match",
  },
};

const sizeMap = {
  sm: { box: "w-20 h-20", radius: 30, stroke: 5, text: "text-xl" },
  md: { box: "w-32 h-32", radius: 48, stroke: 6, text: "text-3xl" },
  lg: { box: "w-44 h-44", radius: 66, stroke: 8, text: "text-5xl" },
};

export function JobMatchScore({
  score,
  size = "md",
  label = "Job Match",
  sublabel,
  showBar = true,
  animated = true,
  className,
}: JobMatchScoreProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const [display, setDisplay] = React.useState(animated ? 0 : clamped);

  React.useEffect(() => {
    if (!animated) {
      setDisplay(clamped);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * clamped));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clamped, animated]);

  const tier = tierFor(display);
  const c = tierColors[tier];
  const s = sizeMap[size];
  const size_ = s.radius * 2 + s.stroke * 2 + 4;
  const circumference = 2 * Math.PI * s.radius;
  const offset = circumference - (display / 100) * circumference;
  const tierSublabel = sublabel ?? c.label;

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className={cn("relative flex items-center justify-center", s.box, c.glow, "rounded-full")}>
        <svg className="absolute inset-0 -rotate-90" viewBox={`0 0 ${size_} ${size_}`}>
          <circle
            cx={size_ / 2}
            cy={size_ / 2}
            r={s.radius}
            fill="none"
            className="stroke-muted/40"
            strokeWidth={s.stroke}
          />
          <circle
            cx={size_ / 2}
            cy={size_ / 2}
            r={s.radius}
            fill="none"
            className={cn(c.ring, "transition-[stroke-dashoffset] duration-300 ease-out")}
            strokeWidth={s.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="flex flex-col items-center">
          <span className={cn("font-bold leading-none tabular-nums", s.text, c.text)}>{display}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">/ 100</span>
        </div>
      </div>

      <div className="text-center">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className={cn("text-xs font-medium", c.text)}>{tierSublabel}</div>
      </div>

      {showBar && (
        <div className="w-full max-w-[220px]">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
            <div
              className={cn("h-full rounded-full transition-[width] duration-500 ease-out", c.bar)}
              style={{ width: `${display}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>0</span>
            <span>50</span>
            <span>80</span>
            <span>100</span>
          </div>
        </div>
      )}
    </div>
  );
}
