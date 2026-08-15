import { JobCard, JobCardGrid, type Job } from '@/components/ui/job-card';

const jobs: Job[] = [
  {
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
  },
  {
    id: '2',
    title: 'Staff Product Designer',
    company: 'Anthropic',
    location: 'San Francisco, CA',
    salary: '$190k – $240k',
    type: 'Full-time',
    atsScore: 96,
    tags: ['Figma', 'Design Systems', 'Prototyping'],
    postedAt: '5 hours ago',
    isRemote: true,
    isSaved: true,
  },
  {
    id: '3',
    title: 'Backend Engineer, Payments',
    company: 'Figma',
    location: 'New York, NY',
    salary: '$150k – $195k',
    type: 'Full-time',
    atsScore: 78,
    tags: ['Go', 'PostgreSQL', 'Kubernetes'],
    postedAt: '1 week ago',
    applicationStatus: 'interview',
  },
];

const noop = () => {};
const asyncNoop = async () => {};

export function TwoColumnGrid() {
  return (
    <div style={{ width: 780 }}>
      <JobCardGrid columns={2}>
        {jobs.slice(0, 2).map((job) => (
          <JobCard key={job.id} job={job} onSave={noop} onApply={asyncNoop} onView={noop} />
        ))}
      </JobCardGrid>
    </div>
  );
}

export function ThreeColumnGrid() {
  return (
    <div style={{ width: 1100 }}>
      <JobCardGrid columns={3}>
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} onSave={noop} onApply={asyncNoop} onView={noop} />
        ))}
      </JobCardGrid>
    </div>
  );
}

export function SingleColumnList() {
  return (
    <div style={{ width: 480 }}>
      <JobCardGrid columns={1}>
        {jobs.slice(0, 2).map((job) => (
          <JobCard key={job.id} job={job} variant="compact" onSave={noop} onView={noop} />
        ))}
      </JobCardGrid>
    </div>
  );
}
