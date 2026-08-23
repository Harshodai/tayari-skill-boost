import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuRadioGroup,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from '@/components/ui/context-menu';

export function JobActions() {
  return (
    <ContextMenu open>
      <ContextMenuTrigger
        style={{
          width: 260,
          height: 90,
          border: '1px dashed hsl(var(--border))',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          color: 'hsl(var(--muted-foreground))',
        }}
      >
        Right-click a job card
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>Senior Frontend Engineer</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem>
          Apply now
          <ContextMenuShortcut>⌘A</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>Save for later</ContextMenuItem>
        <ContextMenuItem>Copy link</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem>Hide company</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function WithCheckboxAndRadio() {
  return (
    <ContextMenu open>
      <ContextMenuTrigger
        style={{
          width: 260,
          height: 90,
          border: '1px dashed hsl(var(--border))',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          color: 'hsl(var(--muted-foreground))',
        }}
      >
        Applications table row
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>View options</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuCheckboxItem checked>Show ATS score</ContextMenuCheckboxItem>
        <ContextMenuCheckboxItem>Show salary</ContextMenuCheckboxItem>
        <ContextMenuSeparator />
        <ContextMenuRadioGroup value="grid">
          <ContextMenuRadioItem value="grid">Grid view</ContextMenuRadioItem>
          <ContextMenuRadioItem value="list">List view</ContextMenuRadioItem>
        </ContextMenuRadioGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
}
