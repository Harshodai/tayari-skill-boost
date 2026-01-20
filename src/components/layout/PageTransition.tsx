import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const [isAnimating, setIsAnimating] = useState(false);
  const [displayChildren, setDisplayChildren] = useState(children);

  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => {
      setDisplayChildren(children);
      setIsAnimating(false);
    }, 150);

    return () => clearTimeout(timer);
  }, [location.pathname, children]);

  return (
    <div
      className={`transition-all duration-300 ease-out ${
        isAnimating
          ? "opacity-0 translate-y-4"
          : "opacity-100 translate-y-0"
      }`}
    >
      {displayChildren}
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
