import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function AtsScoreBreakdown() {
  return (
    <Popover defaultOpen>
      <PopoverTrigger asChild>
        <Button variant="outline">Score breakdown</Button>
      </PopoverTrigger>
      <PopoverContent>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>ATS match — 91</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Keyword coverage</span>
            <span style={{ fontWeight: 600 }}>94</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Formatting</span>
            <span style={{ fontWeight: 600 }}>96</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Quantified impact</span>
            <span style={{ fontWeight: 600 }}>83</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ShareJob() {
  return (
    <Popover defaultOpen>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Share job">
          <Share2 />
        </Button>
      </PopoverTrigger>
      <PopoverContent style={{ width: 280 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Share this job</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Input readOnly value="jobtayari.com/j/stripe-frontend-91" style={{ fontSize: 12 }} />
          <Button size="sm">Copy</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
