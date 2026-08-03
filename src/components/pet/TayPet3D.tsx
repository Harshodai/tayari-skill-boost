import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { PetState } from "./petFrames";

export interface TayPet3DProps {
  state: PetState;
  size?: number;
  className?: string;
}

function usePupilOffset(ref: React.RefObject<HTMLElement>, active: boolean) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!active) {
      setOffset({ x: 0, y: 0 });
      return;
    }
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    let frame = 0;
    const onMove = (e: PointerEvent) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const max = 3.2;
        const pull = Math.min(dist / 260, 1) * max;
        setOffset({ x: (dx / dist) * pull, y: (dy / dist) * pull });
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [ref, active]);

  return offset;
}

/**
 * Tay — a soft, dimensional companion rendered as layered SVG: gradient body,
 * specular highlight, contact shadow and mood-driven facial rig. Every mood the
 * ASCII rig supports has a matching expression here so the two renderers can be
 * swapped without losing state.
 */
export function TayPet3D({ state, size = 92, className }: TayPet3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const awake = state !== "sleep";
  const eye = usePupilOffset(hostRef, awake);

  const blinking = state === "blink";
  const asleep = state === "sleep";
  const happy = state === "celebrate" || state === "wave";
  const lidY = blinking || asleep ? 1 : 0;

  return (
    <div
      ref={hostRef}
      className={cn("relative select-none", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className={cn(
          "overflow-visible",
          asleep ? "animate-[tay-breathe_4.4s_ease-in-out_infinite]" : "animate-[tay-bob_3.2s_ease-in-out_infinite]",
          state === "celebrate" && "animate-[tay-hop_0.5s_ease-in-out_2]",
          state === "wave" && "animate-[tay-tilt_1.1s_ease-in-out_infinite]",
        )}
      >
        <defs>
          <radialGradient id="tay-body" cx="35%" cy="26%" r="82%">
            <stop offset="0%" stopColor="hsl(var(--primary) / 0.95)" />
            <stop offset="52%" stopColor="hsl(var(--primary) / 0.78)" />
            <stop offset="100%" stopColor="hsl(var(--primary) / 0.42)" />
          </radialGradient>
          <radialGradient id="tay-gloss" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(0 0% 100% / 0.75)" />
            <stop offset="100%" stopColor="hsl(0 0% 100% / 0)" />
          </radialGradient>
          <radialGradient id="tay-rim" cx="70%" cy="88%" r="60%">
            <stop offset="0%" stopColor="hsl(var(--accent) / 0.55)" />
            <stop offset="100%" stopColor="hsl(var(--accent) / 0)" />
          </radialGradient>
          <radialGradient id="tay-shadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(var(--foreground) / 0.28)" />
            <stop offset="100%" stopColor="hsl(var(--foreground) / 0)" />
          </radialGradient>
          <linearGradient id="tay-antenna" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="hsl(var(--primary) / 0.5)" />
            <stop offset="100%" stopColor="hsl(var(--accent))" />
          </linearGradient>
        </defs>

        {/* contact shadow */}
        <ellipse cx="50" cy="92" rx="26" ry="6" fill="url(#tay-shadow)" />

        {/* antenna */}
        <path d="M50 26 C50 18 54 15 56 11" stroke="url(#tay-antenna)" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <circle
          cx="56.5"
          cy="9.5"
          r="4"
          fill="hsl(var(--accent))"
          className={state === "thinking" ? "animate-[tay-pulse_0.9s_ease-in-out_infinite]" : "animate-[tay-pulse_2.6s_ease-in-out_infinite]"}
        />

        {/* body */}
        <g>
          <path
            d="M50 22c16.5 0 27 11.4 27 27.5C77 68 66 82 50 82S23 68 23 49.5C23 33.4 33.5 22 50 22z"
            fill="url(#tay-body)"
            stroke="hsl(var(--primary) / 0.55)"
            strokeWidth="0.8"
          />
          <path
            d="M50 22c16.5 0 27 11.4 27 27.5C77 68 66 82 50 82S23 68 23 49.5C23 33.4 33.5 22 50 22z"
            fill="url(#tay-rim)"
          />
          <ellipse cx="39" cy="34" rx="13" ry="8.5" fill="url(#tay-gloss)" opacity="0.7" />
        </g>

        {/* face plate */}
        <ellipse cx="50" cy="52" rx="20" ry="17" fill="hsl(var(--background) / 0.9)" opacity="0.92" />

        {/* eyes */}
        <g transform={`translate(${eye.x} ${eye.y})`}>
          <g transform={`translate(42.5 50) scale(1 ${1 - lidY * 0.92})`}>
            <ellipse cx="0" cy="0" rx="3.4" ry="4.2" fill="hsl(var(--foreground))" />
            <circle cx="1.2" cy="-1.4" r="1.15" fill="hsl(0 0% 100% / 0.9)" />
          </g>
          <g transform={`translate(57.5 50) scale(1 ${1 - lidY * 0.92})`}>
            <ellipse cx="0" cy="0" rx="3.4" ry="4.2" fill="hsl(var(--foreground))" />
            <circle cx="1.2" cy="-1.4" r="1.15" fill="hsl(0 0% 100% / 0.9)" />
          </g>
        </g>
        {(blinking || asleep) && (
          <>
            <path d="M39 50.5q3.5 2.6 7 0" stroke="hsl(var(--foreground))" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            <path d="M54 50.5q3.5 2.6 7 0" stroke="hsl(var(--foreground))" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </>
        )}

        {/* blush */}
        <ellipse cx="36" cy="58" rx="3.6" ry="2.2" fill="hsl(var(--accent) / 0.45)" />
        <ellipse cx="64" cy="58" rx="3.6" ry="2.2" fill="hsl(var(--accent) / 0.45)" />

        {/* mouth */}
        {happy ? (
          <path d="M45 59.5q5 5.5 10 0" stroke="hsl(var(--foreground))" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        ) : asleep ? (
          <ellipse cx="50" cy="60.5" rx="2.4" ry="1.6" fill="hsl(var(--foreground) / 0.6)" />
        ) : state === "thinking" ? (
          <path d="M46 60.5h8" stroke="hsl(var(--foreground))" strokeWidth="1.6" strokeLinecap="round" />
        ) : (
          <path d="M46 59.8q4 3 8 0" stroke="hsl(var(--foreground))" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        )}

        {/* waving arm */}
        <path
          d="M76 58c5 -1 8 -4 9 -8"
          stroke="hsl(var(--primary) / 0.8)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          className={state === "wave" ? "origin-[76px_58px] animate-[tay-wave_0.5s_ease-in-out_infinite]" : "opacity-70"}
        />
        <path d="M24 58c-4.6 -1 -7.4 -3.6 -8.6 -7.4" stroke="hsl(var(--primary) / 0.65)" strokeWidth="3" strokeLinecap="round" fill="none" />

        {/* thinking dots */}
        {state === "thinking" && (
          <g>
            {[0, 1, 2].map((i) => (
              <circle
                key={i}
                cx={70 + i * 6}
                cy={26 - i * 4}
                r={1.6 + i * 0.5}
                fill="hsl(var(--accent))"
                className="animate-[tay-pulse_1.2s_ease-in-out_infinite]"
                style={{ animationDelay: `${i * 0.18}s` }}
              />
            ))}
          </g>
        )}

        {/* celebrate sparkles */}
        {state === "celebrate" && (
          <g className="animate-[tay-pulse_0.6s_ease-in-out_infinite]">
            <path d="M20 26l1.6 4 4 1.6-4 1.6L20 37l-1.6-3.8-4-1.6 4-1.6z" fill="hsl(var(--accent))" />
            <path d="M80 30l1.2 3 3 1.2-3 1.2L80 39l-1.2-3.6-3-1.2 3-1.2z" fill="hsl(var(--primary))" />
          </g>
        )}

        {/* sleep z's */}
        {asleep && (
          <g fill="hsl(var(--muted-foreground))" fontSize="9" fontWeight="600">
            <text x="72" y="30" className="animate-[tay-float_2.4s_ease-in-out_infinite]">z</text>
            <text x="80" y="20" fontSize="7" className="animate-[tay-float_2.4s_ease-in-out_infinite]" style={{ animationDelay: "0.5s" }}>
              z
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
