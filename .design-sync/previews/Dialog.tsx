import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function OptimizeResume() {
  return (
    <Dialog defaultOpen>
      <DialogTrigger asChild>
        <Button>Optimize resume</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Optimize resume for Stripe — Staff Engineer</DialogTitle>
          <DialogDescription>
            We'll rewrite 4 bullet points to better match this job description using STAR
            structure and the keywords it's missing.
          </DialogDescription>
        </DialogHeader>
        <div style={{ fontSize: 14, color: 'hsl(var(--muted-foreground))', lineHeight: 1.6 }}>
          <p>Missing keywords: distributed systems, GraphQL federation, on-call</p>
          <p>Current match score: 74 → projected: 91</p>
        </div>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Run optimization</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ExportPdf() {
  return (
    <Dialog defaultOpen>
      <DialogTrigger asChild>
        <Button variant="outline">Export PDF</Button>
      </DialogTrigger>
      <DialogContent style={{ maxWidth: 420 }}>
        <DialogHeader>
          <DialogTitle>Export resume as PDF</DialogTitle>
          <DialogDescription>Choose a template before exporting.</DialogDescription>
        </DialogHeader>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="sm" variant="secondary">
            Modern
          </Button>
          <Button size="sm" variant="outline">
            Classic
          </Button>
          <Button size="sm" variant="outline">
            Compact
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Export</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
