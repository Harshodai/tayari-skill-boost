import { SearchEmptyState } from '@/components/ui/empty-state';

const noop = () => {};

export function WithQuery() {
  return (
    <div style={{ width: 420, border: '1px solid hsl(var(--border))', borderRadius: 12 }}>
      <SearchEmptyState query="staff frontend engineer remote" onReset={noop} />
    </div>
  );
}

export function WithoutQuery() {
  return (
    <div style={{ width: 420, border: '1px solid hsl(var(--border))', borderRadius: 12 }}>
      <SearchEmptyState onReset={noop} />
    </div>
  );
}
