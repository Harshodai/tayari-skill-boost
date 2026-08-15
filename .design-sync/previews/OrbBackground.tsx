import { OrbBackground } from '@/components/ui/floating-particles';
import { Button } from '@/components/ui/button';

export function HeroSection() {
  return (
    <div style={{ position: 'relative', width: 560, height: 300, borderRadius: 16, overflow: 'hidden', background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}>
      <OrbBackground />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14, padding: 24, textAlign: 'center' }}>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0 }}>Job prep, optimized by AI</h1>
        <p style={{ fontSize: 14, color: 'hsl(var(--muted-foreground))', margin: 0, maxWidth: 380 }}>
          Resume scoring, cover letters, interview prep, and job search autopilot — all in one place.
        </p>
        <Button>Get started free</Button>
      </div>
    </div>
  );
}

export function CardBackdrop() {
  return (
    <div style={{ position: 'relative', width: 380, height: 220, borderRadius: 16, overflow: 'hidden', background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
      <OrbBackground className="opacity-70" />
      <div style={{ position: 'relative', zIndex: 1, padding: 24 }}>
        <div style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>Your ATS score</div>
        <div style={{ fontSize: 42, fontWeight: 700, color: 'hsl(var(--primary))' }}>87%</div>
      </div>
    </div>
  );
}
