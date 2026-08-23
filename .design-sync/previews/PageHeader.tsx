import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { PageHeader } from '@/components/ui/page-header';

function Router({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

export function Default() {
  return (
    <Router>
      <div style={{ width: 760 }}>
        <PageHeader
          title="Your Applications"
          description="Track every application from submission to offer, all in one place."
          actions={<Button>Add Application</Button>}
        />
      </div>
    </Router>
  );
}

export function WithBreadcrumbsAndBadge() {
  return (
    <Router>
      <div style={{ width: 760 }}>
        <PageHeader
          title="Senior Frontend Engineer"
          description="Stripe · San Francisco, CA · Applied 2 days ago"
          breadcrumbs={[
            { label: 'Dashboard', href: '/' },
            { label: 'Applications', href: '/applications' },
            { label: 'Stripe — Senior Frontend Engineer' },
          ]}
          badge={<StatusBadge status="interview" dot />}
          actions={
            <>
              <Button variant="outline">Withdraw</Button>
              <Button>View Job Posting</Button>
            </>
          }
        />
      </div>
    </Router>
  );
}

export function WithBackLink() {
  return (
    <Router>
      <div style={{ width: 760 }}>
        <PageHeader
          title="Job Search"
          description="1,204 open roles matched to your resume."
          backHref="/dashboard"
          backLabel="Back to Dashboard"
          actions={<Button variant="outline">Edit Preferences</Button>}
        />
      </div>
    </Router>
  );
}

export function Loading() {
  return (
    <Router>
      <div style={{ width: 760 }}>
        <PageHeader title="Your Applications" isLoading />
      </div>
    </Router>
  );
}
