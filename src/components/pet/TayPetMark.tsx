import type { CSSProperties } from "react";
import type { PetState } from "./petFrames";

interface TayPetMarkProps {
  state?: PetState;
  size?: number;
}

export function TayPetMark({ state = "idle", size = 48 }: TayPetMarkProps) {
  const style = { "--tay-mark-size": `${size}px` } as CSSProperties;
  const waving = state === "wave" || state === "celebrate";
  return (
    <span className="relative inline-grid place-items-center" style={style} aria-hidden="true">
      <span className="absolute inset-0 rounded-[38%] border border-primary/30 bg-primary/10 shadow-[0_0_22px_hsl(var(--primary)/0.28)] animate-[tay-float_3.2s_ease-in-out_infinite]" />
      <svg viewBox="0 0 72 72" width={size} height={size} className="relative drop-shadow-[0_8px_14px_hsl(var(--primary)/0.3)]" role="presentation">
        <defs>
          <linearGradient id="tay-mark-body" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="hsl(var(--primary))" />
            <stop offset="1" stopColor="hsl(var(--accent))" />
          </linearGradient>
        </defs>
        <path d="M36 8c14 0 24 9 24 23v13c0 12-10 20-24 20S12 56 12 44V31C12 17 22 8 36 8Z" fill="url(#tay-mark-body)" stroke="hsl(var(--foreground)/.22)" strokeWidth="1.5" />
        <path d="M18 34c0-8 8-14 18-14s18 6 18 14v10c0 8-8 13-18 13s-18-5-18-13Z" fill="hsl(var(--background)/.88)" />
        <circle cx="29" cy="40" r="3" fill="hsl(var(--foreground))" />
        <circle cx="43" cy="40" r="3" fill="hsl(var(--foreground))" />
        <circle cx="30" cy="39" r="1" fill="white" opacity=".9" />
        <circle cx="44" cy="39" r="1" fill="white" opacity=".9" />
        <path d="M31 47q5 5 10 0" fill="none" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeWidth="1.8" />
        <path d="M56 40c7 1 10-2 11-8" fill="none" stroke="hsl(var(--accent))" strokeLinecap="round" strokeWidth="3.5" className={waving ? "origin-[56px_40px] animate-[tay-wave_.55s_ease-in-out_infinite]" : "opacity-80"} />
        <circle cx="36" cy="4" r="3" fill="hsl(var(--accent))" className="animate-[tay-pulse        <ci-out_infinite]" />
      </svg>
    </span>
  );
}
