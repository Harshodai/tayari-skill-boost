import * as React from "react";
import { cn } from "@/lib/utils";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

interface FloatingParticlesProps {
  className?: string;
  particleCount?: number;
  minSize?: number;
  maxSize?: number;
  color?: string;
}

export function FloatingParticles({
  className,
  particleCount = 20,
  minSize = 2,
  maxSize = 6,
  color,
}: FloatingParticlesProps) {
  const particles = React.useMemo<Particle[]>(() => {
    return Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * (maxSize - minSize) + minSize,
      duration: Math.random() * 20 + 15,
      delay: Math.random() * 5,
      opacity: Math.random() * 0.5 + 0.2,
    }));
  }, [particleCount, minSize, maxSize]);

  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full animate-float"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
            backgroundColor: color || "hsl(var(--primary))",
            opacity: particle.opacity,
            animationDuration: `${particle.duration}s`,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

// Animated gradient orbs for hero backgrounds
interface GradientOrbProps {
  className?: string;
  color1?: string;
  color2?: string;
  size?: string;
  blur?: string;
  animate?: boolean;
}

export function GradientOrb({
  className,
  color1 = "hsl(var(--primary))",
  color2 = "hsl(var(--secondary))",
  size = "400px",
  blur = "100px",
  animate = true,
}: GradientOrbProps) {
  return (
    <div
      className={cn(
        "absolute rounded-full pointer-events-none",
        animate && "animate-blob",
        className
      )}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, ${color1} 0%, ${color2} 50%, transparent 70%)`,
        filter: `blur(${blur})`,
        opacity: 0.4,
      }}
    />
  );
}

// Background with multiple animated orbs
interface OrbBackgroundProps {
  className?: string;
}

export function OrbBackground({ className }: OrbBackgroundProps) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      <GradientOrb
        className="top-0 -left-48 animate-blob"
        color1="hsl(var(--primary) / 0.3)"
        color2="transparent"
        size="600px"
      />
      <GradientOrb
        className="top-1/4 -right-32 animate-blob-delayed"
        color1="hsl(var(--secondary) / 0.25)"
        color2="transparent"
        size="500px"
      />
      <GradientOrb
        className="bottom-0 left-1/4 animate-blob-delayed-2"
        color1="hsl(var(--accent) / 0.2)"
        color2="transparent"
        size="450px"
      />
    </div>
  );
}
