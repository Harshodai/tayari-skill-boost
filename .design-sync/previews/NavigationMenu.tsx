import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';

export function ProductNav() {
  return (
    <div style={{ position: 'relative', height: 220 }}>
      <NavigationMenu defaultValue="explore">
        <NavigationMenuList>
          <NavigationMenuItem value="explore">
            <NavigationMenuTrigger>Explore</NavigationMenuTrigger>
            <NavigationMenuContent>
              <div style={{ display: 'grid', gap: 4, padding: 16, width: 320 }}>
                <NavigationMenuLink style={{ padding: 8, borderRadius: 6, fontSize: 13, fontWeight: 500 }}>
                  Job search
                </NavigationMenuLink>
                <NavigationMenuLink style={{ padding: 8, borderRadius: 6, fontSize: 13, fontWeight: 500 }}>
                  Resume optimizer
                </NavigationMenuLink>
                <NavigationMenuLink style={{ padding: 8, borderRadius: 6, fontSize: 13, fontWeight: 500 }}>
                  Interview prep
                </NavigationMenuLink>
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink className={navigationMenuTriggerStyle()}>Pricing</NavigationMenuLink>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink className={navigationMenuTriggerStyle()}>Blog</NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
}
