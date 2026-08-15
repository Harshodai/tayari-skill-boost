import { JobMatchScore } from '@/components/ui/job-match-score';

export function HighMatch() {
  return (
    <JobMatchScore
      score={94}
      label="Senior Frontend Engineer — Stripe"
      animated={false}
    />
  );
}

export function MediumMatch() {
  return (
    <JobMatchScore
      score={64}
      label="Product Manager — Notion"
      animated={false}
    />
  );
}

export function LowMatch() {
  return (
    <JobMatchScore
      score={31}
      label="Data Scientist — Vercel"
      animated={false}
    />
  );
}

export function Sizes() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24 }}>
      <JobMatchScore score={88} size="sm" label="Small" animated={false} />
      <JobMatchScore score={88} size="md" label="Medium" animated={false} />
      <JobMatchScore score={88} size="lg" label="Large" animated={false} />
    </div>
  );
}

export function WithoutBar() {
  return (
    <JobMatchScore
      score={72}
      label="Staff Product Designer — Anthropic"
      sublabel="Solid alignment on core skills"
      showBar={false}
      animated={false}
    />
  );
}
