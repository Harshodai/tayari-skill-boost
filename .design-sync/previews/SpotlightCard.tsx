import { SpotlightCard } from '@/components/ui/spotlight-card';
import { Button } from '@/components/ui/button';
import { FileText, Briefcase, Mic } from 'lucide-react';

export function FeatureCard() {
  return (
    <SpotlightCard className="bg-card/40 border-input" style={{ width: 300, padding: 24 }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'hsl(var(--primary) / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--primary))', marginBottom: 16 }}>
        <FileText size={22} />
      </div>
      <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Resume Optimizer</h3>
      <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', marginTop: 6 }}>
        Rewrites your bullets to match the job description and pass ATS parsing.
      </p>
      <Button size="sm" variant="outline" style={{ marginTop: 16 }}>
        Try it now
      </Button>
    </SpotlightCard>
  );
}

export function SuccessGlow() {
  return (
    <SpotlightCard
      spotlightColor="hsl(142 71% 45% / 0.18)"
      className="bg-card/40 border-input"
      style={{ width: 300, padding: 24 }}
    >
      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'hsl(142 71% 45% / 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(142 71% 40%)', marginBottom: 16 }}>
        <Mic size={22} />
      </div>
      <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>AI Interview Coach</h3>
      <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', marginTop: 6 }}>
        Practice behavioral and technical questions with real-time feedback.
      </p>
      <Button size="sm" variant="outline" style={{ marginTop: 16 }}>
        Start practice session
      </Button>
    </SpotlightCard>
  );
}

export function LargeSpotlightRadius() {
  return (
    <SpotlightCard
      spotlightColor="hsl(var(--accent) / 0.2)"
      spotlightSize={600}
      className="bg-card/40 border-input"
      style={{ width: 300, padding: 24 }}
    >
      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'hsl(var(--accent) / 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--accent-foreground))', marginBottom: 16 }}>
        <Briefcase size={22} />
      </div>
      <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Job Matcher</h3>
      <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', marginTop: 6 }}>
        Surfaces roles ranked by your real ATS match score, updated daily.
      </p>
      <Button size="sm" variant="outline" style={{ marginTop: 16 }}>
        Find matched jobs
      </Button>
    </SpotlightCard>
  );
}
