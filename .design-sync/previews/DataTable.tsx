import { Badge } from '@/components/ui/badge';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';

type Application = {
  id: string;
  company: string;
  role: string;
  status: 'applied' | 'interview' | 'offer' | 'rejected' | 'screening';
  atsScore: number;
  appliedOn: string;
};

const statusVariant: Record<Application['status'], 'success' | 'info' | 'warning' | 'destructive' | 'secondary'> = {
  offer: 'success',
  interview: 'info',
  screening: 'warning',
  rejected: 'destructive',
  applied: 'secondary',
};

const applications: Application[] = [
  { id: '1', company: 'Stripe', role: 'Senior Frontend Engineer', status: 'interview', atsScore: 91, appliedOn: 'Aug 2, 2026' },
  { id: '2', company: 'Anthropic', role: 'Staff Product Designer', status: 'offer', atsScore: 96, appliedOn: 'Jul 21, 2026' },
  { id: '3', company: 'Figma', role: 'Design Systems Engineer', status: 'screening', atsScore: 84, appliedOn: 'Aug 9, 2026' },
  { id: '4', company: 'Notion', role: 'Full-stack Engineer', status: 'rejected', atsScore: 78, appliedOn: 'Jul 15, 2026' },
  { id: '5', company: 'Vercel', role: 'Developer Experience Engineer', status: 'applied', atsScore: 88, appliedOn: 'Aug 12, 2026' },
];

const columns: ColumnDef<Application>[] = [
  { key: 'company', header: 'Company', sortable: true },
  { key: 'role', header: 'Role' },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <Badge variant={statusVariant[row.status]}>{row.status}</Badge>,
  },
  {
    key: 'atsScore',
    header: 'ATS match',
    align: 'right',
    sortable: true,
    render: (row) => `${row.atsScore}%`,
  },
  { key: 'appliedOn', header: 'Applied', align: 'right' },
];

export function Populated() {
  return (
    <div style={{ width: 720 }}>
      <DataTable columns={columns} data={applications} caption="Job applications list" />
    </div>
  );
}

export function Loading() {
  return (
    <div style={{ width: 720 }}>
      <DataTable columns={columns} data={[]} isLoading skeletonRows={4} caption="Job applications loading" />
    </div>
  );
}

export function Empty() {
  return (
    <div style={{ width: 720 }}>
      <DataTable
        columns={columns}
        data={[]}
        emptyTitle="No applications yet"
        emptyMessage="Start applying to track your progress here."
      />
    </div>
  );
}

export function ErrorState() {
  return (
    <div style={{ width: 720 }}>
      <DataTable
        columns={columns}
        data={[]}
        error="Couldn't load your applications. Check your connection and try again."
        onRetry={() => {}}
      />
    </div>
  );
}
