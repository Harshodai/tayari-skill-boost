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

import { SlideUp } from '@/components/ui/motion';
import { Button } from '@/components/ui/button';

// Even with the observer settled instantly, framer-motion still runs its own
// transition — the headless capture screenshots before that settles.
// duration={0}/delay={0} makes the end state land on the first frame.
export function HeroCopy() {
  return (
    <SlideUp duration={0} delay={0}>
      <div style={{ maxWidth: 440, textAlign: 'center' }}>
        <h2 style={{ fontSize: 30, fontWeight: 700, margin: 0 }}>Everything You Need to Succeed</h2>
        <p style={{ fontSize: 15, color: 'hsl(var(--muted-foreground))', marginTop: 10 }}>
          Our suite of automated AI agents and tools handles every step of your application funnel.
        </p>
      </div>
    </SlideUp>
  );
}

export function CtaRow() {
  return (
    <SlideUp delay={0} duration={0}>
      <div style={{ display: 'flex', gap: 12 }}>
        <Button>Optimize my resume</Button>
        <Button variant="outline">See how it works</Button>
      </div>
    </SlideUp>
  );
}

export function StaggeredDelayList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SlideUp delay={0} duration={0}>
        <div style={{ fontSize: 14 }}>1. Upload your resume</div>
      </SlideUp>
      <SlideUp delay={0} duration={0}>
        <div style={{ fontSize: 14 }}>2. Paste the job description</div>
      </SlideUp>
      <SlideUp delay={0} duration={0}>
        <div style={{ fontSize: 14 }}>3. Get a tailored, ATS-ready rewrite</div>
      </SlideUp>
    </div>
  );
}
