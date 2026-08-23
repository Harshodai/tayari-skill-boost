import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu';

export function ApplicationActions() {
  return (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="More actions">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Stripe — Senior Engineer</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          View application
          <DropdownMenuShortcut>⌘O</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>Withdraw application</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ColumnVisibility() {
  return (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Columns</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Show columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked>Company</DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked>ATS score</DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem>Salary</DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem>Posted date</DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
