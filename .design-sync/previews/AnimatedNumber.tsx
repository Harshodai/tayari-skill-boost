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
