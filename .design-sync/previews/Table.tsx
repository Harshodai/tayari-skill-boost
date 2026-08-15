import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from '@/components/ui/table';

const statusVariant: Record<string, 'success' | 'info' | 'warning' | 'destructive' | 'secondary'> = {
  Offer: 'success',
  Interview: 'info',
  Screening: 'warning',
  Rejected: 'destructive',
  Applied: 'secondary',
};

const applications = [
  { company: 'Stripe', role: 'Senior Frontend Engineer', status: 'Interview', applied: 'Aug 2, 2026', ats: '91%' },
  { company: 'Anthropic', role: 'Staff Product Designer', status: 'Offer', applied: 'Jul 21, 2026', ats: '96%' },
  { company: 'Figma', role: 'Design Systems Engineer', status: 'Screening', applied: 'Aug 9, 2026', ats: '84%' },
  { company: 'Notion', role: 'Full-stack Engineer', status: 'Rejected', applied: 'Jul 15, 2026', ats: '78%' },
  { company: 'Vercel', role: 'Developer Experience Engineer', status: 'Applied', applied: 'Aug 12, 2026', ats: '88%' },
];

export function ApplicationsList() {
  return (
    <div style={{ width: 640 }}>
      <Table>
        <TableCaption>Your job applications, most recent first.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Applied</TableHead>
            <TableHead className="text-right">ATS match</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.map((app) => (
            <TableRow key={app.company}>
              <TableCell className="font-medium">{app.company}</TableCell>
              <TableCell>{app.role}</TableCell>
              <TableCell>
                <Badge variant={statusVariant[app.status]}>{app.status}</Badge>
              </TableCell>
              <TableCell>{app.applied}</TableCell>
              <TableCell className="text-right">{app.ats}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function WithFooterTotals() {
  return (
    <div style={{ width: 520 }}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Stage</TableHead>
            <TableHead className="text-right">Count</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Applied</TableCell>
            <TableCell className="text-right">18</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Interviewing</TableCell>
            <TableCell className="text-right">5</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Offers</TableCell>
            <TableCell className="text-right">2</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total this month</TableCell>
            <TableCell className="text-right">25</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
