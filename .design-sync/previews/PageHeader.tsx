import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { PageHeader } from '@/components/ui/page-header';

export function Default() {
  return (
    <div style={{ width: 760 }}>
      <PageHeader
        title="Your Applications"
        description="Track every application from submission to offer, all in one place."
        actions={<Button>Add Application</Button>}
      />
    </div>
  );
}

export function WithBreadcrumbsAndBadge() {
  return (
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
  );
}

export function WithBackLink() {
  return (
    <div style={{ width: 760 }}>
      <PageHeader
        title="Job Search"
        description="1,204 open roles matched to your resume."
        backHref="/dashboard"
        backLabel="Back to Dashboard"
        actions={<Button variant="outline">Edit Preferences</Button>}
      />
    </div>
  );
}

export function Loading() {
  return (
    <div style={{ width: 760 }}>
      <PageHeader title="Your Applications" isLoading />
    </div>
  );
}
