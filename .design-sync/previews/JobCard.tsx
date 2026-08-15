import { JobCard, JobCardGrid, type Job } from '@/components/ui/job-card';

const baseJob: Job = {
  id: '1',
  title: 'Senior Frontend Engineer',
  company: 'Stripe',
  location: 'San Francisco, CA',
  salary: '$165k – $210k',
  type: 'Full-time',
  atsScore: 91,
  tags: ['React', 'TypeScript', 'GraphQL', 'Design Systems'],
  postedAt: '2 days ago',
  isRemote: true,
};

const noop = () => {};
const asyncNoop = async () => {};

export function Default() {
  return (
    <div style={{ width: 380 }}>
      <JobCard job={baseJob} onSave={noop} onApply={asyncNoop} onView={noop} />
    </div>
  );
}

export function Featured() {
  return (
    <div style={{ width: 380 }}>
      <JobCard
        job={{ ...baseJob, id: '2', company: 'Anthropic', title: 'Staff Product Designer', atsScore: 96 }}
        variant="featured"
        onSave={noop}
        onApply={asyncNoop}
        onView={noop}
      />
    </div>
  );
}

export function Compact() {
  return (
    <div style={{ width: 320 }}>
      <JobCard job={{ ...baseJob, id: '3', isSaved: true }} variant="compact" onSave={noop} onView={noop} />
    </div>
  );
}

export function WithApplicationStatus() {
  return (
    <div style={{ width: 380 }}>
      <JobCard
        job={{ ...baseJob, id: '4', applicationStatus: 'interview', company: 'Figma' }}
        onSave={noop}
        onView={noop}
      />
    </div>
  );
}

export function LoadingSkeleton() {
  return (
    <div style={{ width: 380 }}>
      <JobCard isLoading />
    </div>
  );
}

export function Grid() {
  return (
    <div style={{ width: 780 }}>
      <JobCardGrid columns={2}>
        <JobCard job={baseJob} onSave={noop} onApply={asyncNoop} onView={noop} />
        <JobCard job={{ ...baseJob, id: '5', company: 'Notion', atsScore: 78 }} onSave={noop} onApply={asyncNoop} onView={noop} />
      </JobCardGrid>
    </div>
  );
}
