// Static-capture polyfill: whileInView relies on IntersectionObserver, whose
// first real callback can land after the headless screenshot fires, leaving
// the story stuck at its `initial` (invisible) state. Firing synchronously
// here settles it before paint — preview-only, does not touch app source.
if (typeof window !== 'undefined') {
  class ImmediateIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds: ReadonlyArray<number> = [];
    constructor(private cb: IntersectionObserverCallback) {}
    observe(target: Element) {
      this.cb([{ isIntersecting: true, target, intersectionRatio: 1 } as IntersectionObserverEntry], this);
    }
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  // @ts-expect-error preview-only override
  window.IntersectionObserver = ImmediateIntersectionObserver;

  // framer-motion's useReducedMotion() checks this media query and, when it
  // matches, skips the transition entirely (renders straight at the final
  // state, duration 0) -- the built-in bypass for exactly this situation.
  const reduceMotionQuery = '(prefers-reduced-motion: reduce)';
  const realMatchMedia = window.matchMedia?.bind(window);
  window.matchMedia = (query) => {
    if (query === reduceMotionQuery) {
      return {
        matches: true,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      } as MediaQueryList;
    }
    return realMatchMedia ? realMatchMedia(query) : ({ matches: false, media: query } as MediaQueryList);
  };
}

import { ScaleIn } from '@/components/ui/motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Even with the observer settled instantly, framer-motion still runs its own
// transition — the headless capture screenshots before that settles.
// duration={0}/delay={0} makes the end state land on the first frame.
export function ScoreReveal() {
  return (
    <ScaleIn duration={0} delay={0}>
      <Card style={{ width: 260 }}>
        <CardContent style={{ paddingTop: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>Resume match score</div>
          <div style={{ fontSize: 44, fontWeight: 700, color: 'hsl(var(--primary))' }}>91%</div>
        </CardContent>
      </Card>
    </ScaleIn>
  );
}

export function SuccessBadgePopIn() {
  return (
    <ScaleIn duration={0} delay={0}>
      <Badge variant="success" style={{ fontSize: 14, padding: '8px 16px' }}>
        Offer received — Stripe
      </Badge>
    </ScaleIn>
  );
}

export function DelayedModalCard() {
  return (
    <ScaleIn duration={0} delay={0}>
      <Card style={{ width: 320, padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Guardrail check passed</div>
        <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', marginTop: 6 }}>
          No fabricated metrics or unconditional readiness claims detected.
        </p>
      </Card>
    </ScaleIn>
  );
}
