import { Badge } from '@/components/ui/badge';

export function Variants() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      <Badge variant="default">Active</Badge>
      <Badge variant="secondary">Draft</Badge>
      <Badge variant="destructive">Rejected</Badge>
      <Badge variant="outline">Paused</Badge>
      <Badge variant="success">Offer</Badge>
      <Badge variant="warning">Screening</Badge>
      <Badge variant="info">Interview</Badge>
      <Badge variant="subtle">Saved</Badge>
    </div>
  );
}

export function ApplicationStatuses() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      <Badge variant="secondary">Applied</Badge>
      <Badge variant="warning">Screening</Badge>
      <Badge variant="info">Interview</Badge>
      <Badge variant="success">Offer</Badge>
      <Badge variant="destructive">Rejected</Badge>
      <Badge variant="subtle">Saved</Badge>
      <Badge variant="outline">Pending</Badge>
      <Badge variant="default">Completed</Badge>
    </div>
  );
}

export function InContext() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 340 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>Stripe — Senior Frontend Engineer</span>
        <Badge variant="info">Interview</Badge>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>Anthropic — Staff Product Designer</span>
        <Badge variant="success">Offer</Badge>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>Notion — Full-stack Engineer</span>
        <Badge variant="destructive">Rejected</Badge>
      </div>
    </div>
  );
}
