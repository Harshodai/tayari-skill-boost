import { FloatingParticles } from '@/components/ui/floating-particles';

export function HeroBackdrop() {
  return (
    <div style={{ position: 'relative', width: 480, height: 260, borderRadius: 16, overflow: 'hidden', background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}>
      <FloatingParticles />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, margin: 0, textAlign: 'center' }}>Land your next role faster</h2>
        <p style={{ fontSize: 14, color: 'hsl(var(--muted-foreground))', textAlign: 'center', margin: 0 }}>
          AI-powered resume optimization, built for real applications.
        </p>
      </div>
    </div>
  );
}

export function DenseSecondaryTint() {
  return (
    <div style={{ position: 'relative', width: 480, height: 220, borderRadius: 16, overflow: 'hidden', background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
      <FloatingParticles particleCount={40} minSize={3} maxSize={8} color="hsl(var(--secondary))" />
      <div style={{ position: 'relative', zIndex: 1, padding: 24 }}>
        <div style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>AutoPilot is running</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>Scanning 340 new postings</div>
      </div>
    </div>
  );
}

export function SparseAccent() {
  return (
    <div style={{ position: 'relative', width: 420, height: 200, borderRadius: 16, overflow: 'hidden', background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
      <FloatingParticles particleCount={8} minSize={4} maxSize={10} color="hsl(var(--accent))" />
      <div style={{ position: 'relative', zIndex: 1, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Offer received</div>
        <div style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>Stripe · Staff Engineer</div>
      </div>
    </div>
  );
}
