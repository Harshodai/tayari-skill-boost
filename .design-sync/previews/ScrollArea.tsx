import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

const applications = [
  'Stripe — Senior Frontend Engineer',
  'Anthropic — Staff Product Designer',
  'Figma — Design Systems Engineer',
  'Notion — Full Stack Engineer',
  'Vercel — Developer Relations',
  'Linear — Product Engineer',
  'Ramp — Backend Engineer',
  'Retool — Solutions Engineer',
];

export function ApplicationsList() {
  return (
    <ScrollArea style={{ height: 220, width: 320 }} className="rounded-md border">
      <div style={{ padding: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Recent applications</div>
        {applications.map((app, i) => (
          <div key={app}>
            <div style={{ fontSize: 13, padding: '8px 0', color: 'hsl(var(--foreground))' }}>{app}</div>
            {i < applications.length - 1 && <Separator />}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
