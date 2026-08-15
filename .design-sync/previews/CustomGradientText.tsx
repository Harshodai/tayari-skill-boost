import { CustomGradientText } from '@/components/ui/animated-gradient-text';

export function DefaultTheme() {
  return (
    <h2 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>
      <CustomGradientText>Your resume, rewritten to get interviews</CustomGradientText>
    </h2>
  );
}

export function SuccessGradient() {
  return (
    <p style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
      <CustomGradientText from="hsl(142 71% 45%)" via="hsl(160 60% 45%)" to="hsl(173 58% 39%)">
        Application submitted successfully
      </CustomGradientText>
    </p>
  );
}

export function BrandGradient() {
  return (
    <h3 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
      <CustomGradientText from="#4f46e5" via="#7c3aed" to="#ec4899">
        AutoPilot found 14 new matches
      </CustomGradientText>
    </h3>
  );
}

export function StaticNoAnimation() {
  return (
    <p style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
      <CustomGradientText from="hsl(38 92% 50%)" via="hsl(24 95% 53%)" to="hsl(0 84% 60%)" animated={false}>
        3 applications need attention
      </CustomGradientText>
    </p>
  );
}
