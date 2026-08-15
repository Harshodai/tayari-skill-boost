import { AnimatedGradientText } from '@/components/ui/animated-gradient-text';

export function Headline() {
  return (
    <h2 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>
      <AnimatedGradientText>Land your next role faster</AnimatedGradientText>
    </h2>
  );
}

export function SectionEyebrow() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 420 }}>
      <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        <AnimatedGradientText>AI-Powered Job Prep</AnimatedGradientText>
      </span>
      <h3 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'hsl(var(--foreground))' }}>
        Optimize your resume against any job description
      </h3>
    </div>
  );
}

export function Static() {
  return (
    <p style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
      <AnimatedGradientText animated={false}>92% ATS match on your last scan</AnimatedGradientText>
    </p>
  );
}

export function InlineWithinCopy() {
  return (
    <p style={{ fontSize: 16, lineHeight: 1.6, maxWidth: 480, color: 'hsl(var(--foreground))' }}>
      Job Tayari's reflexion loop rewrites weak bullets until they{' '}
      <AnimatedGradientText>pass every ATS check</AnimatedGradientText>, then hands the draft back for
      your review.
    </p>
  );
}
