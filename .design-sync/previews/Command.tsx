import { Briefcase, FileSearch, Search, Send, Sparkles, Star } from 'lucide-react';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from '@/components/ui/command';

export function JobTayariPalette() {
  return (
    <div style={{ width: 420, border: '1px solid hsl(var(--border))', borderRadius: 8 }}>
      <Command>
        <CommandInput placeholder="Search jobs, applications, or commands..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Quick actions">
            <CommandItem>
              <Search style={{ marginRight: 8, height: 16, width: 16 }} />
              <span>Search jobs</span>
              <CommandShortcut>⌘K</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <Sparkles style={{ marginRight: 8, height: 16, width: 16 }} />
              <span>Run ATS scan</span>
              <CommandShortcut>⌘R</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <Send style={{ marginRight: 8, height: 16, width: 16 }} />
              <span>Generate cover letter</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Navigate">
            <CommandItem>
              <Briefcase style={{ marginRight: 8, height: 16, width: 16 }} />
              <span>View saved applications</span>
            </CommandItem>
            <CommandItem>
              <FileSearch style={{ marginRight: 8, height: 16, width: 16 }} />
              <span>Open resume optimizer</span>
            </CommandItem>
            <CommandItem>
              <Star style={{ marginRight: 8, height: 16, width: 16 }} />
              <span>Saved jobs (12)</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}

export function RecentSearches() {
  return (
    <div style={{ width: 420, border: '1px solid hsl(var(--border))', borderRadius: 8 }}>
      <Command>
        <CommandInput placeholder="Jump to a company or role..." />
        <CommandList>
          <CommandGroup heading="Recent">
            <CommandItem>
              <span>Stripe — Senior Frontend Engineer</span>
            </CommandItem>
            <CommandItem>
              <span>Anthropic — Staff Product Designer</span>
            </CommandItem>
            <CommandItem>
              <span>Figma — Design Systems Engineer</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}
