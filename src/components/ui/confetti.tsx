import { useEffect, useState } from "react";

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  rotation: number;
  delay: number;
  duration: number;
  isCircle: boolean;
  drift: number;
}

const COLORS = [
  "#6366f1", // Indigo
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#0ea5e9", // Sky
  "#8b5cf6", // Violet
  "#eab308", // Yellow
];

export function Confetti({ count = 60 }: { count?: number }) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    const generated: ConfettiPiece[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100, // percentage across screen
      y: -10 - Math.random() * 20, // start above view
      size: 6 + Math.random() * 8, // 6px - 14px
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * 360,
      delay: Math.random() * 1.2,
      duration: 2.2 + Math.random() * 2.2,
      isCircle: Math.random() > 0.6,
      drift: (Math.random() - 0.5) * 80,
    }));
    setPieces(generated);
  }, [count]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translate3d(var(--x-start), -20px, 0) rotate(0deg);
            opacity: 1;
          }
          85% {
            opacity: 0.9;
          }
          100% {
            transform: translate3d(var(--x-end), 105vh, 0) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
      {pieces.map((piece) => {
        return (
          <div
            key={piece.id}
            style={{
              position: "absolute",
              left: `${piece.x}%`,
              top: `${piece.y}px`,
              width: `${piece.size}px`,
              height: piece.isCircle ? `${piece.size}px` : `${piece.size * 1.6}px`,
              backgroundColor: piece.color,
              borderRadius: piece.isCircle ? "50%" : "2px",
              opacity: 0.9,
              animation: `confetti-fall ${piece.duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${piece.delay}s forwards`,
              transform: `rotate(${piece.rotation}deg)`,
              // CSS custom properties for drift
              ["--x-start" as any]: "0px",
              ["--x-end" as any]: `${piece.drift}px`,
            }}
          />
        );
      })}
    </div>
  );
}
