import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export function JobDetailsRight() {
  return (
    <Sheet defaultOpen>
      <SheetTrigger asChild>
        <Button>View job</Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Senior Frontend Engineer</SheetTitle>
          <SheetDescription>Stripe · San Francisco, CA · Remote</SheetDescription>
        </SheetHeader>
        <div style={{ fontSize: 14, color: 'hsl(var(--muted-foreground))', marginTop: 16, lineHeight: 1.6 }}>
          Own the checkout experience used by millions of businesses. Partner with design and
          platform teams to ship a new component library.
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <Badge variant="success">91% match</Badge>
          <Badge variant="outline">$165k – $210k</Badge>
        </div>
        <SheetFooter style={{ marginTop: 24 }}>
          <Button>Apply now</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function FiltersLeft() {
  return (
    <Sheet defaultOpen>
      <SheetTrigger asChild>
        <Button variant="outline">Browse filters</Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Refine search</SheetTitle>
          <SheetDescription>Job type, seniority, and salary</SheetDescription>
        </SheetHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
          <Button variant="secondary" style={{ justifyContent: 'flex-start' }}>
            Full-time
          </Button>
          <Button variant="outline" style={{ justifyContent: 'flex-start' }}>
            Contract
          </Button>
          <Button variant="outline" style={{ justifyContent: 'flex-start' }}>
            Internship
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function NotificationsTop() {
  return (
    <Sheet defaultOpen>
      <SheetTrigger asChild>
        <Button variant="ghost">Notifications</Button>
      </SheetTrigger>
      <SheetContent side="top">
        <SheetHeader>
          <SheetTitle>3 new updates</SheetTitle>
          <SheetDescription>Figma moved you to the interview stage</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
}

export function BulkActionsBottom() {
  return (
    <Sheet defaultOpen>
      <SheetTrigger asChild>
        <Button variant="outline">2 selected</Button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>2 applications selected</SheetTitle>
          <SheetDescription>Choose a bulk action</SheetDescription>
        </SheetHeader>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Button size="sm">Archive</Button>
          <Button size="sm" variant="destructive">
            Withdraw
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
