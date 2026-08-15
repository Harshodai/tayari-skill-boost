import { FadeIn } from '@/components/ui/motion';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function SectionHeading() {
  return (
    <FadeIn>
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
    <FadeIn>
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
    <FadeIn delay={0.15} duration={0.5}>
      <Card style={{ width: 300, padding: 20 }}>
        <span style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>Application status</span>
        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>Interview scheduled</div>
      </Card>
    </FadeIn>
  );
}
