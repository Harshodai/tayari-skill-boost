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

import { FadeIn } from '@/components/ui/motion';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Even with the observer settled instantly, framer-motion still runs its own
// ~0.4s opacity transition — the headless capture screenshots before that
// settles. duration={0}/delay={0} makes the end state land on the very
// first frame, so the static capture always sees it fully resolved.
export function SectionHeading() {
  return (
    <FadeIn duration={0} delay={0}>
      <div style={{ maxWidth: 420 }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Everything you need to succeed</h2>
        <p style={{ fontSize: 15, color: 'hsl(var(--muted-foreground))', marginTop: 8 }}>
          Our suite of automated AI agents handles every step of your application funnel.
        </p>
      </div>
    </FadeIn>
  );
}

export function JobResultCard() {
  return (
    <FadeIn duration={0} delay={0}>
      <Card style={{ width: 340 }}>
        <CardHeader>
          <CardTitle>Senior Backend Engineer</CardTitle>
          <CardDescription>Notion · Remote · Full-time</CardDescription>
        </CardHeader>
        <CardContent style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Badge variant="success">89% match</Badge>
          <span style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>Posted 3 days ago</span>
        </CardContent>
      </Card>
    </FadeIn>
  );
}

export function DelayedEntry() {
  return (
    <FadeIn delay={0} duration={0}>
      <Card style={{ width: 300, padding: 20 }}>
        <span style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>Application status</span>
        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>Interview scheduled</div>
      </Card>
    </FadeIn>
  );
}
