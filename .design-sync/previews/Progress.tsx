import { Progress } from '@/components/ui/progress';

export function ScoreValues() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 360 }}>
      <Progress value={92} colorScheme="auto" showLabel label="Stripe — Staff Engineer" />
      <Progress value={64} colorScheme="auto" showLabel label="Notion — Product Designer" />
      <Progress value={31} colorScheme="auto" showLabel label="Figma — Growth Marketer" />
    </div>
  );
}

export function ColorSchemes() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 360 }}>
      <Progress value={70} colorScheme="primary" showLabel label="Profile completeness" />
      <Progress value={85} colorScheme="success" showLabel label="Interview readiness" />
      <Progress value={55} colorScheme="warning" showLabel label="Skill gap coverage" />
      <Progress value={18} colorScheme="destructive" showLabel label="Application response rate" />
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: 320 }}>
      <Progress value={75} size="xs" colorScheme="primary" />
      <Progress value={75} size="sm" colorScheme="primary" />
      <Progress value={75} size="md" colorScheme="primary" />
      <Progress value={75} size="lg" colorScheme="primary" />
    </div>
  );
}

export function NoLabel() {
  return (
    <div style={{ width: 320 }}>
      <Progress value={45} colorScheme="auto" />
    </div>
  );
}
