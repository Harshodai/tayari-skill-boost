import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarCheckboxItem,
} from '@/components/ui/menubar';

export function AppMenubar() {
  return (
    <Menubar defaultValue="file" style={{ width: 420 }}>
      <MenubarMenu value="file">
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>
            New application
            <MenubarShortcut>⌘N</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>Import resume</MenubarItem>
          <MenubarSeparator />
          <MenubarItem>Export report</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu value="view">
        <MenubarTrigger>View</MenubarTrigger>
        <MenubarContent>
          <MenubarCheckboxItem checked>Show ATS scores</MenubarCheckboxItem>
          <MenubarCheckboxItem>Compact rows</MenubarCheckboxItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu value="help">
        <MenubarTrigger>Help</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>Documentation</MenubarItem>
          <MenubarItem>Contact support</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
