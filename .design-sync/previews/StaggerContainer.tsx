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

import { StaggerContainer } from '@/components/ui/motion';
import { StatsCard } from '@/components/ui/stats-card';
import { Send, CalendarCheck, TrendingUp } from 'lucide-react';

export function StatsRow() {
  return (
    <StaggerContainer initial={false}>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ width: 220 }}>
          <StatsCard label="Applications Sent" value={24} icon={<Send />} colorScheme="primary" />
        </div>
        <div style={{ width: 220 }}>
          <StatsCard label="Interviews Scheduled" value={3} icon={<CalendarCheck />} colorScheme="warning" />
        </div>
        <div style={{ width: 220 }}>
          <StatsCard label="Response Rate" value="18%" icon={<TrendingUp />} colorScheme="success" />
        </div>
      </div>
    </StaggerContainer>
  );
}

export function FeatureList() {
  return (
    <StaggerContainer staggerDelay={0} initial={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 320 }}>
        <div style={{ padding: 14, border: '1px solid hsl(var(--border))', borderRadius: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Resume Optimizer</div>
          <div style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>ATS-safe rewrites in seconds</div>
        </div>
        <div style={{ padding: 14, border: '1px solid hsl(var(--border))', borderRadius: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Interview Coach</div>
          <div style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>Practice with real-time feedback</div>
        </div>
        <div style={{ padding: 14, border: '1px solid hsl(var(--border))', borderRadius: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Job AutoPilot</div>
          <div style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>Finds and ranks new matches daily</div>
        </div>
      </div>
    </StaggerContainer>
  );
}

export function BadgeCluster() {
  return (
    <StaggerContainer staggerDelay={0} initial={false}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: 320 }}>
        <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>React</span>
        <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>TypeScript</span>
        <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>GraphQL</span>
        <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>Design Systems</span>
      </div>
    </StaggerContainer>
  );
}
