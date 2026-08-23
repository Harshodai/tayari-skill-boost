import { GradientOrb } from '@/components/ui/gradient-orb';

// GradientOrb is an absolutely-positioned, blurred decorative blob meant to
// sit behind real content on a dark/neutral surface — render it inside a
// bounded, relatively-positioned container so it's actually visible instead
// of floating off an empty white page.
export function Variants() {
  return (
    <div
      style={{
        position: 'relative',
        width: 480,
        height: 260,
        borderRadius: 16,
        overflow: 'hidden',
        background: 'hsl(222 47% 8%)',
      }}
    >
      <GradientOrb variant="primary" size="md" />
      <GradientOrb variant="accent" size="sm" delay="short" />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: 24,
          color: 'white',
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        Land your next role faster
      </div>
    </div>
  );
}

export function Sizes() {
  return (
    <div
      style={{
        position: 'relative',
        width: 480,
        height: 220,
        borderRadius: 16,
        overflow: 'hidden',
        background: 'hsl(222 47% 8%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-evenly',
      }}
    >
      <GradientOrb variant="secondary" size="sm" />
      <GradientOrb variant="secondary" size="lg" />
    </div>
  );
}
