import * as React from 'react';
import { FilterBar, type FilterDef } from '@/components/ui/filter-bar';

const jobFilters: FilterDef[] = [
  {
    key: 'workplace',
    label: 'Workplace',
    options: [
      { value: 'remote', label: 'Remote', count: 128 },
      { value: 'hybrid', label: 'Hybrid', count: 46 },
      { value: 'onsite', label: 'On-site', count: 31 },
    ],
    multiple: true,
  },
  {
    key: 'type',
    label: 'Job Type',
    options: [
      { value: 'full-time', label: 'Full-time', count: 172 },
      { value: 'contract', label: 'Contract', count: 24 },
      { value: 'internship', label: 'Internship', count: 9 },
    ],
  },
  {
    key: 'level',
    label: 'Experience Level',
    options: [
      { value: 'entry', label: 'Entry level', count: 18 },
      { value: 'mid', label: 'Mid level', count: 74 },
      { value: 'senior', label: 'Senior', count: 91 },
      { value: 'staff', label: 'Staff+', count: 22 },
    ],
  },
  {
    key: 'salary',
    label: 'Salary Range',
    options: [
      { value: '80-120', label: '$80k – $120k', count: 40 },
      { value: '120-160', label: '$120k – $160k', count: 63 },
      { value: '160-220', label: '$160k – $220k', count: 51 },
      { value: '220+', label: '$220k+', count: 12 },
    ],
  },
];

const sortOptions = [
  { value: 'relevance', label: 'Most Relevant' },
  { value: 'recent', label: 'Most Recent' },
  { value: 'salary-high', label: 'Salary: High to Low' },
  { value: 'ats-score', label: 'Best ATS Match' },
];

export function Default() {
  const [activeFilters, setActiveFilters] = React.useState<Record<string, string | string[]>>({});
  const [sort, setSort] = React.useState('relevance');

  return (
    <div style={{ width: 820 }}>
      <FilterBar
        filters={jobFilters}
        activeFilters={activeFilters}
        onFilterChange={(key, value) => setActiveFilters((prev) => ({ ...prev, [key]: value }))}
        onClearAll={() => setActiveFilters({})}
        sortOptions={sortOptions}
        activeSort={sort}
        onSortChange={setSort}
        resultCount={166}
        resultLabel="jobs"
      />
    </div>
  );
}

export function WithActiveFilters() {
  const [activeFilters, setActiveFilters] = React.useState<Record<string, string | string[]>>({
    workplace: ['remote', 'hybrid'],
    level: 'senior',
  });
  const [sort, setSort] = React.useState('ats-score');

  return (
    <div style={{ width: 820 }}>
      <FilterBar
        filters={jobFilters}
        activeFilters={activeFilters}
        onFilterChange={(key, value) => setActiveFilters((prev) => ({ ...prev, [key]: value }))}
        onClearAll={() => setActiveFilters({})}
        sortOptions={sortOptions}
        activeSort={sort}
        onSortChange={setSort}
        resultCount={57}
        resultLabel="jobs"
      />
    </div>
  );
}

export function NoResults() {
  return (
    <div style={{ width: 820 }}>
      <FilterBar
        filters={jobFilters}
        activeFilters={{ salary: '220+', level: 'entry' }}
        sortOptions={sortOptions}
        activeSort="relevance"
        resultCount={0}
        resultLabel="jobs"
      />
    </div>
  );
}
