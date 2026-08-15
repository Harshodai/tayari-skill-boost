import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { JobCard, type Job } from '@/components/ui/job-card';

const featuredJobs: Job[] = [
  {
    id: '1',
    title: 'Senior Frontend Engineer',
    company: 'Stripe',
    location: 'San Francisco, CA',
    salary: '$165k – $210k',
    type: 'Full-time',
    atsScore: 91,
    tags: ['React', 'TypeScript', 'GraphQL'],
    postedAt: '2 days ago',
    isRemote: true,
  },
  {
    id: '2',
    title: 'Staff Product Designer',
    company: 'Anthropic',
    location: 'Remote',
    salary: '$180k – $230k',
    type: 'Full-time',
    atsScore: 96,
    tags: ['Figma', 'Design Systems', 'Research'],
    postedAt: '5 hours ago',
    isRemote: true,
  },
  {
    id: '3',
    title: 'Design Engineer',
    company: 'Figma',
    location: 'New York, NY',
    salary: '$150k – $195k',
    type: 'Full-time',
    atsScore: 84,
    tags: ['React', 'CSS', 'WebGL'],
    postedAt: '1 day ago',
    isRemote: false,
  },
  {
    id: '4',
    title: 'Growth Product Manager',
    company: 'Notion',
    location: 'Remote',
    salary: '$140k – $175k',
    type: 'Full-time',
    atsScore: 78,
    tags: ['SQL', 'Experimentation'],
    postedAt: '3 days ago',
    isRemote: true,
  },
];

const noop = () => {};
const asyncNoop = async () => {};

export function FeaturedJobsSlider() {
  return (
    <div style={{ width: 440, padding: '0 48px' }}>
      <Carousel opts={{ align: 'start' }}>
        <CarouselContent>
          {featuredJobs.map((job) => (
            <CarouselItem key={job.id}>
              <JobCard job={job} onSave={noop} onApply={asyncNoop} onView={noop} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  );
}

export function TestimonialSlider() {
  const testimonials = [
    { quote: 'The ATS scan caught keyword gaps I never would have noticed.', author: 'Priya N., hired at Notion' },
    { quote: 'Rewrote my bullets with real metrics — three callbacks in a week.', author: 'Marcus T., hired at Figma' },
    { quote: 'Autopilot applied to 40 roles overnight while I slept.', author: 'Devon K., hired at Stripe' },
  ];

  return (
    <div style={{ width: 420, padding: '0 48px' }}>
      <Carousel>
        <CarouselContent>
          {testimonials.map((t, i) => (
            <CarouselItem key={i}>
              <div
                style={{
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 12,
                  padding: 20,
                  background: 'hsl(var(--card))',
                  minHeight: 120,
                }}
              >
                <p style={{ fontSize: 14, fontStyle: 'italic', color: 'hsl(var(--foreground))' }}>
                  "{t.quote}"
                </p>
                <p style={{ marginTop: 12, fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
                  {t.author}
                </p>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  );
}
