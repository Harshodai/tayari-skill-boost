import { LayoutDashboard, Search, FileText, MessageSquare, Settings } from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';

const navItems = [
  { title: 'Dashboard', icon: LayoutDashboard, isActive: true },
  { title: 'Job Search', icon: Search },
  { title: 'Applications', icon: FileText },
  { title: 'Interview Prep', icon: MessageSquare },
  { title: 'Settings', icon: Settings },
];

export function AppSidebar() {
  return (
    <div style={{ height: 420, width: 260, overflow: 'hidden', border: '1px solid hsl(var(--border))', borderRadius: 8 }}>
      <SidebarProvider style={{ minHeight: 0, height: '100%' }} className="min-h-0">
        <Sidebar collapsible="none" className="h-full">
          <SidebarHeader>
            <div style={{ padding: '4px 8px', fontSize: 14, fontWeight: 700 }}>JobTayari</div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Workspace</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton isActive={item.isActive}>
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <div style={{ padding: '4px 8px', fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
              Alex Chen · Free plan
            </div>
          </SidebarFooter>
        </Sidebar>
      </SidebarProvider>
    </div>
  );
}
