import { StaggerContainer } from '@/components/ui/motion';
import { StatsCard } from '@/components/ui/stats-card';
import { Send, CalendarCheck, TrendingUp } from 'lucide-react';

export function StatsRow() {
  return (
    <StaggerContainer>
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
    <StaggerContainer staggerDelay={0.1}>
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
    <StaggerContainer staggerDelay={0.05}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: 320 }}>
        <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>React</span>
        <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>TypeScript</span>
        <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>GraphQL</span>
        <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>Design Systems</span>
      </div>
    </StaggerContainer>
  );
}
