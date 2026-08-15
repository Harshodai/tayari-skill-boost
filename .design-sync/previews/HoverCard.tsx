import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

export function CompanyPreview() {
  return (
    <HoverCard defaultOpen>
      <HoverCardTrigger
        style={{ color: 'hsl(var(--primary))', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}
      >
        Stripe
      </HoverCardTrigger>
      <HoverCardContent>
        <div style={{ display: 'flex', gap: 10 }}>
          <Avatar>
            <AvatarFallback>ST</AvatarFallback>
          </Avatar>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Stripe</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
              Financial infrastructure for the internet
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <Badge variant="outline">Series H</Badge>
          <Badge variant="outline">8,000+ employees</Badge>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export function RecruiterPreview() {
  return (
    <HoverCard defaultOpen>
      <HoverCardTrigger style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <Avatar style={{ height: 28, width: 28 }}>
          <AvatarFallback>JM</AvatarFallback>
        </Avatar>
        <span style={{ fontSize: 14, fontWeight: 500 }}>Jamie Morales</span>
      </HoverCardTrigger>
      <HoverCardContent>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Jamie Morales</div>
        <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginBottom: 6 }}>
          Technical Recruiter, Anthropic
        </div>
        <div style={{ fontSize: 12 }}>Reviewed your application 2 days ago</div>
      </HoverCardContent>
    </HoverCard>
  );
}
