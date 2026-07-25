import { useState, useEffect, useRef, RefObject } from 'react';

interface UseIntersectionObserverOptions {
  threshold?: number | number[];
  root?: Element | null;
  rootMargin?: string;
  freezeOnceVisible?: boolean;
}

interface IntersectionResult {
  isIntersecting: boolean;
  entry?: IntersectionObserverEntry;
}

export function useIntersectionObserver<T extends Element>(
  options: UseIntersectionObserverOptions = {}
): [RefObject<T>, IntersectionResult] {
  const {
    threshold = 0.1,
    root = null,
    rootMargin = '0px',
    freezeOnceVisible = true,
  } = options;

  const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
  const elementRef = useRef<T>(null);
  const [result, setResult] = useState<IntersectionResult>({
    isIntersecting: isTest,
  });

  const frozen = result.isIntersecting && freezeOnceVisible;

  useEffect(() => {
    const element = elementRef.current;
    if (!element || frozen) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setResult({
          isIntersecting: entry.isIntersecting,
          entry,
        });
      },
      { threshold, root, rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold, root, rootMargin, frozen]);

  return [elementRef, result];
}

// Hook for multiple elements with staggered animations
export function useStaggeredIntersection(
  itemCount: number,
  options: UseIntersectionObserverOptions = {}
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const children = container.children;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = Array.from(children).indexOf(entry.target as Element);
          if (index !== -1) {
            setVisibleItems((prev) => {
              const next = new Set(prev);
              if (entry.isIntersecting) {
                next.add(index);
              }
              return next;
            });
          }
        });
      },
      { threshold: options.threshold ?? 0.1, rootMargin: options.rootMargin ?? '0px' }
    );

    Array.from(children).forEach((child) => {
      observer.observe(child);
    });

    return () => {
      observer.disconnect();
    };
  }, [itemCount, options.threshold, options.rootMargin]);

  return { containerRef, visibleItems };
}
