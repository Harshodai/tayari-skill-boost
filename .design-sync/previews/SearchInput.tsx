import { SearchInput } from '@/components/ui/search-input';

const noop = () => {};

export function Default() {
  return (
    <div style={{ width: 360 }}>
      <SearchInput placeholder="Search jobs, companies, or skills…" onChange={noop} />
    </div>
  );
}

export function WithValue() {
  return (
    <div style={{ width: 360 }}>
      <SearchInput
        value="Senior Frontend Engineer"
        placeholder="Search jobs, companies, or skills…"
        onChange={noop}
      />
    </div>
  );
}

export function Loading() {
  return (
    <div style={{ width: 360 }}>
      <SearchInput
        value="Product designer, remote"
        placeholder="Search jobs, companies, or skills…"
        isLoading
        onChange={noop}
      />
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 360 }}>
      <SearchInput size="sm" placeholder="Search jobs…" onChange={noop} />
      <SearchInput size="md" placeholder="Search jobs, companies, or skills…" onChange={noop} />
      <SearchInput size="lg" placeholder="Search jobs, companies, or skills…" onChange={noop} />
    </div>
  );
}

export function WithSuggestions() {
  return (
    <div style={{ width: 360 }}>
      <SearchInput
        defaultValue="stripe"
        placeholder="Search jobs, companies, or skills…"
        suggestions={['Stripe', 'Stripe Staff Engineer', 'Stripe Product Designer', 'Anthropic', 'Notion']}
        autoFocus
        onChange={noop}
      />
    </div>
  );
}
