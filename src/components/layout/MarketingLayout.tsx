import { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { CommandPalette } from "@/components/command/CommandPalette";

interface MarketingLayoutProps {
  children: ReactNode;
}

export function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <CommandPalette />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
