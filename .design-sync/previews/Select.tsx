import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export function Placeholder() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 280 }}>
      <Label htmlFor="job-type">Job type</Label>
      <Select>
        <SelectTrigger id="job-type">
          <SelectValue placeholder="Select job type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="full-time">Full-time</SelectItem>
          <SelectItem value="part-time">Part-time</SelectItem>
          <SelectItem value="contract">Contract</SelectItem>
          <SelectItem value="internship">Internship</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function WithValue() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 280 }}>
      <Label htmlFor="experience-level">Experience level</Label>
      <Select defaultValue="senior">
        <SelectTrigger id="experience-level">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="entry">Entry level (0-2 yrs)</SelectItem>
          <SelectItem value="mid">Mid level (3-5 yrs)</SelectItem>
          <SelectItem value="senior">Senior (6-9 yrs)</SelectItem>
          <SelectItem value="staff">Staff / Principal (10+ yrs)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function GroupedWithLabels() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 280 }}>
      <Label htmlFor="target-company">Target company</Label>
      <Select defaultValue="stripe">
        <SelectTrigger id="target-company">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Applied</SelectLabel>
            <SelectItem value="stripe">Stripe</SelectItem>
            <SelectItem value="anthropic">Anthropic</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Saved</SelectLabel>
            <SelectItem value="figma">Figma</SelectItem>
            <SelectItem value="notion">Notion</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 280 }}>
      <Label htmlFor="locked-status">Application status</Label>
      <Select defaultValue="hired" disabled>
        <SelectTrigger id="locked-status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="hired">Hired — record closed</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
