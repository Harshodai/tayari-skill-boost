import { AtsScoreBadge } from '@/components/ui/status-badge';

export function ScoreSweep() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <AtsScoreBadge score={94} />
      <AtsScoreBadge score={73} />
      <AtsScoreBadge score={41} />
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <AtsScoreBadge score={87} size="sm" />
      <AtsScoreBadge score={87} size="md" />
      <AtsScoreBadge score={87} size="lg" />
    </div>
  );
}

export function WithoutLabel() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <AtsScoreBadge score={91} showLabel={false} />
      <AtsScoreBadge score={58} showLabel={false} />
      <AtsScoreBadge score={22} showLabel={false} />
    </div>
  );
}
