// Static-capture polyfill: CountUp (which AnimatedNumber wraps) gates its
// animation start on a real IntersectionObserver firing and then runs a
// 2.5s wall-clock animation loop — nowhere near settled by the time the
// headless screenshot fires. Firing the observer synchronously and running
// a fake monotonically-jumping clock lets it complete within its first few
// real frames instead. Preview-only, does not touch app source.
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

  let fakeNow = Date.now();
  Date.now = () => {
    fakeNow += 200;
    return fakeNow;
  };
}

import { AnimatedNumber } from '@/components/ui/count-up';

export function AtsScore() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>ATS match score</span>
      <div style={{ fontSize: 40, fontWeight: 700, color: 'hsl(var(--primary))' }}>
        <AnimatedNumber value={92} suffix="%" />
      </div>
    </div>
  );
}

export function JobsMatched() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>Jobs matched this week</span>
      <div style={{ fontSize: 40, fontWeight: 700 }}>
        <AnimatedNumber value={128} />
      </div>
    </div>
  );
}

export function ScoreImprovement() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>ATS score improved by</span>
      <div style={{ fontSize: 40, fontWeight: 700, color: 'hsl(142 71% 40%)' }}>
        <AnimatedNumber value={34} suffix="%" />
      </div>
    </div>
  );
}

export function StatRow() {
  return (
    <div style={{ display: 'flex', gap: 32 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: 'hsl(var(--primary))' }}>
          <AnimatedNumber value={2400} suffix="+" />
        </div>
        <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Resumes optimized</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: 'hsl(var(--primary))' }}>
          <AnimatedNumber value={87} suffix="%" />
        </div>
        <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Avg. ATS score</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: 'hsl(var(--primary))' }}>
          <AnimatedNumber value={3} suffix="x" />
        </div>
        <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>More callbacks</span>
      </div>
    </div>
  );
}
