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
