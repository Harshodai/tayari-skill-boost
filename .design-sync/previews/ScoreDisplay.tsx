import { ScoreDisplay } from '@/components/ui/score-display';

export function ScoreSweep() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24 }}>
      <ScoreDisplay score={91} label="Stripe fit" animated={false} />
      <ScoreDisplay score={64} label="Notion fit" animated={false} />
      <ScoreDisplay score={38} label="Figma fit" animated={false} />
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24 }}>
      <ScoreDisplay score={87} size="sm" label="ATS score" animated={false} />
      <ScoreDisplay score={87} size="md" label="ATS score" animated={false} />
      <ScoreDisplay score={87} size="lg" label="ATS score" animated={false} />
    </div>
  );
}

export function WithBar() {
  return (
    <div style={{ width: 200 }}>
      <ScoreDisplay score={78} label="Resume match" showBar animated={false} />
    </div>
  );
}
