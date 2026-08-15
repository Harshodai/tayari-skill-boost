import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

export function Fallbacks() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Avatar>
        <AvatarFallback>HK</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>SC</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    </div>
  );
}

export function WithImage() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Avatar>
        <AvatarImage src="https://i.pravatar.cc/80?img=12" alt="Harsha K." />
        <AvatarFallback>HK</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarImage src="https://broken-image-url.invalid/none.png" alt="Sarah Chen" />
        <AvatarFallback>SC</AvatarFallback>
      </Avatar>
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Avatar style={{ height: 24, width: 24 }}>
        <AvatarFallback style={{ fontSize: 10 }}>HK</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>HK</AvatarFallback>
      </Avatar>
      <Avatar style={{ height: 56, width: 56 }}>
        <AvatarFallback style={{ fontSize: 18 }}>HK</AvatarFallback>
      </Avatar>
    </div>
  );
}

export function RecruiterThread() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 320 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar>
          <AvatarFallback>RT</AvatarFallback>
        </Avatar>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Rachel Torres</div>
          <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Recruiter · Stripe</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar>
          <AvatarFallback>HK</AvatarFallback>
        </Avatar>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Harsha K.</div>
          <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Candidate</div>
        </div>
      </div>
    </div>
  );
}
