import { StatusBadge, type ApplicationStatus } from '@/components/ui/status-badge';

const allStatuses: ApplicationStatus[] = [
  'applied',
  'interview',
  'offer',
  'rejected',
  'saved',
  'screening',
  'pending',
  'active',
  'paused',
  'completed',
  'draft',
];

export function AllStatuses() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, width: 480 }}>
      {allStatuses.map((status) => (
        <StatusBadge key={status} status={status} />
      ))}
    </div>
  );
}

export function WithDot() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, width: 420 }}>
      <StatusBadge status="active" dot />
      <StatusBadge status="interview" dot />
      <StatusBadge status="screening" dot />
      <StatusBadge status="applied" dot />
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <StatusBadge status="interview" size="sm" />
      <StatusBadge status="interview" size="md" />
      <StatusBadge status="interview" size="lg" />
    </div>
  );
}
