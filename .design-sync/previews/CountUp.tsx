// Static-capture polyfill: CountUp gates its animation start on a real
// IntersectionObserver firing, which can land after the headless screenshot
// — leaving the number frozen at its start value. Firing synchronously here
// settles it before paint — preview-only, does not touch app source.
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

  // The count-up animation loop measures real elapsed wall-clock time via
  // Date.now() across successive requestAnimationFrame ticks (1.5-2.5s to
  // finish) — nowhere near settled by the time the headless screenshot
  // fires. A monotonically-jumping fake clock lets each tick see large
  // elapsed deltas immediately, so the animation completes within its
  // first few real frames instead of its real multi-second duration.
  let fakeNow = Date.now();
  Date.now = () => {
    fakeNow += 200;
    return fakeNow;
  };
}

import { CountUp, AnimatedNumber } from '@/components/ui/count-up';

export function JobsMatched() {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 40, fontWeight: 700, color: 'hsl(var(--primary))' }}>
        <CountUp end={1204} duration={1500} />
      </div>
      <div style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>
        jobs matched to your resume
      </div>
    </div>
  );
}

export function ResumesOptimized() {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 40, fontWeight: 700, color: 'hsl(var(--foreground))' }}>
        <CountUp end={38291} duration={1500} separator="," />
      </div>
      <div style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>
        resumes optimized this month
      </div>
    </div>
  );
}

export function AverageAtsScoreLift() {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 40, fontWeight: 700, color: 'hsl(var(--success))' }}>
        <CountUp end={23.4} decimals={1} duration={1500} prefix="+" suffix="%" />
      </div>
      <div style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>
        average ATS score lift
      </div>
    </div>
  );
}

export function StatRow() {
  return (
    <div style={{ display: 'flex', gap: 32 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 700 }}>
          <AnimatedNumber value={24} />
        </div>
        <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Applications</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 700 }}>
          <AnimatedNumber value={3} />
        </div>
        <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Interviews</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 700 }}>
          <AnimatedNumber value={87} suffix="%" />
        </div>
        <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Avg. ATS Score</div>
      </div>
    </div>
  );
}
