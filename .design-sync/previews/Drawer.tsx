import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';

export function FilterJobs() {
  return (
    <Drawer defaultOpen>
      <DrawerTrigger asChild>
        <Button variant="outline">Filters</Button>
      </DrawerTrigger>
      <DrawerContent>
        <div style={{ margin: '0 auto', width: '100%', maxWidth: 420 }}>
          <DrawerHeader>
            <DrawerTitle>Filter jobs</DrawerTitle>
            <DrawerDescription>184 jobs match your search</DrawerDescription>
          </DrawerHeader>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 16px' }}>
            <Badge>Remote</Badge>
            <Badge variant="outline">Full-time</Badge>
            <Badge variant="outline">$150k+</Badge>
            <Badge variant="outline">Series B+</Badge>
          </div>
          <DrawerFooter>
            <Button>Apply filters</Button>
            <Button variant="outline">Reset</Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export function UpdateApplicationStatus() {
  return (
    <Drawer defaultOpen>
      <DrawerTrigger asChild>
        <Button variant="outline">Update status</Button>
      </DrawerTrigger>
      <DrawerContent>
        <div style={{ margin: '0 auto', width: '100%', maxWidth: 420 }}>
          <DrawerHeader>
            <DrawerTitle>Update status</DrawerTitle>
            <DrawerDescription>Senior Frontend Engineer at Stripe</DrawerDescription>
          </DrawerHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 16px' }}>
            <Button variant="secondary" style={{ justifyContent: 'flex-start' }}>
              Applied
            </Button>
            <Button variant="outline" style={{ justifyContent: 'flex-start' }}>
              Interviewing
            </Button>
            <Button variant="outline" style={{ justifyContent: 'flex-start' }}>
              Offer received
            </Button>
            <Button variant="outline" style={{ justifyContent: 'flex-start' }}>
              Rejected
            </Button>
          </div>
          <DrawerFooter>
            <Button>Save</Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
