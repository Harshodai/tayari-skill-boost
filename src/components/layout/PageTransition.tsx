import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  return (
    <div className="animate-fade-in-up">
      {children}
    </div>
  );
}

// Simple fade wrapper for individual page content
export function PageFade({ children }: { children: ReactNode }) {
  return (
    <div className="animate-fade-in-up">
      {children}
    </div>
  );
}
