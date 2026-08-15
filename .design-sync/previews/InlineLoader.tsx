import { InlineLoader } from '@/components/ui/loading-spinner';

export function Default() {
  return (
    <div style={{ width: 360, border: '1px solid hsl(var(--border))', borderRadius: 8, padding: 16 }}>
      <InlineLoader />
    </div>
  );
}

export function CustomLabels() {
  return (
    <div style={{ width: 360, border: '1px solid hsl(var(--border))', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <InlineLoader label="Fetching job matches…" />
      <InlineLoader label="Scoring resume against Stripe posting…" />
      <InlineLoader label="Generating cover letter…" />
    </div>
  );
}

export function InsideCard() {
  return (
    <div
      style={{
        width: 380,
        border: '1px solid hsl(var(--border))',
        borderRadius: 12,
        background: 'hsl(var(--card))',
        padding: 20,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Application queue</div>
      <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginBottom: 8 }}>
        Autopilot is submitting to 6 remaining roles
      </div>
      <InlineLoader label="Applying to Anthropic — Staff Product Designer…" />
    </div>
  );
}
