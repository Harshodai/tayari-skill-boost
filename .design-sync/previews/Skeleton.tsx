import { Skeleton } from '@/components/ui/skeleton';

export function JobCardLoading() {
  return (
    <div style={{ width: 360, display: 'flex', flexDirection: 'column', gap: 10, padding: 16, border: '1px solid hsl(var(--border))', borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Skeleton style={{ height: 16, width: '60%' }} />
        <Skeleton style={{ height: 20, width: 44, borderRadius: 999 }} />
      </div>
      <Skeleton style={{ height: 12, width: '40%' }} />
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <Skeleton style={{ height: 20, width: 60, borderRadius: 999 }} />
        <Skeleton style={{ height: 20, width: 72, borderRadius: 999 }} />
        <Skeleton style={{ height: 20, width: 50, borderRadius: 999 }} />
      </div>
    </div>
  );
}

export function ProfileRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: 320 }}>
      <Skeleton style={{ height: 44, width: 44, borderRadius: '9999px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <Skeleton style={{ height: 14, width: '70%' }} />
        <Skeleton style={{ height: 12, width: '45%' }} />
      </div>
    </div>
  );
}

export function TextLines() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 340 }}>
      <Skeleton style={{ height: 12, width: '100%' }} />
      <Skeleton style={{ height: 12, width: '92%' }} />
      <Skeleton style={{ height: 12, width: '75%' }} />
    </div>
  );
}
