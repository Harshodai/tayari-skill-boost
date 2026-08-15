import { ScaleIn } from '@/components/ui/motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function ScoreReveal() {
  return (
    <ScaleIn>
      <Card style={{ width: 260 }}>
        <CardContent style={{ paddingTop: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>Resume match score</div>
          <div style={{ fontSize: 44, fontWeight: 700, color: 'hsl(var(--primary))' }}>91%</div>
        </CardContent>
      </Card>
    </ScaleIn>
  );
}

export function SuccessBadgePopIn() {
  return (
    <ScaleIn duration={0.3}>
      <Badge variant="success" style={{ fontSize: 14, padding: '8px 16px' }}>
        Offer received — Stripe
      </Badge>
    </ScaleIn>
  );
}

export function DelayedModalCard() {
  return (
    <ScaleIn delay={0.2}>
      <Card style={{ width: 320, padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Guardrail check passed</div>
        <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', marginTop: 6 }}>
          No fabricated metrics or unconditional readiness claims detected.
        </p>
      </Card>
    </ScaleIn>
  );
}
