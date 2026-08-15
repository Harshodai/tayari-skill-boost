import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';

export function Basic() {
  return (
    <Card style={{ width: 360 }}>
      <CardHeader>
        <CardTitle>Senior Product Designer</CardTitle>
        <CardDescription>Figma · Remote · Full-time</CardDescription>
      </CardHeader>
      <CardContent>
        <p style={{ fontSize: 14, color: 'hsl(var(--muted-foreground))' }}>
          Lead the design system for a Series B fintech product, partnering closely with
          engineering and research.
        </p>
      </CardContent>
    </Card>
  );
}

export function WithFooterActions() {
  return (
    <Card style={{ width: 360 }}>
      <CardHeader>
        <CardTitle>Resume match score</CardTitle>
        <CardDescription>Against the Stripe Staff Engineer posting</CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ fontSize: 32, fontWeight: 700, color: 'hsl(var(--primary))' }}>87%</div>
      </CardContent>
      <CardFooter style={{ gap: 8 }}>
        <Button size="sm">Optimize</Button>
        <Button size="sm" variant="outline">
          View gaps
        </Button>
      </CardFooter>
    </Card>
  );
}

export function StatSummary() {
  return (
    <Card style={{ width: 320 }}>
      <CardContent style={{ paddingTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <CardDescription>Applications this week</CardDescription>
          <div style={{ fontSize: 28, fontWeight: 700 }}>24</div>
        </div>
        <Badge variant="success">+18% vs last week</Badge>
      </CardContent>
    </Card>
  );
}
