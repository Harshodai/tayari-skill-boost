import { AspectRatio } from '@/components/ui/aspect-ratio';

export function CompanyBanner() {
  return (
    <div style={{ width: 420 }}>
      <AspectRatio ratio={16 / 9}>
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 12,
            background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.4) 100%)',
            display: 'flex',
            alignItems: 'flex-end',
            padding: 16,
          }}
        >
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>Stripe</div>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>
              Payments infrastructure for the internet
            </div>
          </div>
        </div>
      </AspectRatio>
    </div>
  );
}

export function SquareLogoTile() {
  return (
    <div style={{ width: 160 }}>
      <AspectRatio ratio={1}>
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 16,
            background: 'hsl(var(--muted))',
            border: '1px solid hsl(var(--border))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 28,
            color: 'hsl(var(--primary))',
          }}
        >
          A
        </div>
      </AspectRatio>
    </div>
  );
}

export function VideoPlaceholder() {
  return (
    <div style={{ width: 420 }}>
      <AspectRatio ratio={16 / 9}>
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 12,
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'hsl(var(--primary))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 18,
            }}
          >
            ▶
          </div>
          <div style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>
            Mock interview replay — 12:04
          </div>
        </div>
      </AspectRatio>
    </div>
  );
}
